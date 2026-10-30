const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

export function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date());
}

/** Antall hele dager fra i dag til datoen (negativt hvis passert). */
export function daysUntil(iso: string): number {
  const a = Date.parse(`${todayIso()}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const sameYear = y === Number(todayIso().slice(0, 4));
  return `${d}. ${MONTHS[m - 1]}${sameYear ? '' : ` ${y}`}`;
}

export function relativeDays(days: number): string {
  if (days < 0) return 'utløpt';
  if (days === 0) return 'i dag';
  if (days === 1) return 'i morgen';
  return `om ${days} dager`;
}

export type Urgency = 'passed' | 'urgent' | 'soon' | 'later' | 'none';

export function urgency(iso: string | null): Urgency {
  if (!iso) return 'none';
  const d = daysUntil(iso);
  if (d < 0) return 'passed';
  if (d <= 7) return 'urgent';
  if (d <= 21) return 'soon';
  return 'later';
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'i går' : `${days} dager siden`;
}
