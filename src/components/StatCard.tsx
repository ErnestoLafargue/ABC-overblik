import { useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';

type Props = {
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  onClick?: () => void;
  titleAttr?: string;
  /** Skjul beløb indtil musen holdes over kortet */
  sensitive?: boolean;
};

function SensitiveValue({
  value,
  isRevealed,
}: {
  value: ReactNode;
  isRevealed: boolean;
}) {
  return (
    <div className="mt-1 inline-grid min-w-[130px] text-2xl font-semibold tracking-tight">
      <span
        className={`col-start-1 row-start-1 transition-all duration-200 ${
          isRevealed
            ? 'opacity-100 blur-0 text-slate-900 dark:text-slate-50'
            : 'opacity-0 blur-sm text-slate-900/20 dark:text-slate-50/20'
        }`}
        aria-hidden={!isRevealed}
      >
        {value}
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
  );
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-slate-50 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  brand: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = 'default',
  onClick,
  titleAttr,
  sensitive = false,
}: Props) {
  const [isRevealed, setIsRevealed] = useState(false);

  const hoverHandlers = sensitive
    ? {
        onMouseEnter: () => setIsRevealed(true),
        onMouseLeave: () => setIsRevealed(false),
      }
    : {};

  const resolvedTitle =
    titleAttr ?? (sensitive ? 'Hold musen over for at se beløb' : undefined);

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {sensitive ? (
          <SensitiveValue value={value} isRevealed={isRevealed} />
        ) : (
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </p>
        )}
        {hint && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${TONE[tone]}`}
      >
        {icon}
      </div>
    </div>
  );

  const cardCls =
    'w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-800 dark:bg-slate-900';

  if (onClick || sensitive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={resolvedTitle}
        className={cardCls}
        {...hoverHandlers}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      {...hoverHandlers}
    >
      {content}
    </div>
  );
}
