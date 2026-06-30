import { X } from 'lucide-react';
import { formatDKK } from '../lib/format';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type CustomerStatus,
} from '../types';

export type StatusDetailCustomer = {
  id: string;
  nordigoId: string;
  navn?: string;
  samletOmsaetning: number;
  bilOmsaetning: number;
  friKundeChurn: boolean;
  indicativeCommission: number;
};

export type StatusDetailRow = {
  status: CustomerStatus;
  count: number;
  revenue: number;
  carRevenue: number;
  commissionImpact: number;
  description: string;
  customers: StatusDetailCustomer[];
};

type Props = {
  open: boolean;
  monthLabel: string;
  rows: StatusDetailRow[];
  totalRevenue: number;
  totalCommissionImpact: number;
  onClose: () => void;
};

export function StatusDetailsModal({
  open,
  monthLabel,
  rows,
  totalRevenue,
  totalCommissionImpact,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-8 py-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Status-detaljer – {monthLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Provision viser marginal påvirkning uden fastløn, beregnet med månedens satser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Luk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-8 py-6 dark:bg-slate-950/30">
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => (
              <article
                key={row.status}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        STATUS_COLORS[row.status]
                      }`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {row.description}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {row.count} kunder
                  </p>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Omsætning
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatDKK(row.revenue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Bil
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.carRevenue > 0 ? formatDKK(row.carRevenue) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Provision
                    </p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatDKK(row.commissionImpact)}
                    </p>
                  </div>
                </div>

                {row.customers.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <th className="px-3 py-2">Kunde</th>
                          <th className="px-3 py-2 text-right">Omsætning</th>
                          <th className="px-3 py-2 text-right">Indikativ prov.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {row.customers.map((customer) => (
                          <tr key={customer.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {customer.navn || 'Ukendt navn'}
                              </p>
                              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                {customer.nordigoId}
                                {customer.friKundeChurn ? ' · Churn' : ''}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                              {formatDKK(customer.samletOmsaetning)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                              {formatDKK(customer.indicativeCommission)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Ingen kunder med denne status i måneden.
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-8 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Samlet omsætning</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDKK(totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Samlet provisionspåvirkning
              </p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatDKK(totalCommissionImpact)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
