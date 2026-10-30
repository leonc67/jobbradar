import type { Job } from '../../shared/types.ts';
import { daysUntil, shortDate } from '../dates.ts';
import type { Status } from '../store.ts';

const SPAN = 60;
const LANES = 4;
const CHAR_WIDTH = 1; // omtrentlig bredde per tegn i etiketten, i prosent av tidslinjen
const MAX_CHARS = 17; // etiketter kuttes ved ca. 120px

interface Props {
  jobs: Job[];
  statusOf: (job: Job) => Status;
  onSelect: (job: Job) => void;
}

const DONE: Status[] = ['sendt', 'intervju', 'tilbud', 'avslag', 'droppet'];

/** Fristlinjen: de neste 60 dagene som en tidsakse med én markør per frist. */
export function Timeline({ jobs, statusOf, onSelect }: Props) {
  const upcoming = jobs
    .filter((j) => j.deadline && daysUntil(j.deadline) >= 0 && daysUntil(j.deadline) <= SPAN)
    .filter((j) => !['droppet', 'avslag'].includes(statusOf(j)))
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));

  const laneEnds = Array<number>(LANES).fill(-Infinity);
  const placed: { job: Job; pos: number; lane: number }[] = [];
  let hidden = 0;
  for (const job of upcoming) {
    const pos = (daysUntil(job.deadline!) / SPAN) * 100;
    // Neste ledige rad der etiketten ikke kolliderer med forrige etikett i samme rad
    const lane = laneEnds.findIndex((end) => pos >= end);
    if (lane === -1) {
      hidden++;
      continue;
    }
    laneEnds[lane] = pos + Math.min(job.company.length, MAX_CHARS) * CHAR_WIDTH + 2;
    placed.push({ job, pos, lane });
  }

  const weeks = [0, 7, 14, 21, 28, 35, 42, 49, 56];

  return (
    <section className="timeline" aria-label="Frister de neste 60 dagene">
      <div className="timeline-scroll">
        <div className="timeline-track">
          {weeks.map((d) => (
            <div key={d} className="timeline-week" style={{ left: `${(d / SPAN) * 100}%` }}>
              <span>{d === 0 ? 'I dag' : shortDate(addDays(d))}</span>
            </div>
          ))}
          {placed.map(({ job, pos, lane }) => {
            const days = daysUntil(job.deadline!);
            const done = DONE.includes(statusOf(job));
            return (
              <button
                key={job.key}
                type="button"
                className={`tick lane-${lane} ${done ? 'is-done' : days <= 7 ? 'is-urgent' : ''}`}
                style={{ left: `${pos}%` }}
                onClick={() => onSelect(job)}
                title={`${job.company}: ${job.title}, frist ${shortDate(job.deadline!)}`}
              >
                <span className="tick-label">{job.company}</span>
              </button>
            );
          })}
        </div>
      </div>
      {upcoming.length === 0 ? (
        <p className="timeline-note">Ingen frister de neste 60 dagene blant stillingene som vises.</p>
      ) : hidden > 0 ? (
        <p className="timeline-note">{hidden === 1 ? '1 frist til ligger' : `${hidden} frister til ligger`} tett og vises bare i listen.</p>
      ) : null}
    </section>
  );
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(d);
}
