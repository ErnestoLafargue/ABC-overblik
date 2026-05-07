import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  Customer,
  CustomerStatus,
  NewCustomer,
  Settings,
} from './types';
import { COMMISSION_MODEL_LABELS, STATUS_LABELS } from './types';
import {
  canTransition,
  createCustomer,
  loadCustomers,
} from './lib/storage';
import {
  DEFAULT_SETTINGS,
  freezePastMonths,
  loadSettings,
} from './lib/settings';
import { loadRemoteState, saveRemoteState } from './lib/api';
import { seedCustomers } from './lib/seed';
import {
  calculateMonthSalary,
  getCommissionForMonth,
  payoutMonthKey,
} from './lib/commission';
import {
  addMonthsToKey,
  currentMonthKey,
  isInMonth,
  monthKey as toMonthKey,
  monthLabel,
  weekdaysElapsed,
  weekdaysInMonth,
} from './lib/dates';
import { formatDKK } from './lib/format';
import { StatCard } from './components/StatCard';
import { CustomerTable } from './components/CustomerTable';
import { CustomerForm } from './components/CustomerForm';
import { DailyRevenueChart, StatusChart } from './components/Charts';
import { MonthSwitcher } from './components/MonthSwitcher';
import {
  MonthSettingsPanel,
  type SaveScope,
} from './components/MonthSettingsPanel';

type Filter = 'alle' | CustomerStatus;

const STATUS_FILTERS: Filter[] = [
  'alle',
  'oprettelse',
  'godkendt',
  'afvist',
  'annulleret',
];

function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());
  const [filter, setFilter] = useState<Filter>('alle');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [payoutJumpFromMonth, setPayoutJumpFromMonth] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const remote = await loadRemoteState();
        if (cancelled) return;
        setCustomers(remote.customers ?? seedCustomers());
        setSettings(remote.settings ?? DEFAULT_SETTINGS);
        setSyncError(null);
      } catch {
        if (cancelled) return;
        // Local fallback keeps app usable if API/DB is down.
        setCustomers(loadCustomers());
        setSettings(loadSettings());
        setSyncError('Kunne ikke forbinde til Neon. Viser lokale data.');
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const timeout = window.setTimeout(() => {
      saveRemoteState({ customers, settings })
        .then(() => setSyncError(null))
        .catch(() =>
          setSyncError('Kunne ikke gemme i Neon. Prøv igen om lidt.'),
        );
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [customers, settings, isHydrated]);

  /** Kunder hvor SALGSDATO er i den valgte måned. */
  const monthCustomers = useMemo(
    () => customers.filter((c) => isInMonth(c.salgsDato, selectedMonth)),
    [customers, selectedMonth],
  );

  const monthCommission = useMemo(
    () => getCommissionForMonth(selectedMonth, settings),
    [selectedMonth, settings],
  );

  const breakdown = useMemo(
    () => calculateMonthSalary(monthCustomers, monthCommission),
    [monthCustomers, monthCommission],
  );

  /**
   * "Til udbetaling denne måned":
   *   For hver kunde med payoutMonthKey(udbetalingsDato) == selectedMonth,
   *   grupper efter salgs-måned og anvend dén måneds settings.
   */
  const payoutBreakdown = useMemo(() => {
    const eligible = customers.filter(
      (c) =>
        c.status === 'godkendt' &&
        payoutMonthKey(c.udbetalingsDato) === selectedMonth,
    );
    const bySalesMonth = new Map<string, Customer[]>();
    for (const c of eligible) {
      const k = toMonthKey(c.salgsDato);
      const arr = bySalesMonth.get(k) ?? [];
      arr.push(c);
      bySalesMonth.set(k, arr);
    }
    let total = 0;
    let count = 0;
    for (const [k, group] of bySalesMonth) {
      const cfg = getCommissionForMonth(k, settings);
      const b = calculateMonthSalary(group, cfg);
      total += b.total;
      count += b.approvedCount;
    }
    return { total, count };
  }, [customers, settings, selectedMonth]);

  const filteredTable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthCustomers
      .filter((c) => filter === 'alle' || c.status === filter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.nordigoId.toLowerCase().includes(q) ||
          (c.navn ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.telefon ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.salgsDato < b.salgsDato ? 1 : -1));
  }, [monthCustomers, filter, search]);

  const goalStats = useMemo(() => {
    const ms = settings.monthly[selectedMonth] ?? {};
    const goal = ms.revenueGoal ?? 0;
    const workingDaysTotal = ms.workingDays ?? weekdaysInMonth(selectedMonth);

    const activeRevenue = monthCustomers
      .filter((c) => c.status !== 'afvist' && c.status !== 'annulleret')
      .reduce((s, c) => s + c.samletOmsaetning, 0);

    const isCurrentMonth = selectedMonth === currentMonthKey();
    const elapsed = isCurrentMonth
      ? Math.min(workingDaysTotal, weekdaysElapsed(selectedMonth))
      : workingDaysTotal;
    const remainingDays = Math.max(0, workingDaysTotal - elapsed);
    const remainingRevenue = Math.max(0, goal - activeRevenue);
    const avgPerDay = elapsed > 0 ? activeRevenue / elapsed : 0;
    const requiredPerDay =
      remainingDays > 0 ? remainingRevenue / remainingDays : 0;
    const goalProgress = goal > 0 ? Math.min(1, activeRevenue / goal) : 0;

    return {
      goal,
      workingDaysTotal,
      elapsed,
      remainingDays,
      remainingRevenue,
      avgPerDay,
      requiredPerDay,
      goalProgress,
      activeRevenue,
    };
  }, [monthCustomers, settings, selectedMonth]);

  const counts = useMemo(() => {
    return {
      total: monthCustomers.length,
      godkendt: monthCustomers.filter((c) => c.status === 'godkendt').length,
      oprettelse: monthCustomers.filter((c) => c.status === 'oprettelse')
        .length,
      afvist: monthCustomers.filter((c) => c.status === 'afvist').length,
      annulleret: monthCustomers.filter((c) => c.status === 'annulleret')
        .length,
    };
  }, [monthCustomers]);

  function handleSubmit(data: NewCustomer, id?: string) {
    if (id) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const nextStatus = data.status ?? c.status;
          if (nextStatus !== c.status && !canTransition(c.status, nextStatus)) {
            return { ...c, ...data, status: c.status };
          }
          return { ...c, ...data, status: nextStatus };
        }),
      );
    } else {
      setCustomers((prev) => [createCustomer(data), ...prev]);
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleStatusChange(id: string, next: CustomerStatus) {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (!canTransition(c.status, next)) return c;
        return { ...c, status: next };
      }),
    );
  }

  function handleDelete(id: string) {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  function handlePayoutCardClick() {
    const payoutMonth = selectedMonth;
    setSelectedMonth(addMonthsToKey(payoutMonth, -3));
    setPayoutJumpFromMonth(payoutMonth);
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setPayoutJumpFromMonth(null);
  }

  function handleSettingsSave(next: Settings, scope: SaveScope) {
    if (scope === 'as_default') {
      const oldDefault = settings.defaultCommission;
      const monthlyWithFrozen = freezePastMonths(
        next.monthly,
        customers,
        selectedMonth,
        oldDefault,
      );
      setSettings({ ...next, monthly: monthlyWithFrozen });
    } else {
      setSettings(next);
    }
    setSettingsOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-bold text-white shadow-md">
              A
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                ABC-oversigt
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kunder, omsætning og din løn
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSwitcher value={selectedMonth} onChange={handleMonthChange} />
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <SettingsIcon className="h-4 w-4" />
              Månedsindstillinger
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Ny kunde
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {syncError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            {syncError}
          </div>
        )}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Lukkede kunder"
            value={counts.total}
            hint={`${counts.godkendt} godkendt · ${counts.oprettelse} undervejs · ${counts.afvist} afvist`}
            tone="brand"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Omsætning"
            value={formatDKK(goalStats.activeRevenue)}
            hint={`Heraf godkendt: ${formatDKK(breakdown.approvedRevenue)}`}
            tone="default"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Provision optjent"
            value={formatDKK(breakdown.total)}
            hint={`Model: ${COMMISSION_MODEL_LABELS[monthCommission.model]}${settings.monthly[selectedMonth]?.commission ? ' (override)' : ''}`}
            tone="success"
            icon={<Wallet className="h-5 w-5" />}
          />
          <StatCard
            title="Til udbetaling"
            value={formatDKK(payoutBreakdown.total)}
            hint={`${payoutBreakdown.count} godkendt · Opstart ${monthLabel(addMonthsToKey(selectedMonth, -1))}`}
            tone="warning"
            icon={<Coins className="h-5 w-5" />}
            onClick={handlePayoutCardClick}
            titleAttr="Gå til salgsmåneden der skaber denne udbetaling"
          />
        </section>

        {payoutJumpFromMonth && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            Viser salg der skaber udbetaling i{' '}
            {monthLabel(payoutJumpFromMonth).toLowerCase()}.
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Månedsmål
                </h3>
              </div>
              {goalStats.goal === 0 && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                >
                  Sæt et mål →
                </button>
              )}
            </div>

            {goalStats.goal > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Mini
                    label="Mål"
                    value={formatDKK(goalStats.goal)}
                    hint={`${goalStats.workingDaysTotal} arbejdsdage`}
                  />
                  <Mini
                    label="Opnået"
                    value={formatDKK(goalStats.activeRevenue)}
                    hint={`${Math.round(goalStats.goalProgress * 100)}% af mål`}
                  />
                  <Mini
                    label="Mangler"
                    value={formatDKK(goalStats.remainingRevenue)}
                    hint={`${goalStats.remainingDays} dage tilbage`}
                  />
                  <Mini
                    label="Krævet pr. dag"
                    value={
                      goalStats.remainingRevenue === 0
                        ? 'Mål nået'
                        : goalStats.remainingDays === 0
                          ? '—'
                          : formatDKK(goalStats.requiredPerDay)
                    }
                    hint={`Snit nu: ${formatDKK(goalStats.avgPerDay)}/dag`}
                  />
                </div>
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        goalStats.goalProgress >= 1
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                      }`}
                      style={{ width: `${goalStats.goalProgress * 100}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Intet mål sat. Åbn{' '}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                >
                  Månedsindstillinger
                </button>{' '}
                for at definere arbejdsdage og mål.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Provision-detaljer
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Mini
                label="Godkendt omsætning"
                value={formatDKK(breakdown.approvedRevenue)}
                hint={`${breakdown.approvedCount} godkendte kunder`}
              />
              <Mini
                label="Base-provision"
                value={formatDKK(breakdown.baseCommission)}
                hint={
                  monthCommission.model === 'fastloen'
                    ? `Inkl. ${formatDKK(breakdown.thresholdBonus)} bonus over tærskel`
                    : `${monthCommission.generalPct}% / ${monthCommission.carPct}%`
                }
              />
              <Mini
                label="Churn-bonus"
                value={formatDKK(breakdown.churnBonus)}
                hint={`+${monthCommission.churnBonusPct}% på Fri kunde-non-bil`}
              />
              <Mini
                label="Fastløn"
                value={formatDKK(breakdown.fixedSalary)}
                hint="Lægges altid oveni"
              />
            </div>
            {monthCommission.model === 'fastloen' &&
              breakdown.thresholdBonus > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-violet-50 p-2.5 text-xs text-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <div>
                    Tærsklen på {formatDKK(monthCommission.threshold)} er
                    passeret — non-bil over giver{' '}
                    {monthCommission.aboveThresholdPct}% i stedet for{' '}
                    {monthCommission.basePct}%.
                  </div>
                </div>
              )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DailyRevenueChart
              customers={monthCustomers}
              monthKey={selectedMonth}
            />
          </div>
          <div>
            <StatusChart customers={monthCustomers} />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    filter === f
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800'
                  }`}
                >
                  {f === 'alle' ? 'Alle' : STATUS_LABELS[f]}
                  <span className="ml-1.5 opacity-70">
                    {f === 'alle'
                      ? counts.total
                      : monthCustomers.filter((c) => c.status === f).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg Nordigo-ID, navn, email..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <CustomerTable
            customers={filteredTable}
            commission={monthCommission}
            onEdit={(c) => {
              setEditing(c);
              setFormOpen(true);
            }}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        </section>

        <footer className="mt-10 pb-6 text-center text-xs text-slate-400">
          ABC-oversigt · Data gemmes i Neon database
        </footer>
      </main>

      <CustomerForm
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
      <MonthSettingsPanel
        open={settingsOpen}
        monthKey={selectedMonth}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
      />
    </div>
  );
}

function Mini({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {hint && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export default App;
