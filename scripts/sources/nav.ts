import fs from 'node:fs/promises';
import type { RawJob } from '../../shared/types.ts';
import { config } from '../config.ts';
import { request } from '../http.ts';
import { containsWord, stripHtml, toIsoDate } from '../../shared/text.ts';

/**
 * NAV sin offisielle stillingsfeed (https://navikt.github.io/pam-stilling-feed/).
 * Feeden er en endringslogg, ikke et søk. Vi leser den side for side, husker hvor
 * vi kom (data/nav-state.json) og fortsetter derfra neste dag.
 *
 * Token: sett NAV_API_TOKEN som GitHub-secret for et privat token. Uten det brukes
 * NAV sitt offentlige testtoken, som kan bli byttet ut når som helst.
 */
const BASE = 'https://pam-stilling-feed.nav.no';
const STATE_FILE = new URL('../../data/nav-state.json', import.meta.url);

interface NavState {
  cursor: string | null;
  ads: Record<string, RawJob>;
}

interface FeedItem {
  id: string;
  url: string;
  title: string;
  _feed_entry: { uuid: string; status: string; title: string; businessName: string };
}

interface FeedPage {
  feed_url: string;
  next_url: string | null;
  items: FeedItem[];
}

interface NavAd {
  uuid?: string;
  title?: string;
  description?: string;
  applicationDue?: string;
  sourceurl?: string;
  applicationUrl?: string;
  employer?: { name?: string };
  workLocations?: { city?: string; municipal?: string }[];
  occupationCategories?: { level1?: string; level2?: string }[];
  categoryList?: { name?: string }[];
}

/** Rask sjekk på tittelen før vi gjør et ekstra kall for detaljene. */
export function isCandidateTitle(title: string): boolean {
  const all = Object.values(config.periodKeywords).flat();
  if (!all.some((k) => containsWord(title, k))) return false;
  return !config.excludeKeywords.some((k) => containsWord(title, k));
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, p, c: string) => p + c.toUpperCase());

export function parseNavAd(uuid: string, body: unknown): RawJob | null {
  let ad = body as Record<string, unknown>;
  if (ad.ad_content) ad = ad.ad_content as Record<string, unknown>;
  if (ad.json) ad = ad.json as Record<string, unknown>;
  const a = ad as NavAd;
  if (!a.title) return null;

  const deadline = toIsoDate(a.applicationDue);
  const categories = [
    ...(a.occupationCategories ?? []).flatMap((c) => [c.level1, c.level2]),
    ...(a.categoryList ?? []).map((c) => c.name),
  ].filter(Boolean);

  return {
    source: 'nav',
    sourceId: uuid,
    url: `https://arbeidsplassen.nav.no/stillinger/stilling/${uuid}`,
    company: a.employer?.name?.trim() || 'Ukjent arbeidsgiver',
    title: a.title.trim(),
    locations: [
      ...new Set(
        (a.workLocations ?? [])
          .map((w) => w.city || w.municipal)
          .filter((x): x is string => Boolean(x))
          .map(titleCase),
      ),
    ],
    deadline,
    rolling: !deadline,
    text: `${categories.join(' ')} ${stripHtml(a.description ?? '')}`.slice(0, 3000),
  };
}

async function getPublicToken(): Promise<string> {
  const res = await request(`${BASE}/api/publicToken`, { headers: { Accept: 'text/plain' } });
  const text = await res.text();
  const match = text.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  if (!match) throw new Error('Fant ikke offentlig token hos NAV');
  return match[0];
}

async function loadState(): Promise<NavState> {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) as NavState;
  } catch {
    return { cursor: null, ads: {} };
  }
}

export async function fetchNav(): Promise<RawJob[]> {
  const token = process.env.NAV_API_TOKEN || (await getPublicToken());
  const auth = { Authorization: `Bearer ${token}` };
  const state = await loadState();

  let page = state.cursor ?? '/api/v1/feed';
  const firstHeaders: Record<string, string> = { ...auth };
  if (!state.cursor) {
    const since = new Date(Date.now() - config.navInitialLookbackDays * 86_400_000);
    firstHeaders['If-Modified-Since'] = since.toUTCString();
  }

  for (let i = 0; i < config.navMaxPagesPerRun; i++) {
    const res = await request(new URL(page, BASE).href, { headers: i === 0 ? firstHeaders : auth });
    if (res.status === 304) break;
    if (!res.ok) throw new Error(`NAV svarte ${res.status} på ${page}`);
    const feed = (await res.json()) as FeedPage;

    for (const item of feed.items) {
      const { uuid, status, title } = item._feed_entry;
      if (status !== 'ACTIVE') {
        delete state.ads[uuid];
        continue;
      }
      if (!isCandidateTitle(title)) {
        delete state.ads[uuid]; // tittelen kan ha blitt endret
        continue;
      }
      const detail = await request(new URL(item.url, BASE).href, { headers: auth });
      if (!detail.ok) continue;
      const job = parseNavAd(uuid, await detail.json());
      if (job) state.ads[uuid] = job;
    }

    state.cursor = feed.feed_url;
    if (!feed.next_url) break; // slutten av feeden, fortsett herfra neste gang
    page = feed.next_url;
    state.cursor = page;
  }

  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 1) + '\n');
  return Object.values(state.ads);
}
