import type { Customer, Settings } from '../types';
import { DEFAULT_SETTINGS } from './settings';

type RemoteState = {
  customers: Customer[] | null;
  settings: Settings | null;
};

function normaliseSettings(settings: Settings | null): Settings {
  if (!settings) return { ...DEFAULT_SETTINGS, monthly: {} };
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    defaultCommission: {
      ...DEFAULT_SETTINGS.defaultCommission,
      ...(settings.defaultCommission ?? {}),
    },
    monthly: settings.monthly ?? {},
  };
}

export async function loadRemoteState(): Promise<RemoteState> {
  const response = await fetch('/api/state');
  if (!response.ok) {
    throw new Error(`Failed to load state (${response.status})`);
  }
  const payload = (await response.json()) as RemoteState;
  return {
    customers: Array.isArray(payload.customers) ? payload.customers : null,
    settings: normaliseSettings(payload.settings),
  };
}

export async function saveRemoteState(state: {
  customers: Customer[];
  settings: Settings;
}): Promise<void> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`Failed to save state (${response.status})`);
  }
}
