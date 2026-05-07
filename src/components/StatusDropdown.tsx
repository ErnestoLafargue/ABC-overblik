import { ChevronDown } from 'lucide-react';
import {
  ALLOWED_TRANSITIONS,
  STATUS_COLORS,
  STATUS_LABELS,
  type CustomerStatus,
} from '../types';

type Props = {
  value: CustomerStatus;
  onChange: (next: CustomerStatus) => void;
  className?: string;
};

/**
 * Inline status-v\u00e6lger der kun tilbyder gyldige overg\u00e5nge.
 * Bruger native <select> med en farvet badge-look.
 */
export function StatusDropdown({ value, onChange, className }: Props) {
  const allowed = ALLOWED_TRANSITIONS[value];
  const colorCls = STATUS_COLORS[value];

  return (
    <span
      className={`relative inline-flex items-center gap-1 rounded-full pl-2.5 pr-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorCls} ${className ?? ''}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      <span className="pointer-events-none">{STATUS_LABELS[value]}</span>
      <ChevronDown className="pointer-events-none h-3 w-3 opacity-70" />
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as CustomerStatus;
          if (next !== value) onChange(next);
        }}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent opacity-0"
        aria-label="\u00c6ndr status"
      >
        {allowed.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </span>
  );
}
