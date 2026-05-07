export type CustomerStatus =
  | 'oprettelse'
  | 'godkendt'
  | 'afvist'
  | 'annulleret';

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  oprettelse: 'Under oprettelse',
  godkendt: 'Godkendt',
  afvist: 'Afvist',
  annulleret: 'Annulleret',
};

export const STATUS_COLORS: Record<CustomerStatus, string> = {
  oprettelse: 'bg-amber-100 text-amber-800 ring-amber-200',
  godkendt: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  afvist: 'bg-rose-100 text-rose-800 ring-rose-200',
  annulleret: 'bg-slate-200 text-slate-600 ring-slate-300',
};

export const ALLOWED_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
  oprettelse: ['oprettelse', 'godkendt', 'afvist', 'annulleret'],
  godkendt: ['oprettelse', 'godkendt', 'afvist', 'annulleret'],
  afvist: ['oprettelse', 'godkendt', 'afvist', 'annulleret'],
  annulleret: ['oprettelse', 'godkendt', 'afvist', 'annulleret'],
};

export type RevenueEntry = {
  id: string;
  label: string;
  totalRevenue: number;
  carRevenue: number;
  saleDate: string;
  startDate: string;
  payoutDate: string;
};

export type Customer = {
  id: string;
  /** Nordigo-ID \u2014 obligatorisk identifikator */
  nordigoId: string;
  navn?: string;
  email?: string;
  telefon?: string;
  /** Dato salget blev lukket (yyyy-mm-dd) \u2014 driver "denne m\u00e5ned"-filter */
  salgsDato: string;
  /**
   * Dato kunden g\u00e5r i drift (yyyy-mm-dd).
   * Default: 1. i (salgsm\u00e5ned + 2). Kan rykkes manuelt.
   * Vises i tabel/card som "Opstart".
   */
  opstartsDato: string;
  /**
   * Dato hvor provisionen udbetales (yyyy-mm-dd).
   * L\u00e5st: 1. i (opstartm\u00e5ned + 1) \u2014 14 dages fortrydelse + administration.
   * Driver payoutMonthKey() og dermed "Til udbetaling"-KPI'en.
   */
  udbetalingsDato: string;
  /** Samlet omsa\u00e6tning i DKK (inkl. evt. bil) */
  samletOmsaetning: number;
  /** Bil-andel af omsa\u00e6tningen (\u2264 samletOmsaetning) */
  bilOmsaetning: number;
  status: CustomerStatus;
  /** Fri kunde / Churn \u2014 giver +churnBonusPct ekstra p\u00e5 non-bil for denne kunde */
  friKundeChurn: boolean;
  noter?: string;
  /** ISO timestamp for hvorn\u00e5r r\u00e6kken blev oprettet i appen */
  oprettetAt: string;
  revenueEntries: RevenueEntry[];
};

export type NewCustomer = Omit<Customer, 'id' | 'oprettetAt' | 'status'> & {
  status?: CustomerStatus;
};

/**
 * Provisionsmodel:
 * - 'fuld_provision': non-bil og bil har hver sin sats; flad fastl\u00f8n
 * - 'fastloen': base-sats p\u00e5 alt; non-bil over en given tærskel f\u00e5r boost-sats
 */
export type CommissionModel = 'fuld_provision' | 'fastloen';

export const COMMISSION_MODEL_LABELS: Record<CommissionModel, string> = {
  fuld_provision: 'Fuld provision',
  fastloen: 'Fastl\u00f8n',
};

/**
 * Samlet konfiguration for provisionsberegningen.
 * Felter der ikke er relevante for den valgte model ignoreres ved beregning,
 * men gemmes s\u00e5 brugeren ikke mister deres v\u00e6rdier ved skift.
 */
export type CommissionConfig = {
  model: CommissionModel;
  /** Fastl\u00f8n der altid l\u00e6gges oveni i kr/m\u00e5ned */
  fixedSalary: number;
  /** Ekstra % p\u00e5 non-bil n\u00e5r kunden er markeret som "Fri kunde / Churn" */
  churnBonusPct: number;

  // \u2014\u2014 Fuld provision \u2014\u2014
  /** Sats for non-bil (fx 15%) */
  generalPct: number;
  /** Sats for bil (fx 5%) */
  carPct: number;

  // \u2014\u2014 Fastl\u00f8n \u2014\u2014
  /** Base-sats p\u00e5 alt (fx 5%) */
  basePct: number;
  /** Boost-sats p\u00e5 non-bil over t\u00e6rsklen (fx 10%) */
  aboveThresholdPct: number;
  /** T\u00e6rskelv\u00e6rdi i DKK (fx 300000) */
  threshold: number;
};

export const DEFAULT_COMMISSION: CommissionConfig = {
  model: 'fuld_provision',
  fixedSalary: 30000,
  churnBonusPct: 5,
  generalPct: 15,
  carPct: 5,
  basePct: 5,
  aboveThresholdPct: 10,
  threshold: 300000,
};

export type MonthSettings = {
  workingDays?: number;
  revenueGoal?: number;
  /** Optional override af globale provisionsindstillinger for denne m\u00e5ned */
  commission?: CommissionConfig;
};

export type Settings = {
  defaultCommission: CommissionConfig;
  /** N\u00f8gle = "yyyy-mm" */
  monthly: Record<string, MonthSettings>;
};
