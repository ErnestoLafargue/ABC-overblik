import type {
  CommissionConfig,
  CommissionModel,
  Customer,
  Settings,
} from '../types';
import { monthKey } from './dates';

/**
 * Provisionsmotor.
 *
 * Forretningsregler:
 * - Kun kunder med status='godkendt' bidrager til provision.
 * - Provision beregnes p\u00e5 m\u00e5nedsbasis ud fra et set af kunder.
 * - "Fri kunde / Churn"-flag giver +churnBonusPct % ekstra p\u00e5 den enkelte
 *   kundes non-bil omsa\u00e6tning, oven i modellens beregning.
 *
 * Fuld provision:
 *   provision = (sum non-bil) * generalPct + (sum bil) * carPct
 *
 * Fastl\u00f8n med t\u00e6rskel:
 *   - Bil betaler altid basePct.
 *   - Non-bil splittes:
 *       under t\u00e6rsklen: betaler basePct
 *       over t\u00e6rsklen: betaler aboveThresholdPct
 *     hvor "under t\u00e6rsklen" = max(0, threshold - sum bil) for det samlede
 *     m\u00e5neds non-bil.
 *
 * I begge modeller:
 *   churnBonus = sum (non-bil for churn-kunder) * churnBonusPct
 *   total = provision + churnBonus + fixedSalary
 */

export type SalaryBreakdown = {
  model: CommissionModel;
  /** Antal godkendte kunder med i beregningen */
  approvedCount: number;
  /** Sum af samletOmsaetning for godkendte kunder */
  approvedRevenue: number;
  /** Sum af bil-omsa\u00e6tning for godkendte kunder */
  approvedCarRevenue: number;
  /** Sum af non-bil omsa\u00e6tning for godkendte kunder */
  approvedNonCarRevenue: number;
  /** Modellens base-provision (uden churn og fastl\u00f8n) */
  baseCommission: number;
  /** Andel af base-provision der stammer fra over-t\u00e6rskel non-bil (kun fastl\u00f8n) */
  thresholdBonus: number;
  /** Sum af churn-bonus p\u00e5 tv\u00e6rs af kunder */
  churnBonus: number;
  /** Fastl\u00f8n der l\u00e6gges oveni */
  fixedSalary: number;
  /** Endelig l\u00f8n = baseCommission + churnBonus + fixedSalary */
  total: number;
};

export const EMPTY_BREAKDOWN: Omit<SalaryBreakdown, 'model'> = {
  approvedCount: 0,
  approvedRevenue: 0,
  approvedCarRevenue: 0,
  approvedNonCarRevenue: 0,
  baseCommission: 0,
  thresholdBonus: 0,
  churnBonus: 0,
  fixedSalary: 0,
  total: 0,
};

function nonCar(c: Customer): number {
  return Math.max(0, c.samletOmsaetning - Math.max(0, c.bilOmsaetning));
}

function carRev(c: Customer): number {
  return Math.max(0, c.bilOmsaetning);
}

function customerEntries(customer: Customer): Array<{
  totalRevenue: number;
  carRevenue: number;
}> {
  if (customer.revenueEntries?.length) {
    return customer.revenueEntries.map((entry) => ({
      totalRevenue: Math.max(0, entry.totalRevenue),
      carRevenue: Math.max(0, entry.carRevenue),
    }));
  }
  return [
    {
      totalRevenue: Math.max(0, customer.samletOmsaetning),
      carRevenue: Math.max(0, customer.bilOmsaetning),
    },
  ];
}

/**
 * Beregner samlet l\u00f8n for et set af kunder under en given konfiguration.
 * Filtrerer selv p\u00e5 status='godkendt'.
 */
export function calculateMonthSalary(
  customers: Customer[],
  config: CommissionConfig,
): SalaryBreakdown {
  const approved = customers.filter((c) => c.status === 'godkendt');
  const approvedEntries = approved.flatMap((customer) =>
    customerEntries(customer).map((entry) => ({
      ...entry,
      friKundeChurn: customer.friKundeChurn,
    })),
  );

  const totalCar = approvedEntries.reduce((s, entry) => s + entry.carRevenue, 0);
  const totalNonCar = approvedEntries.reduce(
    (s, entry) => s + Math.max(0, entry.totalRevenue - entry.carRevenue),
    0,
  );
  const totalApproved = totalCar + totalNonCar;

  let baseCommission = 0;
  let thresholdBonus = 0;

  if (config.model === 'fuld_provision') {
    baseCommission =
      totalNonCar * (config.generalPct / 100) +
      totalCar * (config.carPct / 100);
  } else {
    // Fastl\u00f8n med t\u00e6rskel
    const carCommission = totalCar * (config.basePct / 100);
    const nonCarUnder = Math.min(
      totalNonCar,
      Math.max(0, config.threshold - totalCar),
    );
    const nonCarOver = Math.max(0, totalNonCar - nonCarUnder);
    const nonCarUnderCommission = nonCarUnder * (config.basePct / 100);
    const nonCarOverCommission = nonCarOver * (config.aboveThresholdPct / 100);
    baseCommission =
      carCommission + nonCarUnderCommission + nonCarOverCommission;
    // Den ekstra v\u00e6rdi tilskrevet over-t\u00e6rskel non-bil ift. base
    thresholdBonus =
      nonCarOver * ((config.aboveThresholdPct - config.basePct) / 100);
  }

  const churnNonCar = approvedEntries.reduce(
    (s, entry) =>
      entry.friKundeChurn ? s + Math.max(0, entry.totalRevenue - entry.carRevenue) : s,
    0,
  );
  const churnBonus = churnNonCar * (config.churnBonusPct / 100);

  return {
    model: config.model,
    approvedCount: approvedEntries.length,
    approvedRevenue: totalApproved,
    approvedCarRevenue: totalCar,
    approvedNonCarRevenue: totalNonCar,
    baseCommission,
    thresholdBonus,
    churnBonus,
    fixedSalary: config.fixedSalary,
    total: baseCommission + churnBonus + config.fixedSalary,
  };
}

/**
 * Beregner per-kunde "base contribution" (uden t\u00e6rskel-bonus og fastl\u00f8n).
 * Bruges som indikativ kolonne i kundetabellen.
 *
 * - Fuld provision: nonCar*generalPct + car*carPct + churn-bonus
 * - Fastl\u00f8n: nonCar*basePct + car*basePct + churn-bonus (uden t\u00e6rskel-bonus)
 *
 * Returnerer 0 hvis status \u2260 'godkendt'.
 */
export function calculateCustomerBaseSalary(
  customer: Customer,
  config: CommissionConfig,
): number {
  if (customer.status !== 'godkendt') return 0;
  const synthetic: Customer = {
    ...customer,
    revenueEntries: [],
  };
  return customerEntries(customer).reduce((sum, entry) => {
    synthetic.samletOmsaetning = entry.totalRevenue;
    synthetic.bilOmsaetning = entry.carRevenue;
    const nc = nonCar(synthetic);
    const car = carRev(synthetic);
    let base = 0;
    if (config.model === 'fuld_provision') {
      base = nc * (config.generalPct / 100) + car * (config.carPct / 100);
    } else {
      base = nc * (config.basePct / 100) + car * (config.basePct / 100);
    }
    const churn = customer.friKundeChurn ? nc * (config.churnBonusPct / 100) : 0;
    return sum + base + churn;
  }, 0);
}

/**
 * Udbetalingsm\u00e5neden er m\u00e5neden af `udbetalingsDato`.
 *
 * VIGTIGT: dette er IKKE samme som opstartsm\u00e5neden. udbetalingsDato er
 * l\u00e5st til 1. i (opstartsm\u00e5ned + 1) p\u00e5 grund af 14-dages fortrydelse +
 * administration, s\u00e5 en kunde solgt i maj med opstart 1. juli f\u00e5r f\u00f8rst
 * sin provision udbetalt 1. august og skal kun figurere i august-view.
 */
export function payoutMonthKey(udbetalingsDato: string): string {
  return monthKey(udbetalingsDato);
}

/** Returnerer override-konfiguration for en m\u00e5ned, ellers globale defaults. */
export function getCommissionForMonth(
  key: string,
  settings: Settings,
): CommissionConfig {
  return settings.monthly[key]?.commission ?? settings.defaultCommission;
}
