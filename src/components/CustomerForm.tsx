import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type {
  Customer,
  CustomerStatus,
  NewCustomer,
  RevenueEntry,
} from '../types';
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from '../types';
import { defaultOpstartsDato, todayISO, udbetalingsFromOpstart } from '../lib/dates';
import { Field, inputCls } from './Field';
import { NumberInput } from './NumberInput';

type Props = {
  open: boolean;
  initial?: Customer | null;
  onClose: () => void;
  onSubmit: (data: NewCustomer, id?: string) => void;
};

type RevenueEntryForm = {
  id: string;
  label: string;
  totalRevenue: string;
  carRevenue: string;
  saleDate: string;
  startDate: string;
  payoutDate: string;
  startDateTouched: boolean;
};

type FormState = {
  nordigoId: string;
  navn: string;
  email: string;
  telefon: string;
  entries: RevenueEntryForm[];
  friKundeChurn: boolean;
  noter: string;
  status: CustomerStatus;
};

const entryId = () => Math.random().toString(36).slice(2);

function makeEntry(base?: Partial<RevenueEntry>): RevenueEntryForm {
  const saleDate = base?.saleDate ?? todayISO();
  const startDate = base?.startDate ?? defaultOpstartsDato(saleDate);
  return {
    id: base?.id ?? entryId(),
    label: base?.label ?? '',
    totalRevenue: String(base?.totalRevenue ?? ''),
    carRevenue: String(base?.carRevenue ?? ''),
    saleDate,
    startDate,
    payoutDate: base?.payoutDate ?? udbetalingsFromOpstart(startDate),
    startDateTouched: Boolean(base?.startDate),
  };
}

function emptyForm(): FormState {
  return {
    nordigoId: '',
    navn: '',
    email: '',
    telefon: '',
    entries: [makeEntry()],
    friKundeChurn: false,
    noter: '',
    status: 'oprettelse',
  };
}

function mapCustomerEntries(initial: Customer): RevenueEntryForm[] {
  if (initial.revenueEntries?.length) {
    return initial.revenueEntries.map((entry) => makeEntry(entry));
  }
  return [
    makeEntry({
      label: 'Hovedbeløb',
      totalRevenue: initial.samletOmsaetning,
      carRevenue: initial.bilOmsaetning,
      saleDate: initial.salgsDato,
      startDate: initial.opstartsDato,
      payoutDate: initial.udbetalingsDato,
    }),
  ];
}

export function CustomerForm({ open, initial, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        nordigoId: initial.nordigoId,
        navn: initial.navn ?? '',
        email: initial.email ?? '',
        telefon: initial.telefon ?? '',
        entries: mapCustomerEntries(initial),
        friKundeChurn: !!initial.friKundeChurn,
        noter: initial.noter ?? '',
        status: initial.status,
      });
    } else {
      setForm(emptyForm());
    }
    setShowAdvanced(false);
  }, [initial, open]);

  const allowedStatuses = useMemo<CustomerStatus[]>(() => {
    if (!initial) return ['oprettelse'];
    return ALLOWED_TRANSITIONS[initial.status];
  }, [initial]);

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateEntry(id: string, next: Partial<RevenueEntryForm>) {
    setForm((f) => ({
      ...f,
      entries: f.entries.map((entry) => {
        if (entry.id !== id) return entry;
        const merged = { ...entry, ...next };
        if ('saleDate' in next && !merged.startDateTouched) {
          merged.startDate = defaultOpstartsDato(merged.saleDate);
          merged.payoutDate = udbetalingsFromOpstart(merged.startDate);
        }
        if ('startDate' in next) {
          merged.startDateTouched = true;
          merged.payoutDate = udbetalingsFromOpstart(merged.startDate);
        }
        return merged;
      }),
    }));
  }

  function addEntry() {
    setShowAdvanced(true);
    setForm((f) => ({
      ...f,
      entries: [...f.entries, makeEntry({ label: `Beløb ${f.entries.length + 1}` })],
    }));
  }

  function removeEntry(id: string) {
    setForm((f) => ({
      ...f,
      entries: f.entries.length <= 1 ? f.entries : f.entries.filter((entry) => entry.id !== id),
    }));
  }

  const errors: string[] = [];
  if (!form.nordigoId.trim()) errors.push('Nordigo-ID er påkrævet');
  for (const entry of form.entries) {
    const total = Number(entry.totalRevenue) || 0;
    const car = Number(entry.carRevenue) || 0;
    if (car > total) errors.push('Bil omsætning kan ikke være større end samlet omsætning');
  }
  const hasErrors = errors.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasErrors) return;
    if (!initial && !window.confirm('Har du udsendt tilbud?')) return;

    const revenueEntries: RevenueEntry[] = form.entries.map((entry, index) => ({
      id: entry.id || `new-${index}`,
      label: entry.label.trim() || `Beløb ${index + 1}`,
      totalRevenue: Number(entry.totalRevenue) || 0,
      carRevenue: Number(entry.carRevenue) || 0,
      saleDate: entry.saleDate,
      startDate: entry.startDate || defaultOpstartsDato(entry.saleDate),
      payoutDate: entry.payoutDate || udbetalingsFromOpstart(entry.startDate),
    }));

    const mainEntry = revenueEntries[0];
    const payload: NewCustomer = {
      nordigoId: form.nordigoId.trim(),
      navn: form.navn.trim() || undefined,
      email: form.email.trim() || undefined,
      telefon: form.telefon.trim() || undefined,
      salgsDato: mainEntry?.saleDate ?? todayISO(),
      opstartsDato: mainEntry?.startDate ?? defaultOpstartsDato(todayISO()),
      udbetalingsDato:
        mainEntry?.payoutDate ??
        udbetalingsFromOpstart(mainEntry?.startDate ?? defaultOpstartsDato(todayISO())),
      samletOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.totalRevenue, 0),
      bilOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.carRevenue, 0),
      revenueEntries,
      friKundeChurn: form.friKundeChurn,
      noter: form.noter.trim() || undefined,
      status: initial ? form.status : 'oprettelse',
    };
    onSubmit(payload, initial?.id);
  }

  const primaryEntry = form.entries[0];
  const advancedEntries = form.entries.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {initial ? 'Rediger kunde' : 'Ny kunde'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Luk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Kundeoplysninger
          </h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Nordigo-ID" required>
              <input
                required
                value={form.nordigoId}
                onChange={(e) => update('nordigoId', e.target.value)}
                className={inputCls}
                placeholder="fx NRD-1042"
                autoFocus
              />
            </Field>
            <Field label="Navn">
              <input
                value={form.navn}
                onChange={(e) => update('navn', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Telefon">
              <input
                value={form.telefon}
                onChange={(e) => update('telefon', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="my-6 border-t border-slate-200 dark:border-slate-800" />

          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Salg / provision
          </h3>

          {primaryEntry && (
            <div className="mb-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Hovedbeløb
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Label">
                  <input
                    value={primaryEntry.label}
                    onChange={(e) => updateEntry(primaryEntry.id, { label: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Samlet omsætning (DKK)">
                  <NumberInput
                    value={primaryEntry.totalRevenue}
                    onChange={(v) => updateEntry(primaryEntry.id, { totalRevenue: v })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Bil omsætning (DKK)">
                  <NumberInput
                    value={primaryEntry.carRevenue}
                    onChange={(v) => updateEntry(primaryEntry.id, { carRevenue: v })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Salgsdato">
                  <input
                    type="date"
                    value={primaryEntry.saleDate}
                    onChange={(e) => updateEntry(primaryEntry.id, { saleDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Opstartsdato">
                  <input
                    type="date"
                    value={primaryEntry.startDate}
                    onChange={(e) => updateEntry(primaryEntry.id, { startDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Udbetalingsdato">
                  <input type="date" value={primaryEntry.payoutDate} readOnly className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"
          >
            <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
            Avancerede indstillinger
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
              {advancedEntries.map((entry, index) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Ekstra beløb {index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Label">
                      <input
                        value={entry.label}
                        onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Samlet omsætning (DKK)">
                      <NumberInput
                        value={entry.totalRevenue}
                        onChange={(v) => updateEntry(entry.id, { totalRevenue: v })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Bil omsætning (DKK)">
                      <NumberInput
                        value={entry.carRevenue}
                        onChange={(v) => updateEntry(entry.id, { carRevenue: v })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Salgsdato">
                      <input
                        type="date"
                        value={entry.saleDate}
                        onChange={(e) => updateEntry(entry.id, { saleDate: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Opstartsdato">
                      <input
                        type="date"
                        value={entry.startDate}
                        onChange={(e) => updateEntry(entry.id, { startDate: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Udbetalingsdato">
                      <input type="date" value={entry.payoutDate} readOnly className={inputCls} />
                    </Field>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
              >
                <Plus className="h-4 w-4" /> Tilføj yderligere beløb
              </button>
            </div>
          )}

          <div className="mt-5">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                form.friKundeChurn
                  ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="checkbox"
                checked={form.friKundeChurn}
                onChange={(e) => update('friKundeChurn', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  Fri kunde / Churn
                </div>
              </div>
            </label>
          </div>

          {initial && (
            <div className="mt-4">
              <Field label="Status" hint="Kun gyldige overgange vises">
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value as CustomerStatus)}
                  className={inputCls}
                >
                  {allowedStatuses.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div className="mt-4">
            <Field label="Noter" full>
              <textarea
                rows={3}
                value={form.noter}
                onChange={(e) => update('noter', e.target.value)}
                className={inputCls}
                placeholder="Tilføj notater..."
              />
            </Field>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={hasErrors}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {initial ? 'Gem ændringer' : 'Opret kunde'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
