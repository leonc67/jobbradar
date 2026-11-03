import { useCallback, useEffect, useState } from 'react';
import type { Job } from '../shared/types.ts';

/** Det du har gjort med en stilling: sendt søknad, og eventuelt fått avslag. */
export interface Tracked {
  sent: boolean;
  rejected: boolean;
  note: string;
  updatedAt: string;
  /** Kopi av stillingen, så den vises selv etter at annonsen er borte fra kildene. */
  job: Job;
}

export interface StoreData {
  version: 2;
  tracked: Record<string, Tracked>;
  /** Stillinger lagt inn for hånd, f.eks. fra finn.no */
  manual: Job[];
  lastVisit: string | null;
}

/** Eldre versjon med en statusliste (Ny, Interessert, Sendt, Avslag osv.). */
interface LegacyTracked {
  status: string;
  note: string;
  updatedAt: string;
  job: Job;
}

const SENT_STATUSES = ['sendt', 'intervju', 'tilbud', 'avslag'];

/** Gjør om gamle statuser til hake for sendt og kryss for avslag. */
export function fromLegacyStatus(status: string | undefined): { sent: boolean; rejected: boolean } {
  return { sent: SENT_STATUSES.includes(status ?? ''), rejected: status === 'avslag' };
}

export function migrate(raw: unknown): StoreData | null {
  const data = raw as { version?: number; tracked?: Record<string, unknown>; manual?: Job[]; lastVisit?: string | null };
  if (!data || typeof data !== 'object') return null;
  if (data.version === 2) return { ...empty(), ...(data as StoreData) };
  if (data.version !== 1) return null;

  const tracked: Record<string, Tracked> = {};
  for (const [key, value] of Object.entries(data.tracked ?? {})) {
    const old = value as LegacyTracked;
    const { sent, rejected } = fromLegacyStatus(old.status);
    if (!sent && !old.note) continue;
    tracked[key] = { sent, rejected, note: old.note ?? '', updatedAt: old.updatedAt, job: old.job };
  }
  const keep = new Set(Object.keys(tracked));
  return {
    version: 2,
    tracked,
    manual: (data.manual ?? []).filter((j) => keep.has(j.key)),
    lastVisit: data.lastVisit ?? null,
  };
}

const KEY = 'jobbradar:v1';
const empty = (): StoreData => ({ version: 2, tracked: {}, manual: [], lastVisit: null });

function load(): StoreData {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && migrate(JSON.parse(raw))) || empty();
  } catch {
    return empty();
  }
}

function save(data: StoreData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Privat modus eller full lagring: siden fungerer, men husker ikke endringer
  }
}

export function useStore() {
  const [data, setData] = useState<StoreData>(load);
  /** Tidspunktet for forrige besøk, brukt til å markere nye stillinger. */
  const [previousVisit] = useState(() => data.lastVisit);

  useEffect(() => {
    setData((d) => ({ ...d, lastVisit: new Date().toISOString() }));
  }, []);

  useEffect(() => save(data), [data]);

  /** Oppdaterer én stilling, og glemmer den hvis det ikke er noe igjen å huske. */
  const update = useCallback((job: Job, change: (t: Tracked) => Tracked) => {
    setData((d) => {
      const prev = d.tracked[job.key] ?? { sent: false, rejected: false, note: '', updatedAt: '', job };
      const next = { ...change(prev), updatedAt: new Date().toISOString(), job: prev.job };
      const tracked = { ...d.tracked };
      if (!next.sent && !next.note) delete tracked[job.key];
      else tracked[job.key] = next;
      return { ...d, tracked };
    });
  }, []);

  const toggleSent = useCallback(
    (job: Job) => update(job, (t) => ({ ...t, sent: !t.sent, rejected: t.sent ? false : t.rejected })),
    [update],
  );

  const toggleRejected = useCallback(
    (job: Job) => update(job, (t) => ({ ...t, rejected: t.sent && !t.rejected })),
    [update],
  );

  const setNote = useCallback((job: Job, note: string) => update(job, (t) => ({ ...t, note })), [update]);

  const addManual = useCallback((job: Job, sent: boolean) => {
    setData((d) => ({
      ...d,
      manual: [...d.manual, job],
      tracked: {
        ...d.tracked,
        [job.key]: { sent, rejected: false, note: '', updatedAt: new Date().toISOString(), job },
      },
    }));
  }, []);

  const removeManual = useCallback((key: string) => {
    setData((d) => {
      const tracked = { ...d.tracked };
      delete tracked[key];
      return { ...d, manual: d.manual.filter((j) => j.key !== key), tracked };
    });
  }, []);

  const replace = useCallback((next: StoreData) => setData(next), []);

  return { data, previousVisit, toggleSent, toggleRejected, setNote, addManual, removeManual, replace };
}
