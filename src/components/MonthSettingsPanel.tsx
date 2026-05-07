import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CommissionConfig,
  CommissionModel,
  Settings,
} from '../types';
import { COMMISSION_MODEL_LABELS } from '../types';
import { monthLabel, weekdaysInMonth } from '../lib/dates';
import { Field, inputCls } from './Field';
import { NumberInput } from './NumberInput';

export type SaveScope = 'month_only' | 'as_default' | 'no_commission_change';

type Props = {
  open: boolean;
  monthKey: string;
  settings: Settings;
  onClose: () => void;
  onSave: (next: Settings, scope: SaveScope) => void;
};

type FormState = {
  workingDays: string;
  revenueGoal: string;

  model: CommissionModel;
  fixedSalary: string;
  churnBonusPct: string;
  generalPct: string;
  carPct: string;
  basePct: string;
  aboveThresholdPct: string;
  threshold: string;
};

function num(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function effectiveCommission(
  settings: Settings,
  monthKey: string,
): CommissionConfig {
  return settings.monthly[monthKey]?.commission ?? settings.defaultCommission;
}

function buildForm(settings: Settings, monthKey: string): FormState {
  const month = settings.monthly[monthKey] ?? {};
  const c = effectiveCommission(settings, monthKey);
  return {
    workingDays: month.workingDays?.toString() ?? '',
    revenueGoal: month.revenueGoal ? String(month.revenueGoal) : '',
    model: c.model,
    fixedSalary: c.fixedSalary ? String(c.fixedSalary) : '',
    churnBonusPct: c.churnBonusPct.toString(),
    generalPct: c.generalPct.toString(),
    carPct: c.carPct.toString(),
    basePct: c.basePct.toString(),
    aboveThresholdPct: c.aboveThresholdPct.toString(),
    threshold: c.threshold ? String(c.threshold) : '',
  };
}

function formToCommission(
  form: FormState,
  fallback: CommissionConfig,
): CommissionConfig {
  return {
    model: form.model,
    fixedSalary: num(form.fixedSalary) ?? 0,
    churnBonusPct: num(form.churnBonusPct) ?? fallback.churnBonusPct,
    generalPct: num(form.generalPct) ?? fallback.generalPct,
    carPct: num(form.carPct) ?? fallback.carPct,
    basePct: num(form.basePct) ?? fallback.basePct,
    aboveThresholdPct:
      num(form.aboveThresholdPct) ?? fallback.aboveThresholdPct,
    threshold: num(form.threshold) ?? fallback.threshold,
  };
}

function commissionEqual(a: CommissionConfig, b: CommissionConfig): boolean {
  return (
    a.model === b.model &&
    a.fixedSalary === b.fixedSalary &&
    a.churnBonusPct === b.churnBonusPct &&
    a.generalPct === b.generalPct &&
    a.carPct === b.carPct &&
    a.basePct === b.basePct &&
    a.aboveThresholdPct === b.aboveThresholdPct &&
    a.threshold === b.threshold
  );
}

export function MonthSettingsPanel({
  open,
  monthKey,
  settings,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    buildForm(settings, monthKey),
  );
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildForm(settings, monthKey));
      setScopeDialogOpen(false);
    }
  }, [open, settings, monthKey]);

  const baseline = useMemo(
    () => effectiveCommission(settings, monthKey),
    [settings, monthKey],
  );

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildSettings(scope: SaveScope): Settings {
    const monthData = { ...(settings.monthly[monthKey] ?? {}) };
    const wd = num(form.workingDays);
    const goal = num(form.revenueGoal);
    if (wd === undefined) delete monthData.workingDays;
    else monthData.workingDays = wd;
    if (goal === undefined) delete monthData.revenueGoal;
    else monthData.revenueGoal = goal;

    const newCommission = formToCommission(form, baseline);

    if (scope === 'month_only') {
      monthData.commission = newCommission;
      return {
        defaultCommission: settings.defaultCommission,
        monthly: { ...settings.monthly, [monthKey]: monthData },
      };
    }

    if (scope === 'as_default') {
      delete monthData.commission;
      return {
        defaultCommission: newCommission,
        monthly: { ...settings.monthly, [monthKey]: monthData },
      };
    }

    if (Object.keys(monthData).length === 0) {
      const { [monthKey]: _, ...rest } = settings.monthly;
      void _;
      return {
        defaultCommission: settings.defaultCommission,
        monthly: rest,
      };
    }
    return {
      defaultCommission: settings.defaultCommission,
      monthly: { ...settings.monthly, [monthKey]: monthData },
    };
  }

  function handleSave() {
    const newCommission = formToCommission(form, baseline);
    const commissionChanged = !commissionEqual(newCommission, baseline);

    if (!commissionChanged) {
      onSave(buildSettings('no_commission_change'), 'no_commission_change');
      return;
    }
    setScopeDialogOpen(true);
  }

  function chooseScope(scope: SaveScope) {
    onSave(buildSettings(scope), scope);
    setScopeDialogOpen(false);
  }

  const suggestedWorkdays = weekdaysInMonth(monthKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Månedsindstillinger
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {monthLabel(monthKey)}
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

        <div className="grid max-h-[70vh] gap-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
              Mål for {monthLabel(monthKey).toLowerCase()}
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Antal arbejdsdage"
                hint={`Forslag: ${suggestedWorkdays} hverdage`}
              >
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.workingDays}
                  onChange={(e) => update('workingDays', e.target.value)}
                  placeholder={String(suggestedWorkdays)}
                  className={inputCls}
                />
              </Field>
              <Field label="Månedsmål (DKK)" hint="Samlet omsætning">
                <NumberInput
                  value={form.revenueGoal}
                  onChange={(v) => update('revenueGoal', v)}
                  placeholder="fx 300.000"
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
              Provisionsmodel
            </h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Aktuelle satser for {monthLabel(monthKey).toLowerCase()}.
              Ved gem kan du vælge om ændringen kun gælder denne måned, eller
              skal være ny default fremover.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              {(['fuld_provision', 'fastloen'] as CommissionModel[]).map(
                (m) => (
                  <label
                    key={m}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                      form.model === m
                        ? 'border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/30 dark:text-violet-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="commission-model"
                      className="sr-only"
                      checked={form.model === m}
                      onChange={() => update('model', m)}
                    />
                    {COMMISSION_MODEL_LABELS[m]}
                  </label>
                ),
              )}
            </div>

            {form.model === 'fuld_provision' ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="Almindelig sats (%)" hint="Non-bil omsætning">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.generalPct}
                    onChange={(e) => update('generalPct', e.target.value)}
                    placeholder="15"
                    className={inputCls}
                  />
                </Field>
                <Field label="Bil sats (%)" hint="Bil-omsætning">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.carPct}
                    onChange={(e) => update('carPct', e.target.value)}
                    placeholder="5"
                    className={inputCls}
                  />
                </Field>
                <Field label="Fastløn (DKK)" hint="Lægges altid oveni">
                  <NumberInput
                    value={form.fixedSalary}
                    onChange={(v) => update('fixedSalary', v)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Base-sats (%)" hint="På alt op til tærskel">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.basePct}
                    onChange={(e) => update('basePct', e.target.value)}
                    placeholder="5"
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="Boost-sats (%)"
                  hint="På non-bil over tærskel"
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.aboveThresholdPct}
                    onChange={(e) =>
                      update('aboveThresholdPct', e.target.value)
                    }
                    placeholder="10"
                    className={inputCls}
                  />
                </Field>
                <Field label="Tærskel (DKK)" hint="Total godkendt omsætning">
                  <NumberInput
                    value={form.threshold}
                    onChange={(v) => update('threshold', v)}
                    placeholder="300.000"
                    className={inputCls}
                  />
                </Field>
                <Field label="Fastløn (DKK)" hint="Lægges altid oveni">
                  <NumberInput
                    value={form.fixedSalary}
                    onChange={(v) => update('fixedSalary', v)}
                    placeholder="30.000"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <Field
                label="Churn-bonus (%)"
                hint='+% på non-bil for kunder markeret som "Fri kunde / Churn"'
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.churnBonusPct}
                  onChange={(e) => update('churnBonusPct', e.target.value)}
                  placeholder="5"
                  className={inputCls}
                />
              </Field>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Annullér
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            Gem
          </button>
        </div>
      </div>

      {scopeDialogOpen && (
        <ScopeDialog
          monthKey={monthKey}
          onCancel={() => setScopeDialogOpen(false)}
          onChoose={chooseScope}
        />
      )}
    </div>
  );
}

type ScopeDialogProps = {
  monthKey: string;
  onCancel: () => void;
  onChoose: (scope: SaveScope) => void;
};

function ScopeDialog({ monthKey, onCancel, onChoose }: ScopeDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Hvor skal de nye satser gælde?
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Du har ændret provisionssatserne. Vælg om ændringen kun gælder
            denne måned, eller skal være ny default fremover (tidligere
            måneder fryses ved deres nuværende sats).
          </p>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <button
            type="button"
            onClick={() => onChoose('month_only')}
            className="group flex flex-col items-start gap-1 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-violet-500 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-violet-950/20"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Gem kun for {monthLabel(monthKey).toLowerCase()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Defaulten ændres ikke. Andre måneder beholder deres nuværende
              satser.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('as_default')}
            className="group flex flex-col items-start gap-1 rounded-xl border border-violet-300 bg-violet-50/50 px-4 py-3 text-left transition hover:border-violet-500 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/20"
          >
            <span className="text-sm font-semibold text-violet-900 dark:text-violet-100">
              Gem som ny default fremover
            </span>
            <span className="text-xs text-violet-700/80 dark:text-violet-300/80">
              Tidligere måneder fryses ved deres nuværende satser, så
              historikken bevares.
            </span>
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Annullér
          </button>
        </div>
      </div>
    </div>
  );
}
