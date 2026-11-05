import { describe, expect, it } from 'vitest';
import abakus from './fixtures/abakus.json';
import itdagene from './fixtures/itdagene.json';
import navAd from './fixtures/nav-ad.json';
import { parseAbakus } from '../scripts/sources/abakus.ts';
import { parseItdagene } from '../scripts/sources/itdagene.ts';
import { isCandidateTitle, parseNavAd } from '../scripts/sources/nav.ts';
import { assess, classify, isIt } from '../scripts/relevance.ts';
import { mergeJobs, sameJob } from '../scripts/merge.ts';
import { containsWord, toIsoDate } from '../shared/text.ts';
import { isHidden } from '../shared/types.ts';

const NOW = new Date('2026-10-30T12:00:00Z');

describe('text', () => {
  it('tolker frister i norsk tid', () => {
    expect(toIsoDate('2026-11-29T22:59:00Z')).toBe('2026-11-29');
    expect(toIsoDate('15.12.2026')).toBe('2026-12-15');
    expect(toIsoDate('Snarest')).toBeNull();
  });

  it('matcher korte ord bare som hele ord', () => {
    expect(containsWord('Sommerjobb IT', 'it')).toBe(true);
    expect(containsWord('Italia og item', 'it')).toBe(false);
    expect(containsWord('Systemutvikler', 'utvikl')).toBe(false);
    expect(containsWord('Utvikler backend', 'utvikl')).toBe(true);
  });
});

describe('classify', () => {
  it('skiller sommerjobb, winternship og faste stillinger', () => {
    expect(classify({ title: 'Sommerjobb Hemit 2027', typeHint: 'summer_job' })).toBe('summer');
    expect(classify({ title: 'Winternship 26/27', typeHint: 'part_time' })).toBe('winter');
    expect(classify({ title: 'Nyutdannet Software Engineer', typeHint: 'summer_job' })).toBeNull();
    expect(classify({ title: 'Utvikler (deltid)', typeHint: 'part_time' })).toBeNull();
    expect(classify({ title: 'Software Developer', typeHint: 'full_time' })).toBeNull();
  });
});

describe('kilder', () => {
  it('parser Abakus', () => {
    const jobs = parseAbakus(abakus);
    expect(jobs[0]).toMatchObject({
      source: 'abakus',
      company: 'Aker BP',
      deadline: '2026-11-29',
      fromYear: 4,
      url: 'https://abakus.no/joblistings/2664-sommerstudent-2027-subsurface-data-science',
    });
  });

  it('parser itDAGENE og hopper over inaktive', () => {
    const jobs = parseItdagene(itdagene);
    expect(jobs).toHaveLength(7);
    expect(jobs[0].typeHint).toBe('summer_job');
    expect(jobs.find((j) => j.sourceId === 'jotron-rd-engineers-2026')?.typeHint).toBe('full_time');
  });

  it('parser NAV-annonser og forhåndsfiltrerer titler', () => {
    const job = parseNavAd(navAd.uuid, navAd)!;
    expect(job).toMatchObject({ company: 'Eksempel Kraft AS', deadline: '2026-12-15', locations: ['Oslo'] });
    expect(job.text).toContain('4. året');
    expect(job.categories).toContain('IT');
    expect(isCandidateTitle('Sommerstudent IT-sikkerhet')).toBe(true);
    expect(isCandidateTitle('Summer Internship 2027')).toBe(true);
    expect(isCandidateTitle('Sommervikar renhold')).toBe(false);
    expect(isCandidateTitle('Rådgiver internasjonal utveksling')).toBe(false);
    expect(isCandidateTitle('Daglig leder')).toBe(false);
    expect(isCandidateTitle('Graduate Program 2027')).toBe(false);
  });

  it('tar bare med IT-stillinger fra NAV', () => {
    const nav = (title: string, categories: string[] = []) => ({ source: 'nav' as const, title, categories });
    expect(isIt(nav('Sommerstudent', ['IT', 'Utvikling']))).toBe(true);
    expect(isIt(nav('Sommerjobb utvikler backend'))).toBe(true);
    expect(isIt(nav('Sommerjobb 2027 – festivalvektere', ['Vekter, sikkerhet']))).toBe(false);
    expect(isIt(nav('2 pedagogiske ledere i Sommerfryd', ['Utdanning', 'Barnehagelærer']))).toBe(false);
    expect(isIt({ source: 'abakus', title: 'Summer Internship 2027' })).toBe(true);
  });
});

describe('merge', () => {
  const raws = [
    ...parseAbakus(abakus),
    ...parseItdagene(itdagene),
    parseNavAd(navAd.uuid, navAd)!,
  ];
  const jobs = mergeJobs(raws, [], NOW);
  const find = (company: string, title?: string) =>
    jobs.filter((j) => j.company.toLowerCase().includes(company) && (!title || j.title.includes(title)));

  it('dropper faste stillinger, deltid og utløpte frister', () => {
    expect(find('thales')).toHaveLength(0);
    expect(find('tellme')).toHaveLength(0);
    expect(find('jotron')).toHaveLength(0);
    expect(find('sparebank')).toHaveLength(0); // frist 18. okt
  });

  it('slår sammen samme stilling fra flere kilder', () => {
    const vespa = find('vespa');
    expect(vespa).toHaveLength(1);
    expect(vespa[0].sources.map((s) => s.source)).toEqual(['abakus', 'itdagene']);
  });

  it('holder ulike stillinger hos samme firma adskilt', () => {
    expect(sameJob(
      { company: 'Mnemonic AS', title: 'mInternship: Security Consultant' },
      { company: 'Mnemonic AS', title: 'mInternship: Security Management Consultant' },
    )).toBe(false);
  });

  it('flagger årstrinn fra både felt og tekst', () => {
    expect(find('aker bp')[0].flags).toContain('year');
    expect(find('eksempel')[0].flags).toEqual(['year-maybe']); // bare tekst, skal vises
    expect(isHidden(find('eksempel')[0].flags)).toBe(false);
    expect(isHidden(find('aker bp')[0].flags)).toBe(true);
    expect(find('gintel')[0].flags).toEqual([]);
  });

  it('flagger ikke årstrinn når 3. året også er nevnt', () => {
    const base = { source: 'nav' as const, sourceId: 'x', url: 'https://x', company: 'BAMA Gruppen AS',
      title: 'Søk Summer Internship i BAMA!', locations: ['Oslo'], deadline: null, rolling: false, categories: ['IT'] };
    expect(assess({ ...base, text: 'Vi ser etter deg som er på 3. eller 4. året av utdanningen din' }, 'summer').flags)
      .not.toContain('year');
    expect(assess({ ...base, text: 'Du må gå 4. året' }, 'summer').flags).toEqual(['year-maybe']);
  });

  it('gjenbruker nøkler fra forrige kjøring', () => {
    const renamed = jobs.map((j) => ({ ...j, key: `old-${j.key}` }));
    const again = mergeJobs(raws, renamed, NOW);
    expect(again.every((j) => j.key.startsWith('old-'))).toBe(true);
  });
});
