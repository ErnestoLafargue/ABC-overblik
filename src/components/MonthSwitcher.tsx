import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonthsToKey, currentMonthKey, monthLabel } from '../lib/dates';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function MonthSwitcher({ value, onChange }: Props) {
  const today = currentMonthKey();
  const isCurrent = value === today;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => onChange(addMonthsToKey(value, -1))}
        className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Forrige m\u00e5ned"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-[140px] px-3 text-center text-sm font-medium text-slate-900 dark:text-slate-100">
        {monthLabel(value)}
      </div>
      <button
        onClick={() => onChange(addMonthsToKey(value, 1))}
        className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="N\u00e6ste m\u00e5ned"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {!isCurrent && (
        <button
          onClick={() => onChange(today)}
          className="ml-1 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/50"
        >
          I dag
        </button>
      )}
    </div>
  );
}
