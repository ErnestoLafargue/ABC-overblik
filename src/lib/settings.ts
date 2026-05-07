import type {
  CommissionConfig,
  Customer,
  MonthSettings,
  Settings,
} from '../types';
import { DEFAULT_COMMISSION } from '../types';
import { monthKey } from './dates';

const KEY = 'abc-oversigt:settings:v2';
const LEGACY_KEY = 'abc-oversigt:settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  defaultCommission: { ...DEFAULT_COMMISSION },
  monthly: {},
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Settings;
      return normaliseSettings(parsed);
    }
    // Fors\u00f8g blid migrering fra v1 (de gamle "rates" pr. m\u00e5ned)
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateFromV1(JSON.parse(legacy));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    return cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

function cloneDefaults(): Settings {
  return {
    defaultCommission: { ...DEFAULT_COMMISSION },
    monthly: {},
  };
}

function normaliseSettings(s: Partial<Settings>): Settings {
  return {
    defaultCommission: {
      ...DEFAULT_COMMISSION,
      ...(s.defaultCommission ?? {}),
    },
    monthly: s.monthly ?? {},
  };
}

type LegacyRates = { generalPct?: number; carPct?: number };
type LegacySettings = {
  defaultRates?: LegacyRates;
  monthly?: Record<
    string,
    { workingDays?: number; revenueGoal?: number; rates?: LegacyRates }
  >;
};

function migrateFromV1(v1: LegacySettings): Settings {
  const defaults: CommissionConfig = {
    ...DEFAULT_COMMISSION,
    generalPct: v1.defaultRates?.generalPct ?? DEFAULT_COMMISSION.generalPct,
    carPct: v1.defaultRates?.carPct ?? DEFAULT_COMMISSION.carPct,
  };
  const monthly: Record<string, MonthSettings> = {};
  for (const [k, v] of Object.entries(v1.monthly ?? {})) {
    monthly[k] = {
      workingDays: v.workingDays,
      revenueGoal: v.revenueGoal,
      commission: v.rates
        ? {
            ...defaults,
            generalPct: v.rates.generalPct ?? defaults.generalPct,
            carPct: v.rates.carPct ?? defaults.carPct,
          }
        : undefined,
    };
  }
  return { defaultCommission: defaults, monthly };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function getMonthSettings(
  key: string,
  settings: Settings,
): MonthSettings {
  return settings.monthly[key] ?? {};
}

/**
 * "Frys" tidligere m\u00e5neder n\u00e5r en ny default gemmes.
 *
 * For alle m\u00e5neder f\u00f8r `selectedMonth` der har kunder men ingen
 * eksisterende `commission`-override, l\u00e6gges `oldDefault` ind som
 * eksplicit override. P\u00e5 den m\u00e5de \u00e6ndrer en ny default ikke
 * historiske beregninger.
 *
 * Returnerer en ny `monthly`-record. Muterer ikke input.
 */
export function freezePastMonths(
  monthly: Record<string, MonthSettings>,
  customers: Customer[],
  selectedMonth: string,
  oldDefault: CommissionConfig,
): Record<string, MonthSettings> {
  const monthsWithCustomers = new Set<string>();
  for (const c of customers) {
    if (!c.salgsDato) continue;
    monthsWithCustomers.add(monthKey(c.salgsDato));
  }

  const next: Record<string, MonthSettings> = { ...monthly };
  for (const mk of monthsWithCustomers) {
    if (mk >= selectedMonth) continue;
    const existing = next[mk];
    if (existing?.commission) continue;
    next[mk] = { ...(existing ?? {}), commission: { ...oldDefault } };
  }
  return next;
}
