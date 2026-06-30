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

export function StatusChart({ customers }: { customers: Customer[] }) {
  const counts = new Map<string, number>();
  for (const c of customers) {
    const label = STATUS_LABELS[c.status];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const data = Array.from(counts.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                }}
              />
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
