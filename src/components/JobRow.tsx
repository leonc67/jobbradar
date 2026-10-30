import { useState } from 'react';
import type { Job, JobFlag, SourceId } from '../../shared/types.ts';
import { daysUntil, relativeDays, shortDate, urgency } from '../dates.ts';
import { STATUSES, type Status } from '../store.ts';

export const SOURCE_NAMES: Record<SourceId, string> = {
  abakus: 'Abakus',
  itdagene: 'itDAGENE',
  nav: 'NAV',
  manual: 'Egen',
};

const FLAG_TEXT: Record<JobFlag, string> = {
  year: 'Annet årstrinn',
  'not-it': 'Usikker IT-match',
  location: 'Annet sted',
};

const KIND_TEXT = { summer: 'Sommer', winter: 'Winternship', internship: 'Internship' } as const;

interface Props {
  job: Job;
  status: Status;
  note: string;
  isNew: boolean;
  highlighted: boolean;
  onStatus: (s: Status) => void;
  onNote: (n: string) => void;
  onRemove?: () => void;
}

export function JobRow({ job, status, note, isNew, highlighted, onStatus, onNote, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const u = urgency(job.deadline);
  const primaryUrl = job.sources[0]?.url;

  return (
    <li id={`job-${job.key}`} className={`row status-${status} ${highlighted ? 'is-highlighted' : ''}`}>
      <div className={`row-date urgency-${u}`}>
        {job.deadline ? (
          <>
            <strong>{shortDate(job.deadline)}</strong>
            <span>{relativeDays(daysUntil(job.deadline))}</span>
          </>
        ) : (
          <>
            <strong>{job.rolling && job.sources[0]?.source !== 'manual' ? 'Løpende' : 'Ingen frist'}</strong>
            <span>{job.sources[0]?.source === 'manual' ? 'ikke oppgitt' : 'ingen fast frist'}</span>
          </>
        )}
      </div>

      <div className="row-main">
        <p className="row-company">
          {job.company}
          {isNew && <span className="badge-new">Ny</span>}
        </p>
        <p className="row-title">
          {primaryUrl ? (
            <a href={primaryUrl} target="_blank" rel="noreferrer">
              {job.title}
            </a>
          ) : (
            job.title
          )}
        </p>
        <p className="row-meta">
          <span>{KIND_TEXT[job.kind]}</span>
          {job.locations.length > 0 && <span>{job.locations.join(', ')}</span>}
          {job.fromYear != null && (
            <span>
              {job.fromYear === job.toYear ? `${job.fromYear}. trinn` : `${job.fromYear}.–${job.toYear}. trinn`}
            </span>
          )}
          {job.sources.map((s) => (
            <a key={s.source + s.sourceId} className="source" href={s.url} target="_blank" rel="noreferrer">
              {SOURCE_NAMES[s.source]}
            </a>
          ))}
          {job.flags.map((f) => (
            <span key={f} className="flag">
              {FLAG_TEXT[f]}
            </span>
          ))}
        </p>
        {open && (
          <div className="row-note">
            <label htmlFor={`note-${job.key}`}>Notat</label>
            <textarea
              id={`note-${job.key}`}
              value={draft}
              rows={3}
              placeholder="F.eks. kontaktperson, hva du skrev om, intervjudato"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft !== note && onNote(draft)}
            />
            {onRemove && (
              <button type="button" className="link-danger" onClick={onRemove}>
                Slett stillingen
              </button>
            )}
          </div>
        )}
        {!open && note && <p className="row-note-preview">{note}</p>}
      </div>

      <div className="row-actions">
        <label className="visually-hidden" htmlFor={`status-${job.key}`}>
          Status for {job.company}
        </label>
        <select
          id={`status-${job.key}`}
          className={`status-select status-${status}`}
          value={status}
          onChange={(e) => onStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Lukk' : note ? 'Endre notat' : 'Notat'}
        </button>
      </div>
    </li>
  );
}
