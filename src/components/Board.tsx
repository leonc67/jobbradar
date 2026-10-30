import type { Job } from '../../shared/types.ts';
import { shortDate } from '../dates.ts';
import { STATUSES, type Status } from '../store.ts';

interface Props {
  jobs: Job[];
  statusOf: (job: Job) => Status;
  onStatus: (job: Job, s: Status) => void;
}

const COLUMNS = STATUSES.filter((s) => s.id !== 'ny');

/** Tavlevisning: én kolonne per status, for stillinger du har gjort noe med. */
export function Board({ jobs, statusOf, onStatus }: Props) {
  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const items = jobs.filter((j) => statusOf(j) === col.id);
        return (
          <section key={col.id} className={`board-col status-${col.id}`} aria-label={col.label}>
            <h3>
              {col.label} <span>{items.length}</span>
            </h3>
            <ul>
              {items.map((job) => (
                <li key={job.key} className="board-card">
                  <p className="row-company">{job.company}</p>
                  <p className="board-title">{job.title}</p>
                  <div className="board-foot">
                    <span>{job.deadline ? `Frist ${shortDate(job.deadline)}` : ''}</span>
                    <select
                      aria-label={`Flytt ${job.company}`}
                      value={col.id}
                      onChange={(e) => onStatus(job, e.target.value as Status)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="board-empty">Ingen her ennå</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
