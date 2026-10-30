import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job, JobFlag, JobKind, JobsFile } from '../shared/types.ts';
import { exportStore, importFile } from './backup.ts';
import { AddJobDialog } from './components/AddJobDialog.tsx';
import { Board } from './components/Board.tsx';
import { JobRow, SOURCE_NAMES } from './components/JobRow.tsx';
import { Timeline } from './components/Timeline.tsx';
import { timeAgo, todayIso } from './dates.ts';
import { STATUSES, type Status, useStore } from './store.ts';

type View = 'liste' | 'tavle';
type StatusFilter = Status | 'alle';

const FLAG_NAMES: Record<JobFlag, string> = {
  year: 'annet årstrinn',
  'not-it': 'usikker IT-match',
  location: 'annet sted',
};

export function App() {
  const store = useStore();
  const { data } = store;
  const [file, setFile] = useState<JobsFile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('liste');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');
  const [kind, setKind] = useState<JobKind | 'alle'>('alle');
  const [query, setQuery] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}jobs.json`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<JobsFile>;
      })
      .then(setFile)
      .catch(() => setLoadError('Fant ikke jobs.json. Kjør "npm run fetch" eller vent på neste daglige kjøring.'));
  }, []);

  /** Alle stillinger: hentede, egne, og fulgte stillinger som har forsvunnet fra kildene. */
  const allJobs = useMemo(() => {
    const fetched = file?.jobs ?? [];
    const keys = new Set(fetched.map((j) => j.key));
    const extra = [...data.manual, ...Object.values(data.tracked).map((t) => t.job)].filter((j) => {
      if (keys.has(j.key)) return false;
      keys.add(j.key);
      return true;
    });
    return [...fetched, ...extra];
  }, [file, data.manual, data.tracked]);

  const statusOf = (job: Job): Status => data.tracked[job.key]?.status ?? 'ny';
  const isTracked = (job: Job) => statusOf(job) !== 'ny';
  const today = todayIso();

  /** Stillinger som er aktuelle: ikke utløpt, eller fulgt av deg. */
  const relevant = allJobs.filter((j) => isTracked(j) || !j.deadline || j.deadline >= today);
  const flaggedHidden = relevant.filter((j) => j.flags.length > 0 && !isTracked(j));

  const counts = Object.fromEntries(
    STATUSES.map((s) => [
      s.id,
      relevant.filter((j) => statusOf(j) === s.id && (showFlagged || isTracked(j) || j.flags.length === 0)).length,
    ]),
  ) as Record<Status, number>;

  const q = query.trim().toLowerCase();
  const visible = relevant
    .filter((j) => showFlagged || isTracked(j) || j.flags.length === 0)
    .filter((j) => kind === 'alle' || j.kind === kind)
    .filter((j) => {
      const s = statusOf(j);
      return statusFilter === 'alle' ? s !== 'droppet' : s === statusFilter;
    })
    .filter((j) => !q || `${j.company} ${j.title} ${j.locations.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));

  const isNew = (j: Job) =>
    statusOf(j) === 'ny' && !!store.previousVisit && j.firstSeen > store.previousVisit;
  const newCount = visible.filter(isNew).length;

  function jumpTo(job: Job) {
    setView('liste');
    setHighlight(job.key);
    requestAnimationFrame(() =>
      document.getElementById(`job-${job.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
    window.setTimeout(() => setHighlight(null), 1800);
  }

  async function onImport(fileInput: File) {
    try {
      const { data: next, summary } = importFile(await fileInput.text(), data, allJobs);
      store.replace(next);
      setNotice(summary);
    } catch (err) {
      setNotice(`Kunne ikke importere: ${(err as Error).message}`);
    }
  }

  const failed = file?.sources.filter((s) => !s.ok) ?? [];

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>Jobbradar</h1>
          <p className="lede">
            Sommerjobber, winternships og internships for 2027, hentet daglig fra Abakus, itDAGENE og NAV.
          </p>
        </div>
        <div className="masthead-actions">
          <AddJobDialog onAdd={store.addManual} />
          <button type="button" className="ghost" onClick={() => exportStore(data)}>
            Eksporter
          </button>
          <button type="button" className="ghost" onClick={() => importRef.current?.click()}>
            Importer
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <p className="freshness">
        {file ? (
          <>
            Oppdatert {timeAgo(file.generatedAt)}.{' '}
            {failed.length > 0 &&
              `Klarte ikke å hente fra ${failed.map((s) => SOURCE_NAMES[s.id]).join(' og ')} sist, viser forrige data derfra. `}
            Status og notater lagres bare i denne nettleseren.
          </>
        ) : (
          loadError || 'Henter stillinger...'
        )}
      </p>

      {notice && (
        <p className="notice" role="status">
          {notice}{' '}
          <button type="button" className="link" onClick={() => setNotice('')}>
            Lukk
          </button>
        </p>
      )}

      <Timeline
        jobs={relevant.filter((j) => showFlagged || isTracked(j) || j.flags.length === 0)}
        statusOf={statusOf}
        onSelect={jumpTo}
      />

      <nav className="statusbar" aria-label="Filtrer på status">
        <button
          type="button"
          aria-pressed={statusFilter === 'alle'}
          onClick={() => setStatusFilter('alle')}
          title="Alle unntatt droppede"
        >
          Alle
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`status-${s.id}`}
            aria-pressed={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
          >
            {s.label} <span>{counts[s.id]}</span>
          </button>
        ))}
      </nav>

      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">Søk</span>
          <input
            type="search"
            placeholder="Søk etter firma, stilling eller sted"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="segmented" role="group" aria-label="Type">
          {(['alle', 'summer', 'winter', 'internship'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {{ alle: 'Alle', summer: 'Sommer', winter: 'Winternship', internship: 'Internship' }[k]}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Visning">
          {(['liste', 'tavle'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'liste' ? 'Liste' : 'Tavle'}
            </button>
          ))}
        </div>
      </div>

      {flaggedHidden.length > 0 && (
        <p className="hidden-note">
          {showFlagged ? 'Viser' : 'Skjuler'} {flaggedHidden.length}{' '}
          {flaggedHidden.length === 1 ? 'stilling som trolig ikke passer' : 'stillinger som trolig ikke passer'} (
          {summarizeFlags(flaggedHidden)}).{' '}
          <button type="button" className="link" onClick={() => setShowFlagged(!showFlagged)}>
            {showFlagged ? 'Skjul dem' : 'Vis dem likevel'}
          </button>
        </p>
      )}

      {view === 'liste' ? (
        <>
          {newCount > 0 && <p className="new-note">{newCount} nye siden forrige besøk.</p>}
          {visible.length === 0 ? (
            <p className="empty">
              {file ? 'Ingen stillinger matcher filtrene. Prøv å fjerne søket eller velge en annen status.' : ''}
            </p>
          ) : (
            <ul className="rows">
              {visible.map((job) => (
                <JobRow
                  key={job.key}
                  job={job}
                  status={statusOf(job)}
                  note={data.tracked[job.key]?.note ?? ''}
                  isNew={isNew(job)}
                  highlighted={highlight === job.key}
                  onStatus={(s) => store.setStatus(job, s)}
                  onNote={(n) => store.setNote(job, n)}
                  onRemove={
                    job.sources[0]?.source === 'manual' ? () => store.removeManual(job.key) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <Board jobs={relevant.filter(isTracked)} statusOf={statusOf} onStatus={store.setStatus} />
      )}

      <footer className="footer">
        Laget av Leon Cincovic. Kildekode på{' '}
        <a href="https://github.com/leonc67/jobbradar">GitHub</a>. Data fra Abakus, itDAGENE og NAV
        (arbeidsplassen.no, gjengitt etter NAVs API-vilkår).
      </footer>
    </div>
  );
}

function summarizeFlags(jobs: Job[]): string {
  const counts = new Map<JobFlag, number>();
  for (const j of jobs) for (const f of j.flags) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts].map(([f, n]) => `${n} ${FLAG_NAMES[f]}`).join(', ');
}
