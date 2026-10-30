/** Små tekstverktøy brukt av kildene og relevansvurderingen. */

/** Gjør om ulike datoformater til YYYY-MM-DD (norsk tid), eller null. */
export function toIsoDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();

  // 15.11.2026 eller 15/11/2026
  const nor = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (nor) {
    const [, d, m, y] = nor;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  // Frister som "2026-11-29T22:59:00Z" betyr 29. november norsk tid, så vi konverterer
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(date);
}

/** Fjerner HTML-tagger og samler whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Små bokstaver, uten diakritiske tegn utenom æøå, og uten tegnsetting. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMPANY_NOISE = /\b(as|asa|hf|ks|kf|sa|ab|ltd|inc|norge|norway|group|gruppen|consulting)\b/g;

/** Normaliserer firmanavn så "Hemit HF" og "HEMIT" blir like. */
export function normalizeCompany(s: string): string {
  const withoutDomain = s.replace(/\.(ai|io|no|com|net)\b/gi, '');
  return normalize(withoutDomain).replace(COMPANY_NOISE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Sjekker om et ord finnes i teksten. Lange ord matcher som ordstart
 * ("utvikl" treffer "utvikler"), korte ord (3 tegn eller færre) må stå alene
 * så "it" ikke treffer "item" eller "Italia".
 */
export function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const end = word.length <= 3 ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}${end}`, 'iu').test(text);
}

const STOPWORDS = new Set([
  'i', 'og', 'for', 'til', 'hos', 'med', 'the', 'and', 'of', 'in', 'at', 'en', 'et',
  '2026', '2027', 'sommerjobb', 'summer', 'internship', 'intern', 'sommer', 'jobb',
]);

export function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

/** Jaccard-likhet mellom to titler, 0-1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export function slugify(s: string): string {
  return normalize(s)
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
