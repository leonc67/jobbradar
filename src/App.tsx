import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job, JobFlag, JobKind, JobsFile } from '../shared/types.ts';
import { exportStore, importFile } from './backup.ts';
import { AddJobDialog } from './components/AddJobDialog.tsx';
import { JobRow, SOURCE_NAMES } from './components/JobRow.tsx';
import { timeAgo, todayIso } from './dates.ts';
import { useStore } from './store.ts';

type Filter = 'alle' | 'ikke-sendt' | 'sendt' | 'avslag';

const FILTER_TITLES: Record<Filter, string> = {
  alle: 'Alle stillinger',
  'ikke-sendt': 'Stillinger du ikke har søkt på',
  sendt: 'Alle søknader du har sendt',
  avslag: 'Søknader med avslag',
};

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
  const [filter, setFilter] = useState<Filter>('alle');
  const [kind, setKind] = useState<JobKind | 'alle'>('alle');
  const [query, setQuery] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
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

  const isSent = (job: Job) => Boolean(data.tracked[job.key]?.sent);
  const isRejected = (job: Job) => Boolean(data.tracked[job.key]?.rejected);
  const isTracked = (job: Job) => job.key in data.tracked;
  const today = todayIso();

  /** Stillinger som er aktuelle: ikke utløpt, eller fulgt av deg. */
  const relevant = allJobs.filter((j) => isTracked(j) || !j.deadline || j.deadline >= today);
  const flaggedHidden = relevant.filter((j) => j.flags.length > 0 && !isTracked(j));

  const matchesFilter = (j: Job, f: Filter) =>
    f === 'alle' ||
    (f === 'ikke-sendt' && !isSent(j)) ||
    (f === 'sendt' && isSent(j)) ||
    (f === 'avslag' && isRejected(j));

  const shown = relevant.filter((j) => showFlagged || isTracked(j) || j.flags.length === 0);
  const count = (f: Filter) => shown.filter((j) => matchesFilter(j, f)).length;

  const q = query.trim().toLowerCase();
  const visible = shown
    .filter((j) => kind === 'alle' || j.kind === kind)
    .filter((j) => matchesFilter(j, filter))
    .filter((j) => !q || `${j.company} ${j.title} ${j.locations.join(' ')}`.toLowerCase().includes(q))
    // Løpende frister (uten dato) øverst, deretter nærmeste frist først
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));

  const isNew = (j: Job) => !isTracked(j) && !!store.previousVisit && j.firstSeen > store.previousVisit;
  const newCount = shown.filter(isNew).length;
  const pick = (f: Filter) => setFilter((current) => (current === f ? 'alle' : f));

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
            Hakene og notatene dine lagres bare i denne nettleseren.
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

      <nav className="summary" aria-label="Oversikt. Trykk for å filtrere">
        <button type="button" className="tile tile-sent" aria-pressed={filter === 'sendt'} onClick={() => pick('sendt')}>
          <strong>{count('sendt')}</strong>
          <span>sendt</span>
        </button>
        <button type="button" className="tile tile-rejected" aria-pressed={filter === 'avslag'} onClick={() => pick('avslag')}>
          <strong>{count('avslag')}</strong>
          <span>avslag</span>
        </button>
        <button type="button" className="tile tile-open" aria-pressed={filter === 'ikke-sendt'} onClick={() => pick('ikke-sendt')}>
          <strong>{count('ikke-sendt')}</strong>
          <span>
            ledige stillinger
            {newCount > 0 && <em>{newCount} nye siden sist</em>}
          </span>
        </button>
      </nav>

      <div className="list-head">
        <h2>{FILTER_TITLES[filter]}</h2>
        {filter !== 'alle' && (
          <button type="button" className="link" onClick={() => setFilter('alle')}>
            Vis alle
          </button>
        )}
      </div>

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

      {visible.length === 0 ? (
        <p className="empty">
          {file ? 'Ingen stillinger her. Prøv å fjerne søket eller velge et annet filter.' : ''}
        </p>
      ) : (
        <ul className="rows">
          {visible.map((job) => (
            <JobRow
              key={job.key}
              job={job}
              sent={isSent(job)}
              rejected={isRejected(job)}
              note={data.tracked[job.key]?.note ?? ''}
              isNew={isNew(job)}
              highlighted={false}
              onToggleSent={() => store.toggleSent(job)}
              onToggleRejected={() => store.toggleRejected(job)}
              onNote={(n) => store.setNote(job, n)}
              onRemove={job.sources[0]?.source === 'manual' ? () => store.removeManual(job.key) : undefined}
            />
          ))}
        </ul>
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
