import { useRef, useState, type FormEvent } from 'react';
import type { Job, JobKind } from '../../shared/types.ts';
import { slugify } from '../../shared/text.ts';
import { STATUSES, type Status } from '../store.ts';

interface Props {
  onAdd: (job: Job, status: Status) => void;
}

/** Skjema for å legge inn en stilling selv, f.eks. fra finn.no eller en karriereside. */
export function AddJobDialog({ onAdd }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const company = String(f.get('company')).trim();
    const title = String(f.get('title')).trim();
    const url = String(f.get('url')).trim();
    if (!company || !title) {
      setError('Fyll inn firma og stillingstittel.');
      return;
    }
    if (url && !/^https?:\/\//.test(url)) {
      setError('Lenken må starte med https://');
      return;
    }
    const now = new Date().toISOString();
    const deadline = String(f.get('deadline')) || null;
    const location = String(f.get('location')).trim();
    const job: Job = {
      key: `egen--${slugify(company)}--${slugify(title)}-${Date.now().toString(36)}`,
      company,
      title,
      kind: f.get('kind') as JobKind,
      locations: location ? [location] : [],
      deadline,
      rolling: !deadline,
      fromYear: null,
      toYear: null,
      sources: [{ source: 'manual', sourceId: 'manual', url }],
      flags: [],
      score: 100,
      firstSeen: now,
      lastSeen: now,
    };
    onAdd(job, f.get('status') as Status);
    e.currentTarget.reset();
    setError('');
    ref.current?.close();
  }

  return (
    <>
      <button type="button" className="primary" onClick={() => ref.current?.showModal()}>
        Legg til stilling
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby="add-title">
        <form onSubmit={submit}>
          <h2 id="add-title">Legg til stilling</h2>
          <p className="dialog-help">
            For annonser som ikke hentes automatisk, for eksempel fra finn.no eller en karriereside.
          </p>
          <label>
            Firma
            <input name="company" required autoComplete="off" />
          </label>
          <label>
            Stillingstittel
            <input name="title" required autoComplete="off" />
          </label>
          <label>
            Lenke til annonsen
            <input name="url" type="url" placeholder="https://www.finn.no/job/ad/..." />
          </label>
          <div className="dialog-grid">
            <label>
              Frist
              <input name="deadline" type="date" />
            </label>
            <label>
              Sted
              <input name="location" placeholder="Oslo" />
            </label>
            <label>
              Type
              <select name="kind" defaultValue="summer">
                <option value="summer">Sommer</option>
                <option value="winter">Winternship</option>
                <option value="internship">Internship</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="interessert">
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => ref.current?.close()}>
              Avbryt
            </button>
            <button type="submit" className="primary">
              Legg til
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
