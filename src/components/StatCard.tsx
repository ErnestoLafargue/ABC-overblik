import type { ReactNode } from 'react';

type Props = {
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  onClick?: () => void;
  titleAttr?: string;
};

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
}: Props) {
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {value}
        </p>
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

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={titleAttr}
        className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-800 dark:bg-slate-900"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {content}
    </div>
  );
}
