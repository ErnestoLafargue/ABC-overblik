import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Customer } from '../types';
import { STATUS_LABELS } from '../types';
import { formatDKK } from '../lib/format';
import { daysInMonth, parseMonthKey } from '../lib/dates';

type Props = { customers: Customer[]; monthKey: string };

const STATUS_PIE_COLORS: Record<string, string> = {
  'Under oprettelse': '#f59e0b',
  Godkendt: '#10b981',
  Afvist: '#f43f5e',
  Annulleret: '#cbd5e1',
};

/** Bar chart: daglig omsaætning i den valgte måned (alle lukkede salg). */
export function DailyRevenueChart({ customers, monthKey }: Props) {
  const total = daysInMonth(monthKey);
  const buckets = new Array(total).fill(0) as number[];

  for (const c of customers) {
    const d = new Date(c.salgsDato);
    const day = d.getDate();
    if (day >= 1 && day <= total) {
      buckets[day - 1] += c.samletOmsaetning;
    }
  }

  const data = buckets.map((value, i) => ({
    dag: String(i + 1),
    Omsætning: Math.round(value),
  }));

  const hasData = buckets.some((v) => v > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
        Daglig omsætning
      </h3>
      {!hasData ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Ingen omsætning denne måned.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dag" stroke="#64748b" fontSize={11} interval={2} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) =>
                  formatDKK(v as number).replace(',00', '')
                }
                width={80}
              />
              <Tooltip
                formatter={(v: number) => formatDKK(v)}
                labelFormatter={(label) => formatDayLabel(label, monthKey)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="Omsætning"
                fill="#7c3aed"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function formatDayLabel(day: string | number, monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month - 1, Number(day));
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

type StatusPieDatum = {
  name: string;
  value: number;
  revenue: number;
};

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StatusPieDatum; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, revenue } = payload[0].payload;
  const color =
    payload[0].color ?? STATUS_PIE_COLORS[name] ?? '#94a3b8';
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
      style={{ fontSize: 13 }}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span style={{ color }} className="font-medium">
          {name}
        </span>
        <span className="text-slate-700 dark:text-slate-200">
          {value} ({formatDKK(revenue)})
        </span>
      </span>
    </div>
  );
}

export function StatusChart({
  customers,
  onClick,
}: {
  customers: Customer[];
  onClick?: () => void;
}) {
  const byStatus = new Map<string, { count: number; revenue: number }>();
  for (const c of customers) {
    const label = STATUS_LABELS[c.status];
    const current = byStatus.get(label) ?? { count: 0, revenue: 0 };
    byStatus.set(label, {
      count: current.count + 1,
      revenue: current.revenue + c.samletOmsaetning,
    });
  }
  const data: StatusPieDatum[] = Array.from(byStatus.entries()).map(
    ([name, { count, revenue }]) => ({
      name,
      value: count,
      revenue,
    }),
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30'
          : ''
      }`}
    >
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
        Status-fordeling
      </h3>
      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Ingen data endnu.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_PIE_COLORS[entry.name] ?? '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip content={<StatusTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
