import type { RawJob } from '../../shared/types.ts';
import { getJson } from '../http.ts';
import { toIsoDate } from '../../shared/text.ts';

/** Abakus (linjeforeningen for data og kommunikasjonsteknologi) har et åpent REST-API. */
const API = 'https://lego.abakus.no/api/v1/joblistings/';
const MAX_PAGES = 10;

export interface AbakusListing {
  id: number;
  title: string;
  slug: string;
  company: { name: string };
  deadline: string | null;
  jobType: string;
  workplaces: { town: string }[];
  fromYear: number | null;
  toYear: number | null;
  rollingRecruitment: boolean;
}

interface AbakusPage {
  next: string | null;
  results: AbakusListing[];
}

export function parseAbakus(listings: AbakusListing[]): RawJob[] {
  return listings.map((l) => ({
    source: 'abakus',
    sourceId: String(l.id),
    url: `https://abakus.no/joblistings/${l.slug}`,
    company: l.company.name.trim(),
    title: l.title.trim(),
    typeHint: l.jobType,
    locations: l.workplaces.map((w) => w.town),
    deadline: toIsoDate(l.deadline),
    rolling: l.rollingRecruitment,
    fromYear: l.fromYear,
    toYear: l.toYear,
  }));
}

export async function fetchAbakus(): Promise<RawJob[]> {
  const all: AbakusListing[] = [];
  let url: string | null = API;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const data: AbakusPage = await getJson<AbakusPage>(url);
    all.push(...data.results);
    url = data.next;
  }
  return parseAbakus(all);
}
