import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import type { CommissionConfig, Customer, CustomerStatus } from '../types';
import { formatDKK, formatDate } from '../lib/format';
import { calculateCustomerBaseSalary } from '../lib/commission';
import { StatusDropdown } from './StatusDropdown';

type Props = {
  customers: Customer[];
  commission: CommissionConfig;
  onEdit: (c: Customer) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, next: CustomerStatus) => void;
};

export function CustomerTable({
  customers,
  commission,
  onEdit,
  onDelete,
  onStatusChange,
}: Props) {
  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          Ingen kunder for denne måned. Tryk "Ny kunde" for at oprette en.
        </p>
      </div>
    );
  }

  const isFastloen = commission.model === 'fastloen';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Nordigo-ID</th>
              <th className="px-4 py-3">Navn</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Salg</th>
              <th
                className="px-4 py-3"
                title="Kunden g\u00e5r i drift den 1. i (salgsm\u00e5ned + 2). Provision udbetales m\u00e5neden efter."
              >
                Opstart
              </th>
              <th className="px-4 py-3 text-right">Samlet</th>
              <th className="px-4 py-3 text-right">Bil</th>
              <th
                className="px-4 py-3 text-right"
                title={
                  isFastloen
                    ? 'Base-bidrag ved 5%. M\u00e5nedens t\u00e6rskel-bonus vises i KPI-kortene.'
                    : 'Provision ved valgte satser inkl. evt. churn-bonus.'
                }
              >
                Bidrag
              </th>
              <th className="px-4 py-3 text-right">Handlinger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {customers.map((c) => {
              const base = calculateCustomerBaseSalary(c, commission);
              return (
                <tr
                  key={c.id}
                  className="text-sm transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                      {c.nordigoId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                      {c.navn || (
                        <span className="text-slate-400">—</span>
                      )}
                      {c.friKundeChurn && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                          title="Fri kunde / Churn — +5% bonus på non-bil"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Churn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {c.email || c.telefon || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDropdown
                      value={c.status}
                      onChange={(next) => onStatusChange(c.id, next)}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {formatDate(c.salgsDato)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {formatDate(c.opstartsDato)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatDKK(c.samletOmsaetning)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">
                    {c.bilOmsaetning > 0 ? formatDKK(c.bilOmsaetning) : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-right font-semibold ${
                      c.status === 'godkendt'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                    title={
                      c.status === 'godkendt' && isFastloen
                        ? 'Bidrag ved base-sats. M\u00e5nedens t\u00e6rskel-bonus l\u00e6gges oveni samlet.'
                        : undefined
                    }
                  >
                    {c.status === 'godkendt' ? formatDKK(base) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onEdit(c)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        title="Rediger"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Slet kunde ${c.nordigoId}?`))
                            onDelete(c.id);
                        }}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                        title="Slet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
