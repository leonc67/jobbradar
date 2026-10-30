/** Typer som deles mellom henteskriptet (scripts/) og nettsiden (src/). */

export type SourceId = 'abakus' | 'itdagene' | 'nav' | 'manual';

export type JobKind = 'summer' | 'winter' | 'internship';

/** Grunner til at en stilling er nedprioritert. Nettsiden skjuler disse som standard. */
export type JobFlag =
  | 'year' // passer ikke ditt årstrinn (f.eks. krever 4. år)
  | 'not-it' // ser ikke ut som en IT-stilling
  | 'location'; // ligger utenfor stedene i config

export interface SourceRef {
  source: SourceId;
  sourceId: string;
  url: string;
}

export interface Job {
  /** Stabil nøkkel. Brukes til å koble status i nettleseren mot stillingen. */
  key: string;
  company: string;
  title: string;
  kind: JobKind;
  locations: string[];
  /** ISO-dato (YYYY-MM-DD) eller null hvis ukjent */
  deadline: string | null;
  rolling: boolean;
  fromYear: number | null;
  toYear: number | null;
  sources: SourceRef[];
  flags: JobFlag[];
  /** 0-100, høyere er bedre match */
  score: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SourceStatus {
  id: SourceId;
  ok: boolean;
  count: number;
  error?: string;
}

export interface JobsFile {
  generatedAt: string;
  sources: SourceStatus[];
  jobs: Job[];
}

/** Rådata fra en kilde, før sammenslåing og scoring. */
export interface RawJob {
  source: SourceId;
  sourceId: string;
  url: string;
  company: string;
  title: string;
  /** Hint fra kilden om stillingstype, f.eks. "summer_job" eller "SI" */
  typeHint?: string;
  locations: string[];
  deadline: string | null;
  rolling: boolean;
  fromYear?: number | null;
  toYear?: number | null;
  /** Fritekst brukt til å se etter krav om årstrinn */
  text?: string;
  /** Yrkeskategorier fra kilden (NAV), brukt til å avgjøre om det er IT */
  categories?: string[];
}
