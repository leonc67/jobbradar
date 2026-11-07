/**
 * Henter stillinger fra alle kilder, slår dem sammen og skriver public/jobs.json.
 * Kjøres daglig av GitHub Actions (se .github/workflows/update-and-deploy.yml),
 * eller lokalt med `npm run fetch`.
 */
import fs from 'node:fs/promises';
import type { Job, JobsFile, RawJob, SourceId, SourceStatus } from '../shared/types.ts';
import { config } from './config.ts';
import { mergeJobs } from './merge.ts';
import { fetchAbakus } from './sources/abakus.ts';
import { fetchItdagene } from './sources/itdagene.ts';
import { fetchNav } from './sources/nav.ts';

const OUT = new URL('../public/jobs.json', import.meta.url);

const SOURCES: { id: SourceId; fetch: () => Promise<RawJob[]> }[] = [
  { id: 'abakus', fetch: fetchAbakus },
  { id: 'itdagene', fetch: fetchItdagene },
  { id: 'nav', fetch: fetchNav },
];

async function readPrevious(): Promise<JobsFile | null> {
  try {
    return JSON.parse(await fs.readFile(OUT, 'utf8')) as JobsFile;
  } catch {
    return null;
  }
}

async function main() {
  const previous = await readPrevious();
  const statuses: SourceStatus[] = [];
  const raws: RawJob[] = [];
  const failed = new Set<SourceId>();

  // Kildene hentes parallelt. Én kilde som feiler stopper ikke de andre.
  const results = await Promise.allSettled(SOURCES.map((s) => s.fetch()));
  results.forEach((result, i) => {
    const { id } = SOURCES[i];
    if (result.status === 'fulfilled') {
      raws.push(...result.value);
      statuses.push({ id, ok: true, count: result.value.length });
      console.log(`✓ ${id}: ${result.value.length} annonser`);
    } else {
      failed.add(id);
      const error = String(result.reason?.message ?? result.reason);
      statuses.push({ id, ok: false, count: 0, error });
      console.error(`✗ ${id}: ${error}`);
    }
  });

  const now = new Date();
  let jobs: Job[] = mergeJobs(raws, previous?.jobs ?? [], now);

  // Behold stillinger fra kilder som feilet i dag, så de ikke forsvinner fra siden
  if (previous && failed.size > 0) {
    const today = now.toISOString().slice(0, 10);
    const kept = previous.jobs.filter(
      (p) =>
        p.sources.every((s) => failed.has(s.source)) &&
        (!p.deadline || p.deadline >= today) &&
        !jobs.some((j) => j.key === p.key),
    );
    jobs = [...jobs, ...kept];
  }

  // Fjern stillinger som er markert som utløpt/stengt i config
  const removed = new Set(config.removedKeys);
  jobs = jobs.filter((j) => !removed.has(j.key));

  const file: JobsFile = { generatedAt: now.toISOString(), sources: statuses, jobs };
  await fs.writeFile(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log(`Skrev ${jobs.length} stillinger til public/jobs.json`);

  if (failed.size === SOURCES.length) process.exitCode = 1;
}

main();
