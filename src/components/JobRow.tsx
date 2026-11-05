import { useState } from 'react';
import type { Job, JobFlag, SourceId } from '../../shared/types.ts';
import { daysUntil, relativeDays, shortDate, urgency } from '../dates.ts';

export const SOURCE_NAMES: Record<SourceId, string> = {
  abakus: 'Abakus',
  itdagene: 'itDAGENE',
  nav: 'NAV',
  manual: 'Egen',
};

const FLAG_TEXT: Record<JobFlag, string> = {
  year: 'Annet årstrinn',
  'year-maybe': 'Sjekk årstrinn',
  'not-it': 'Usikker IT-match',
  location: 'Annet sted',
};

const KIND_TEXT = { summer: 'Sommer', winter: 'Winternship', internship: 'Internship' } as const;

interface Props {
  job: Job;
  sent: boolean;
  rejected: boolean;
  note: string;
  isNew: boolean;
  highlighted: boolean;
  onToggleSent: () => void;
  onToggleRejected: () => void;
  onNote: (n: string) => void;
  onRemove?: () => void;
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export function JobRow(props: Props) {
  const { job, sent, rejected, note, isNew, highlighted, onToggleSent, onToggleRejected, onNote, onRemove } = props;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const u = urgency(job.deadline);
  const primaryUrl = job.sources[0]?.url;
  const state = rejected ? 'is-rejected' : sent ? 'is-sent' : '';

  return (
    <li id={`job-${job.key}`} className={`row ${state} ${highlighted ? 'is-highlighted' : ''}`}>
      <div className={`row-date urgency-${sent ? 'none' : u}`}>
        {job.deadline ? (
          <>
            <strong>{shortDate(job.deadline)}</strong>
            <span>{relativeDays(daysUntil(job.deadline))}</span>
          </>
        ) : (
          <>
            <strong>{job.rolling && job.sources[0]?.source !== 'manual' ? 'Løpende' : 'Ingen frist'}</strong>
            {job.sources[0]?.source !== 'manual' && <span>ingen fast frist</span>}
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
          {job.sources
            .filter((s) => s.url)
            .map((s) => (
              <a key={s.source + s.sourceId} className="source" href={s.url} target="_blank" rel="noreferrer">
                {SOURCE_NAMES[s.source]}
              </a>
            ))}
          {!sent &&
            job.flags.map((f) => (
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
        <button
          type="button"
          className="toggle toggle-sent"
          aria-pressed={sent}
          onClick={onToggleSent}
          title={sent ? 'Fjern haken hvis du ikke har sendt søknad' : 'Marker at du har sendt søknad'}
        >
          <span className="toggle-box">{sent && <CheckIcon />}</span>
          Sendt
        </button>
        {sent && (
          <button
            type="button"
            className="toggle toggle-rejected"
            aria-pressed={rejected}
            onClick={onToggleRejected}
            title={rejected ? 'Angre avslag' : 'Marker at du fikk avslag'}
          >
            <span className="toggle-box">{rejected && <CrossIcon />}</span>
            Avslag
          </button>
        )}
        <button type="button" className="ghost note-button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Lukk' : note ? 'Endre notat' : 'Notat'}
        </button>
      </div>
    </li>
  );
}
