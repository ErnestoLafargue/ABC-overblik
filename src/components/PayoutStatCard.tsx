import { useState } from 'react';
import { Coins, Eye } from 'lucide-react';

type Props = {
  amount: string;
  hint: string;
  onClick?: () => void;
};

export function PayoutStatCard({ amount, hint, onClick }: Props) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setIsRevealed(true)}
      onMouseLeave={() => setIsRevealed(false)}
      onClick={onClick}
      title="Hold musen over for at se beløb"
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Til udbetaling
          </p>

          <div className="mt-1 inline-grid min-w-[130px] text-2xl font-semibold tracking-tight">
            <span
              className={`col-start-1 row-start-1 transition-all duration-200 ${
                isRevealed
                  ? 'opacity-100 blur-0 text-slate-900 dark:text-slate-50'
                  : 'opacity-0 blur-sm text-slate-900/20 dark:text-slate-50/20'
              }`}
              aria-hidden={!isRevealed}
            >
              {amount}
            </span>
            <span
              className={`col-start-1 row-start-1 flex items-center gap-2 transition-all duration-200 ${
                isRevealed
                  ? 'opacity-0 blur-sm text-slate-900/20 dark:text-slate-50/20'
                  : 'opacity-100 blur-0 text-slate-900 dark:text-slate-50'
              }`}
              aria-hidden={isRevealed}
            >
              ••••• kr.
              <Eye className="h-4 w-4 text-slate-400" />
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <Coins className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}
