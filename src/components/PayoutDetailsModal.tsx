import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, X } from 'lucide-react';
import { formatDate, formatDKK } from '../lib/format';
import { STATUS_COLORS, STATUS_LABELS, type CustomerStatus } from '../types';

export type PayoutEntryRow = {
  id: string;
  label?: string;
  salgsDato: string;
  opstartsDato: string;
  udbetalingsDato: string;
  samletOmsaetning: number;
  bilOmsaetning: number;
  commissionAmount: number;
};

export type PayoutCustomerRow = {
  customerId: string;
  nordigoId: string;
  navn?: string;
  email?: string;
  telefon?: string;
  status: CustomerStatus;
  noter?: string;
  entries: PayoutEntryRow[];
  totalRevenue: number;
  totalCarRevenue: number;
  totalCommission: number;
};

type Props = {
  open: boolean;
  monthLabel: string;
  rows: PayoutCustomerRow[];
  totalCustomers: number;
  totalRevenue: number;
  totalCarRevenue: number;
  totalCommission: number;
  fixedSalaryAmount: number;
  fixedSalaryMonthLabel: string;
  totalAmount: number;
  onEditCustomer: (customerId: string) => void;
  onClose: () => void;
};

export function PayoutDetailsModal({
  open,
  monthLabel,
  rows,
  totalCustomers,
  totalRevenue,
  totalCarRevenue,
  totalCommission,
  fixedSalaryAmount,
  fixedSalaryMonthLabel,
  totalAmount,
  onEditCustomer,
  onClose,
}: Props) {
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const hasRows = rows.length > 0;
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        (a.entries[0]?.udbetalingsDato ?? '') < (b.entries[0]?.udbetalingsDato ?? '')
          ? 1
          : -1,
      ),
    [rows],
  );
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
              Til udbetaling – {monthLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Satser beregnes pr. salgsmåned. Fastløn hentes én gang fra {fixedSalaryMonthLabel}.
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
          {!hasRows ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
              Ingen kunder til udbetaling i denne måned
            </div>
          ) : (
            <div className="space-y-4">
              {sortedRows.map((row) => {
                const hasNotes = Boolean(row.noter?.trim());
                const notesExpanded = expandedNotes[row.customerId] ?? false;
                const notesPreview =
                  row.noter && row.noter.length > 160
                    ? `${row.noter.slice(0, 160)}...`
                    : row.noter;
                return (
                  <article
                    key={row.customerId}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {row.navn || 'Ukendt navn'}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                              STATUS_COLORS[row.status]
                            }`}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                          Nordigo-ID: {row.nordigoId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditCustomer(row.customerId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4" />
                        Indstillinger
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div className="space-y-1 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Kontakt
                        </p>
                        <p className="text-slate-700 dark:text-slate-200">
                          {row.telefon || '—'}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          {row.email || '—'}
                        </p>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Datoer
                        </p>
                        {row.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
                          >
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {entry.label || 'Omsætningslinje'}
                            </p>
                            <p className="text-slate-700 dark:text-slate-200">
                              Salgsdato: {formatDate(entry.salgsDato)}
                            </p>
                            <p className="text-slate-700 dark:text-slate-200">
                              Opstartsdato: {formatDate(entry.opstartsDato)}
                            </p>
                            <p className="text-slate-700 dark:text-slate-200">
                              Udbetalingsdato: {formatDate(entry.udbetalingsDato)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1">
                        <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Samlet omsætning
                          </p>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatDKK(row.totalRevenue)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Bil omsætning
                          </p>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.totalCarRevenue > 0 ? formatDKK(row.totalCarRevenue) : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            Provision
                          </p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatDKK(row.totalCommission)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Noter
                        </p>
                        {hasNotes && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedNotes((prev) => ({
                                ...prev,
                                [row.customerId]: !notesExpanded,
                              }))
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                          >
                            {notesExpanded ? (
                              <>
                                Skjul noter
                                <ChevronUp className="h-3.5 w-3.5" />
                              </>
                            ) : (
                              <>
                                Læs noter
                                <ChevronDown className="h-3.5 w-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                        {hasNotes ? (notesExpanded ? row.noter : notesPreview) : 'Ingen noter'}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-8 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Kunder</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {totalCustomers}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total omsætning</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDKK(totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total bil omsætning</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDKK(totalCarRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Provision</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDKK(totalCommission)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fastløn ({fixedSalaryMonthLabel})
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDKK(fixedSalaryAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total til udbetaling</p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatDKK(totalAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
