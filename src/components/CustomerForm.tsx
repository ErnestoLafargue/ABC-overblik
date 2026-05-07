import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { Customer, CustomerStatus, NewCustomer } from '../types';
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from '../types';
import {
  defaultOpstartsDato,
  monthLabel,
  monthKey as toMonthKey,
  todayISO,
  udbetalingsFromOpstart,
} from '../lib/dates';
import { formatDate } from '../lib/format';
import { Field, inputCls } from './Field';
import { NumberInput } from './NumberInput';

type Props = {
  open: boolean;
  initial?: Customer | null;
  onClose: () => void;
  onSubmit: (data: NewCustomer, id?: string) => void;
};

type FormState = {
  nordigoId: string;
  navn: string;
  email: string;
  telefon: string;
  salgsDato: string;
  opstartsDato: string;
  /** True = brugeren har manuelt \u00e6ndret opstartsdato (auto-update fra salgsdato stopper) */
  opstartsDatoTouched: boolean;
  samletOmsaetning: string;
  bilOmsaetning: string;
  friKundeChurn: boolean;
  noter: string;
  status: CustomerStatus;
};

function emptyForm(): FormState {
  const today = todayISO();
  return {
    nordigoId: '',
    navn: '',
    email: '',
    telefon: '',
    salgsDato: today,
    opstartsDato: defaultOpstartsDato(today),
    opstartsDatoTouched: false,
    samletOmsaetning: '',
    bilOmsaetning: '',
    friKundeChurn: false,
    noter: '',
    status: 'oprettelse',
  };
}

export function CustomerForm({ open, initial, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (initial) {
      setForm({
        nordigoId: initial.nordigoId,
        navn: initial.navn ?? '',
        email: initial.email ?? '',
        telefon: initial.telefon ?? '',
        salgsDato: initial.salgsDato,
        opstartsDato:
          initial.opstartsDato || defaultOpstartsDato(initial.salgsDato),
        // Eksisterende kunde: behandl som "touched" s\u00e5 vi ikke utilsigtet
        // overskriver brugerens valgte opstartsdato
        opstartsDatoTouched: true,
        samletOmsaetning: initial.samletOmsaetning
          ? String(initial.samletOmsaetning)
          : '',
        bilOmsaetning: initial.bilOmsaetning ? String(initial.bilOmsaetning) : '',
        friKundeChurn: !!initial.friKundeChurn,
        noter: initial.noter ?? '',
        status: initial.status,
      });
    } else {
      setForm(emptyForm());
    }
  }, [initial, open]);

  const allowedStatuses = useMemo<CustomerStatus[]>(() => {
    if (!initial) return ['oprettelse'];
    return ALLOWED_TRANSITIONS[initial.status];
  }, [initial]);

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSalgsDatoChange(next: string) {
    setForm((f) => ({
      ...f,
      salgsDato: next,
      opstartsDato: f.opstartsDatoTouched
        ? f.opstartsDato
        : defaultOpstartsDato(next),
    }));
  }

  function handleOpstartsDatoChange(next: string) {
    setForm((f) => ({
      ...f,
      opstartsDato: next,
      opstartsDatoTouched: true,
    }));
  }

  const derivedUdbetaling = udbetalingsFromOpstart(form.opstartsDato);

  const samletNum = Number(form.samletOmsaetning) || 0;
  const bilNum = Number(form.bilOmsaetning) || 0;

  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.nordigoId.trim()) errors.nordigoId = 'Nordigo-ID er p\u00e5kr\u00e6vet';
  if (bilNum > samletNum)
    errors.bilOmsaetning =
      'Bil omsa\u00e6tning kan ikke v\u00e6re st\u00f8rre end samlet omsa\u00e6tning';

  const hasErrors = Object.keys(errors).length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasErrors) return;

    const opstartsDato =
      form.opstartsDato || defaultOpstartsDato(form.salgsDato);
    const payload: NewCustomer = {
      nordigoId: form.nordigoId.trim(),
      navn: form.navn.trim() || undefined,
      email: form.email.trim() || undefined,
      telefon: form.telefon.trim() || undefined,
      salgsDato: form.salgsDato,
      opstartsDato,
      udbetalingsDato: udbetalingsFromOpstart(opstartsDato),
      samletOmsaetning: samletNum,
      bilOmsaetning: bilNum,
      friKundeChurn: form.friKundeChurn,
      noter: form.noter.trim() || undefined,
      status: initial ? form.status : 'oprettelse',
    };
    onSubmit(payload, initial?.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {initial ? 'Rediger kunde' : 'Ny kunde'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {initial
                ? 'Opdater oplysninger eller skift status.'
                : 'Status sættes automatisk til "Under oprettelse".'}
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

        <form
          onSubmit={handleSubmit}
          className="grid max-h-[70vh] grid-cols-1 gap-5 overflow-y-auto px-6 py-5 sm:grid-cols-2"
        >
          <Field label="Nordigo-ID" required error={errors.nordigoId}>
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
              placeholder="Fornavn Efternavn"
            />
          </Field>

          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={inputCls}
              placeholder="navn@firma.dk"
            />
          </Field>

          <Field label="Telefon">
            <input
              value={form.telefon}
              onChange={(e) => update('telefon', e.target.value)}
              className={inputCls}
              placeholder="+45 ..."
            />
          </Field>

          <Field label="Salgsdato" hint="Driver hvilken måned kunden vises i">
            <input
              type="date"
              value={form.salgsDato}
              onChange={(e) => handleSalgsDatoChange(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field
            label="Opstartsdato"
            hint="Kunden starter altid den 1. i måneden efter næste måned"
          >
            <input
              type="date"
              value={form.opstartsDato}
              onChange={(e) => handleOpstartsDatoChange(e.target.value)}
              className={inputCls}
            />
            {derivedUdbetaling && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                Udbetales {formatDate(derivedUdbetaling)}
                <span className="text-violet-500/70 dark:text-violet-400/70">
                  · {monthLabel(toMonthKey(derivedUdbetaling)).toLowerCase()}-view
                </span>
              </span>
            )}
          </Field>

          <Field label="Samlet omsætning (DKK)">
            <NumberInput
              value={form.samletOmsaetning}
              onChange={(v) => update('samletOmsaetning', v)}
              className={inputCls}
              placeholder="Indtast beløb"
            />
          </Field>

          <Field
            label="Bil omsætning (DKK)"
            hint="Andel af samlet omsætning"
            error={errors.bilOmsaetning}
          >
            <NumberInput
              value={form.bilOmsaetning}
              onChange={(v) => update('bilOmsaetning', v)}
              className={inputCls}
              placeholder="Indtast beløb"
            />
          </Field>

          <div className="sm:col-span-2">
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
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Giver +5% ekstra provision på non-bil omsætning for denne
                  kunde (oven i den valgte model).
                </p>
              </div>
            </label>
          </div>

          {initial && (
            <Field label="Status" hint="Kun gyldige overgange vises">
              <select
                value={form.status}
                onChange={(e) =>
                  update('status', e.target.value as CustomerStatus)
                }
                className={inputCls}
              >
                {allowedStatuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Noter" full>
            <textarea
              rows={3}
              value={form.noter}
              onChange={(e) => update('noter', e.target.value)}
              className={inputCls}
              placeholder="Tilf\u00f8j notater..."
            />
          </Field>

          <div className="col-span-full mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
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
