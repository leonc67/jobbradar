import type { JobFlag, JobKind, RawJob } from '../shared/types.ts';
import { config } from './config.ts';
import { containsWord } from '../shared/text.ts';

const hasAny = (text: string, words: readonly string[]) => words.some((w) => containsWord(text, w));
const matches = (text: string, patterns: readonly RegExp[]) => patterns.some((p) => p.test(text));

/**
 * Finner ut om en annonse er sommerjobb, winternship eller internship.
 * Returnerer null for faste stillinger, deltid og annet vi ikke vil ha med.
 */
export function classify(job: Pick<RawJob, 'title' | 'typeHint'>): JobKind | null {
  const { title, typeHint } = job;
  const { summer, winter, internship } = config.periodPatterns;

  if (hasAny(title, config.excludeKeywords)) return null;
  if (matches(title, winter)) return 'winter';
  if (typeHint === 'summer_job' || matches(title, summer)) return 'summer';
  if (matches(title, internship)) return 'internship';
  return null;
}

/** Kilder der publikum er IT-studenter, så alle annonsene der regnes som IT. */
const IT_AUDIENCE = new Set(['abakus', 'itdagene', 'manual']);

/**
 * Er dette en IT-stilling? For generelle kilder som NAV kreves et IT-ord i tittelen
 * eller en IT-kategori. Resten av NAV-feeden (barnehager, helse, reiseliv) droppes.
 */
export function isIt(job: Pick<RawJob, 'source' | 'title' | 'categories'>): boolean {
  if (IT_AUDIENCE.has(job.source)) return true;
  if (matches(job.title, config.itPatterns)) return true;
  return (job.categories ?? []).some((c) => /^IT\b/.test(c) || matches(c, config.itPatterns));
}

export function assess(job: RawJob, kind: JobKind): { flags: JobFlag[]; score: number } {
  const flags: JobFlag[] = [];
  const text = `${job.title} ${job.text ?? ''}`;

  // Årstrinn: bruk strukturerte felt når kilden har dem, ellers tekstmønstre
  const year = config.currentYear;
  if (job.fromYear != null || job.toYear != null) {
    if ((job.fromYear ?? 1) > year || (job.toYear ?? 5) < year) flags.push('year');
  } else if (
    config.seniorPatterns.some((p) => p.test(text)) &&
    !config.currentYearPatterns.some((p) => p.test(text))
  ) {
    flags.push('year');
  }

  if (!isIt(job)) flags.push('not-it');
  const itHits = config.itPatterns.filter((p) => p.test(`${job.title} ${(job.categories ?? []).join(' ')}`)).length;

  if (job.locations.length > 0) {
    const ok = job.locations.some((l) =>
      config.locations.some((wanted) => l.toLowerCase().includes(wanted)),
    );
    if (!ok) flags.push('location');
  }

  let score = 50;
  if (kind === 'summer') score += 15;
  score += Math.min(itHits, 5) * 6;
  score -= flags.length * 35;

  return { flags, score: Math.max(0, Math.min(100, score)) };
}
