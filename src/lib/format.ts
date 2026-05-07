const dkk = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
});

const dkkPrecise = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 2,
});

const dato = new Intl.DateTimeFormat('da-DK', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDKK(value: number, precise = false): string {
  if (Number.isNaN(value)) return '\u2014';
  return precise ? dkkPrecise.format(value) : dkk.format(value);
}

export function formatDate(value?: string | null): string {
  if (!value) return '\u2014';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '\u2014';
  return dato.format(d);
}

const thousands = new Intl.NumberFormat('da-DK', {
  maximumFractionDigits: 0,
});

/**
 * Formatterer en numerisk v\u00e6rdi (eller raw digits-string) med
 * dansk tusinde-separator: 30000 \u2192 "30.000".
 * Returnerer tom streng hvis input ikke har nogle cifre.
 */
export function formatThousands(value: string | number): string {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return thousands.format(Number(digits));
}

/** Stripper alt der ikke er cifre. Bruges som onChange-parser for DKK-input. */
export function parseDigits(s: string): string {
  return s.replace(/[^\d]/g, '');
}
