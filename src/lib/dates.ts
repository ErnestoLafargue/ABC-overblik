/**
 * Date helpers for ABC-oversigt.
 *
 * Dates are stored as `yyyy-mm-dd` strings (date-only, local Danish time).
 * Month keys are `yyyy-mm`.
 */

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

/** Adds N months to a yyyy-mm key, preserving the yyyy-mm format. */
export function addMonthsToKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKey(d);
}

/** Returns true if `iso` (yyyy-mm-dd) falls within the given month key. */
export function isInMonth(iso: string, key: string): boolean {
  return monthKey(iso) === key;
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 0).getDate();
}

/** Number of weekdays (Mon\u2013Fri) in the entire month. */
export function weekdaysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  const total = daysInMonth(key);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Number of weekdays (Mon\u2013Fri) elapsed in the month up to and including `today`.
 * If today is outside the month, returns:
 *   - 0 if month is in the future
 *   - weekdaysInMonth(key) if month is in the past
 */
export function weekdaysElapsed(key: string, today: Date = new Date()): number {
  const { year, month } = parseMonthKey(key);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  if (today < startOfMonth) return 0;
  if (today > endOfMonth) return weekdaysInMonth(key);

  let count = 0;
  for (let d = 1; d <= today.getDate(); d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const monthFmt = new Intl.DateTimeFormat('da-DK', {
  month: 'long',
  year: 'numeric',
});

const monthShortFmt = new Intl.DateTimeFormat('da-DK', {
  month: 'short',
  year: '2-digit',
});

export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  const label = monthFmt.format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthShortLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return monthShortFmt.format(new Date(year, month - 1, 1));
}

/**
 * Default opstartsdato = den 1. i (salgsm\u00e5ned + 2 m\u00e5neder).
 * Det er den dato kunden teknisk g\u00e5r i drift hos Nordigo.
 *
 * Eksempler:
 *   2026-05-18 \u2192 2026-07-01
 *   2026-01-18 \u2192 2026-03-01
 *   2026-11-30 \u2192 2027-01-01 (\u00e5rsskift h\u00e5ndteres af JS Date-overflow)
 *   2026-10-15 \u2192 2026-12-01
 *
 * Bygger p\u00e5 lokal-tid uden UTC-roundtrip s\u00e5 vi undg\u00e5r tidszone-skift.
 */
export function defaultOpstartsDato(salgsDato: string): string {
  if (!salgsDato) return '';
  const d = new Date(salgsDato);
  if (Number.isNaN(d.getTime())) return '';
  const result = new Date(d.getFullYear(), d.getMonth() + 2, 1);
  return toISODate(result);
}

/**
 * Udbetalingsdato = den 1. i (opstartm\u00e5ned + 1).
 * L\u00e5st kobling: l\u00f8nnen udbetales m\u00e5neden efter kunden er opstartet
 * (14 dages fortrydelsesfrist + administration).
 *
 * Eksempler:
 *   2026-03-01 \u2192 2026-04-01
 *   2026-07-01 \u2192 2026-08-01
 *   2026-12-01 \u2192 2027-01-01
 */
export function udbetalingsFromOpstart(opstartsDato: string): string {
  if (!opstartsDato) return '';
  const d = new Date(opstartsDato);
  if (Number.isNaN(d.getTime())) return '';
  const result = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return toISODate(result);
}

/**
 * Default udbetalingsdato = den 1. i (salgsm\u00e5ned + 3 m\u00e5neder).
 * Sammensat af opstart (salgs+2) + en m\u00e5neds udbetalingsforsinkelse.
 *
 * Eksempler:
 *   2026-01-18 \u2192 2026-04-01
 *   2026-05-18 \u2192 2026-08-01
 *   2026-11-30 \u2192 2027-02-01
 *   2026-10-15 \u2192 2027-01-01
 */
export function defaultUdbetalingsDato(salgsDato: string): string {
  return udbetalingsFromOpstart(defaultOpstartsDato(salgsDato));
}
