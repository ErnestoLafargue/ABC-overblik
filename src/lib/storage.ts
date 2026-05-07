import type { Customer, CustomerStatus, NewCustomer } from '../types';
import { ALLOWED_TRANSITIONS } from '../types';
import { defaultOpstartsDato, udbetalingsFromOpstart } from './dates';
import { seedCustomers } from './seed';

const KEY = 'abc-oversigt:customers:v5';
const LEGACY_V4 = 'abc-oversigt:customers:v4';
const LEGACY_V3 = 'abc-oversigt:customers:v3';
const LEGACY_V2 = 'abc-oversigt:customers:v2';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Customer[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normaliseCustomer);
    }

    const v4 = localStorage.getItem(LEGACY_V4);
    if (v4) {
      const migrated = migrateFromV4(JSON.parse(v4));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }

    const v3 = localStorage.getItem(LEGACY_V3);
    if (v3) {
      const migrated = migrateFromV3(JSON.parse(v3));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }

    const v2 = localStorage.getItem(LEGACY_V2);
    if (v2) {
      const migrated = migrateFromV2(JSON.parse(v2));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }

    const seeded = seedCustomers();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

type V4Customer = Omit<Customer, 'opstartsDato'>;
type V3Customer = Omit<Customer, 'opstartsDato' | 'udbetalingsDato'> & {
  oprettelsesDato?: string;
};
type V2Customer = Omit<
  Customer,
  'opstartsDato' | 'udbetalingsDato' | 'friKundeChurn'
> & {
  oprettelsesDato?: string;
};

function migrateFromV4(arr: V4Customer[]): Customer[] {
  return arr.map((c) => {
    // V4's `udbetalingsDato` var i virkeligheden den nye opstartsdato
    // (1. i salgs+2). Vi promoverer den til opstartsDato og afleder
    // den nye udbetalingsdato (1. i opstart+1).
    const opstartsDato =
      c.udbetalingsDato || defaultOpstartsDato(c.salgsDato || '');
    return normaliseCustomer({
      ...c,
      opstartsDato,
      udbetalingsDato: udbetalingsFromOpstart(opstartsDato),
    } as Customer);
  });
}

function migrateFromV3(arr: V3Customer[]): Customer[] {
  return arr.map((c) => {
    const opstartsDato = defaultOpstartsDato(c.salgsDato || '');
    return normaliseCustomer({
      ...c,
      opstartsDato,
      udbetalingsDato: udbetalingsFromOpstart(opstartsDato),
    } as Customer);
  });
}

function migrateFromV2(arr: V2Customer[]): Customer[] {
  return arr.map((c) => {
    const opstartsDato = defaultOpstartsDato(c.salgsDato || '');
    return normaliseCustomer({
      ...c,
      friKundeChurn: false,
      opstartsDato,
      udbetalingsDato: udbetalingsFromOpstart(opstartsDato),
    } as Customer);
  });
}

function normaliseCustomer(c: Customer): Customer {
  const opstartsDato =
    c.opstartsDato || defaultOpstartsDato(c.salgsDato || '');
  const expectedUdbetaling = udbetalingsFromOpstart(opstartsDato);
  return {
    ...c,
    friKundeChurn: !!c.friKundeChurn,
    bilOmsaetning: Number(c.bilOmsaetning) || 0,
    samletOmsaetning: Number(c.samletOmsaetning) || 0,
    opstartsDato,
    udbetalingsDato: c.udbetalingsDato || expectedUdbetaling,
  };
}

export function saveCustomers(customers: Customer[]): void {
  localStorage.setItem(KEY, JSON.stringify(customers));
}

export function createCustomer(data: NewCustomer): Customer {
  return {
    ...data,
    id: uid(),
    status: data.status ?? 'oprettelse',
    oprettetAt: new Date().toISOString(),
  };
}

export function clearAll(): void {
  localStorage.removeItem(KEY);
}

export function canTransition(
  from: CustomerStatus,
  to: CustomerStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
