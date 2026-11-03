import type { Job, JobKind } from '../shared/types.ts';
import { slugify } from '../shared/text.ts';
import { sameJob } from '../scripts/merge.ts';
import { fromLegacyStatus, migrate, type StoreData } from './store.ts';

export function exportStore(data: StoreData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jobbradar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Enkel importliste, f.eks. filene fra den daglige Gmail-sjekken. Bruk enten
 * sent/rejected, eller status ("sendt", "avslag", "intervju", "tilbud").
 */
export interface ImportItem {
  company: string;
  title: string;
  sent?: boolean;
  rejected?: boolean;
  status?: string;
  deadline?: string | null;
  url?: string;
  location?: string;
  kind?: JobKind;
  note?: string;
}

/** Legger til nytt notat under det gamle, uten å duplisere eller slette noe. */
export function mergeNote(current: string, incoming: string): string {
  const add = incoming.trim();
  if (!add || current.includes(add)) return current;
  return current ? `${current}\n${add}` : add;
}

/**
 * Leser en fil som enten er en full backup (erstatter alt) eller en liste med
 * stillinger (slås sammen med det som finnes). En import kan sette hake og kryss,
 * men aldri fjerne dem.
 */
export function importFile(
  text: string,
  current: StoreData,
  jobs: Job[],
): { data: StoreData; summary: string } {
  const parsed: unknown = JSON.parse(text);

  const backup = !Array.isArray(parsed) && migrate(parsed);
  if (backup) {
    return {
      data: { ...backup, lastVisit: current.lastVisit },
      summary: `Gjenopprettet backup med ${Object.keys(backup.tracked).length} stillinger.`,
    };
  }

  if (!Array.isArray(parsed)) throw new Error('Filen er verken en backup eller en liste med stillinger.');

  const data: StoreData = { ...current, tracked: { ...current.tracked }, manual: [...current.manual] };
  let sentCount = 0;
  let rejectedCount = 0;
  const now = new Date().toISOString();

  for (const raw of parsed as ImportItem[]) {
    if (!raw?.company || !raw?.title) continue;
    const legacy = fromLegacyStatus(raw.status);
    const rejected = Boolean(raw.rejected ?? legacy.rejected);
    const sent = Boolean(raw.sent ?? legacy.sent) || rejected;
    if (!sent && !raw.note) continue; // ikke søkt og ingenting å huske

    // Stillinger du allerede følger prioriteres, så en oppdatering treffer riktig søknad
    const pool = [...Object.values(data.tracked).map((t) => t.job), ...data.manual, ...jobs];
    let job = pool.find((j) => sameJob(j, raw));
    if (!job) {
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
      sent: Boolean(prev?.sent) || sent,
      rejected: Boolean(prev?.rejected) || rejected,
      note: mergeNote(prev?.note ?? '', raw.note ?? ''),
      updatedAt: now,
      job: prev?.job ?? job,
    };
    if (sent) sentCount++;
    if (rejected) rejectedCount++;
  }

  return {
    data,
    summary: `Importerte ${sentCount} sendte søknader, ${rejectedCount} av dem med avslag.`,
  };
}
