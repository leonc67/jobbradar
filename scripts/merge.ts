import type { Job, RawJob, SourceId } from '../shared/types.ts';
import { assess, classify, isIt } from './relevance.ts';
import { normalizeCompany, slugify, titleSimilarity, tokens } from '../shared/text.ts';

const SOURCE_PRIORITY: SourceId[] = ['abakus', 'itdagene', 'nav', 'manual'];
const SIMILAR_TITLE = 0.8;

/** Tittelen uten firmanavnet, så "Sommerjobb Hemit 2027" blir en generisk tittel. */
function coreTitle(title: string, company: string): string {
  const companyTokens = tokens(company);
  return [...tokens(title)].filter((t) => !companyTokens.has(t)).join(' ');
}

/** To annonser er samme stilling hvis firma er likt og titlene er like (eller den ene er generisk). */
export function sameJob(
  a: { company: string; title: string },
  b: { company: string; title: string },
): boolean {
  if (normalizeCompany(a.company) !== normalizeCompany(b.company)) return false;
  const ca = coreTitle(a.title, a.company);
  const cb = coreTitle(b.title, b.company);
  if (ca === '' || cb === '') return true;
  return titleSimilarity(ca, cb) >= SIMILAR_TITLE;
}

interface Group {
  kind: NonNullable<ReturnType<typeof classify>>;
  items: RawJob[];
}

export function mergeJobs(raws: RawJob[], previous: Job[], now: Date): Job[] {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(now);
  const sorted = [...raws].sort(
    (a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source),
  );

  const groups: Group[] = [];
  for (const raw of sorted) {
    const kind = classify(raw);
    if (!kind) continue;
    if (raw.deadline && raw.deadline < today) continue;
    if (!isIt(raw)) continue; // NAV har mange sommerjobber utenfor IT, de tar vi ikke med

    const group = groups.find((g) => g.kind === kind && sameJob(g.items[0], raw));
    if (group) group.items.push(raw);
    else groups.push({ kind, items: [raw] });
  }

  const usedKeys = new Set<string>();
  const jobs = groups.map(({ kind, items }) => {
    const first = items[0];
    const withYear = items.find((i) => i.fromYear != null || i.toYear != null);
    const combined: RawJob = {
      ...first,
      locations: [...new Set(items.flatMap((i) => i.locations))],
      deadline: items.find((i) => i.deadline)?.deadline ?? null,
      rolling: items.every((i) => i.rolling),
      fromYear: withYear?.fromYear ?? null,
      toYear: withYear?.toYear ?? null,
      text: items.map((i) => i.text ?? '').join(' '),
      categories: items.flatMap((i) => i.categories ?? []),
    };
    const { flags, score } = assess(combined, kind);
    const sources = items.map(({ source, sourceId, url }) => ({ source, sourceId, url }));

    // Gjenbruk nøkkelen fra forrige kjøring så status i nettleseren følger med
    const prev =
      previous.find((p) =>
        p.sources.some((ps) => sources.some((s) => s.source === ps.source && s.sourceId === ps.sourceId)),
      ) ?? previous.find((p) => sameJob(p, first));

    let key = prev?.key ?? `${slugify(first.company)}--${slugify(first.title)}`;
    for (let n = 2; usedKeys.has(key); n++) key = `${prev?.key ?? key}-${n}`;
    usedKeys.add(key);

    const job: Job = {
      key,
      company: first.company,
      title: first.title,
      kind,
      locations: combined.locations,
      deadline: combined.deadline,
      rolling: combined.rolling,
      fromYear: combined.fromYear ?? null,
      toYear: combined.toYear ?? null,
      sources,
      flags,
      score,
      firstSeen: prev?.firstSeen ?? now.toISOString(),
      lastSeen: now.toISOString(),
    };
    return job;
  });

  return jobs.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
}
