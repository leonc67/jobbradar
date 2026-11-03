import type { Job, JobKind } from '../shared/types.ts';
import { slugify } from '../shared/text.ts';
import { sameJob } from '../scripts/merge.ts';
import { STATUSES, type Status, type StoreData } from './store.ts';

export function exportStore(data: StoreData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jobbradar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Enkel importliste, f.eks. fra et regneark eller en tidligere oversikt. */
export interface ImportItem {
  company: string;
  title: string;
  status: Status;
  deadline?: string | null;
  url?: string;
  location?: string;
  kind?: JobKind;
  note?: string;
}

const isStatus = (s: unknown): s is Status => STATUSES.some((x) => x.id === s);

const FINAL: Status[] = ['intervju', 'tilbud', 'avslag', 'droppet'];
const EARLY: Status[] = ['ny', 'interessert', 'pabegynt', 'sendt'];

/** En import skal aldri flytte en søknad bakover, f.eks. fra Avslag tilbake til Sendt. */
export function keepFinal(current: Status | undefined, incoming: Status): Status {
  if (current && FINAL.includes(current) && EARLY.includes(incoming)) return current;
  return incoming;
}

/** Legger til nytt notat under det gamle, uten å duplisere eller slette noe. */
export function mergeNote(current: string, incoming: string): string {
  const add = incoming.trim();
  if (!add || current.includes(add)) return current;
  return current ? `${current}\n${add}` : add;
}

/**
 * Leser en fil som enten er en full backup (erstatter alt) eller en liste med
 * stillinger (slås sammen med det som finnes). Stillinger i listen kobles mot
 * hentede annonser når firma og tittel matcher, ellers blir de egne stillinger.
 */
export function importFile(
  text: string,
  current: StoreData,
  jobs: Job[],
): { data: StoreData; summary: string } {
  const parsed: unknown = JSON.parse(text);

  if (parsed && typeof parsed === 'object' && (parsed as StoreData).version === 1) {
    const data = parsed as StoreData;
    return {
      data: { ...data, lastVisit: current.lastVisit },
      summary: `Gjenopprettet backup med ${Object.keys(data.tracked).length} stillinger.`,
    };
  }

  if (!Array.isArray(parsed)) throw new Error('Filen er verken en backup eller en liste med stillinger.');

  const data: StoreData = { ...current, tracked: { ...current.tracked }, manual: [...current.manual] };
  let matched = 0;
  let created = 0;
  const now = new Date().toISOString();

  for (const raw of parsed as ImportItem[]) {
    if (!raw?.company || !raw?.title || !isStatus(raw.status)) continue;
    // Stillinger du allerede følger prioriteres, så en oppdatering treffer riktig søknad
    const pool = [...Object.values(data.tracked).map((t) => t.job), ...data.manual, ...jobs];
    let job = pool.find((j) => sameJob(j, raw));
    if (job) {
      matched++;
    } else {
      created++;
      job = {
        key: `egen--${slugify(raw.company)}--${slugify(raw.title)}`,
        company: raw.company,
        title: raw.title,
        kind: raw.kind ?? 'summer',
        locations: raw.location ? [raw.location] : [],
        deadline: raw.deadline ?? null,
        rolling: !raw.deadline,
        fromYear: null,
        toYear: null,
        sources: [{ source: 'manual', sourceId: 'import', url: raw.url ?? '' }],
        flags: [],
        score: 100,
        firstSeen: now,
        lastSeen: now,
      };
      data.manual.push(job);
    }
    const prev = data.tracked[job.key];
    data.tracked[job.key] = {
      status: keepFinal(prev?.status, raw.status),
      note: mergeNote(prev?.note ?? '', raw.note ?? ''),
      updatedAt: now,
      job: prev?.job ?? job,
    };
  }

  return {
    data,
    summary: `Importerte ${matched + created} stillinger: ${matched} koblet til hentede annonser, ${created} lagt til som egne.`,
  };
}
