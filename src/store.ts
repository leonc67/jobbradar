import { useCallback, useEffect, useState } from 'react';
import type { Job } from '../shared/types.ts';

export const STATUSES = [
  { id: 'ny', label: 'Ny' },
  { id: 'interessert', label: 'Interessert' },
  { id: 'pabegynt', label: 'Påbegynt' },
  { id: 'sendt', label: 'Sendt' },
  { id: 'intervju', label: 'Intervju' },
  { id: 'tilbud', label: 'Tilbud' },
  { id: 'avslag', label: 'Avslag' },
  { id: 'droppet', label: 'Droppet' },
] as const;

export type Status = (typeof STATUSES)[number]['id'];

export const statusLabel = (s: Status) => STATUSES.find((x) => x.id === s)?.label ?? s;

export interface Tracked {
  status: Status;
  note: string;
  updatedAt: string;
  /** Kopi av stillingen, så den vises selv etter at annonsen er borte fra kildene. */
  job: Job;
}

export interface StoreData {
  version: 1;
  tracked: Record<string, Tracked>;
  /** Stillinger lagt inn for hånd, f.eks. fra finn.no */
  manual: Job[];
  lastVisit: string | null;
}

const KEY = 'jobbradar:v1';
const empty = (): StoreData => ({ version: 1, tracked: {}, manual: [], lastVisit: null });

function load(): StoreData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as StoreData;
    return data.version === 1 ? { ...empty(), ...data } : empty();
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

  const setStatus = useCallback((job: Job, status: Status) => {
    setData((d) => {
      const prev = d.tracked[job.key];
      const tracked = { ...d.tracked };
      if (status === 'ny' && !prev?.note) delete tracked[job.key];
      else tracked[job.key] = { status, note: prev?.note ?? '', updatedAt: new Date().toISOString(), job };
      return { ...d, tracked };
    });
  }, []);

  const setNote = useCallback((job: Job, note: string) => {
    setData((d) => {
      const prev = d.tracked[job.key];
      return {
        ...d,
        tracked: {
          ...d.tracked,
          [job.key]: { status: prev?.status ?? 'ny', note, updatedAt: new Date().toISOString(), job },
        },
      };
    });
  }, []);

  const addManual = useCallback((job: Job, status: Status) => {
    setData((d) => ({
      ...d,
      manual: [...d.manual, job],
      tracked: { ...d.tracked, [job.key]: { status, note: '', updatedAt: new Date().toISOString(), job } },
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

  return { data, previousVisit, setStatus, setNote, addManual, removeManual, replace };
}
