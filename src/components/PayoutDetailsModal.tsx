import { X } from 'lucide-react';
import { formatDate, formatDKK } from '../lib/format';

export type PayoutRow = {
  id: string;
  nordigoId: string;
  navn?: string;
  salgsDato: string;
  opstartsDato: string;
  udbetalingsDato: string;
  samletOmsaetning: number;
  bilOmsaetning: number;
  commissionAmount: number;
};

type Props = {
  open: boolean;
  monthLabel: string;
  rows: PayoutRow[];
  totalAmount: number;
  onClose: () => void;
};

export function PayoutDetailsModal({
  open,
  monthLabel,
  rows,
  totalAmount,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-6xl max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Til udbetaling – {monthLabel}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Luk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Ingen kunder til udbetaling i denne måned
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Nordigo-ID</th>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Salgsdato</th>
                  <th className="px-4 py-3">Opstartsdato</th>
                  <th className="px-4 py-3">Udbetalingsdato</th>
                  <th className="px-4 py-3 text-right">Samlet</th>
                  <th className="px-4 py-3 text-right">Bil</th>
                  <th className="px-4 py-3 text-right">Provision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="text-sm">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                      {r.nordigoId}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {r.navn || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(r.salgsDato)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(r.opstartsDato)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(r.udbetalingsDato)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                      {formatDKK(r.samletOmsaetning)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                      {r.bilOmsaetning > 0 ? formatDKK(r.bilOmsaetning) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatDKK(r.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 text-right dark:border-slate-800">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Total til udbetaling:
          </span>{' '}
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {formatDKK(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
