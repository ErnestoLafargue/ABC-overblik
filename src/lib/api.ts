import type { Customer, Settings } from '../types';
import { DEFAULT_SETTINGS } from './settings';

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  phone: string;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Auth check failed (${response.status})`);
  }
  const payload = (await response.json()) as { user: SessionUser };
  return payload.user;
}

export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  const payload = await request<{ user: SessionUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return payload.user;
}

export async function signup(data: {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
}): Promise<SessionUser> {
  const payload = await request<{ user: SessionUser }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.user;
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function listCustomers(): Promise<Customer[]> {
  const payload = await request<{ customers: Customer[] }>('/api/customers');
  return payload.customers ?? [];
}

export async function createRemoteCustomer(
  data: Omit<Customer, 'id' | 'oprettetAt'>,
): Promise<Customer> {
  const payload = await request<{ customer: Customer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.customer;
}

export async function updateRemoteCustomer(
  id: string,
  data: Omit<Customer, 'id' | 'oprettetAt'>,
): Promise<void> {
  await request(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteCustomer(id: string): Promise<void> {
  await request(`/api/customers/${id}`, { method: 'DELETE' });
}

export async function loadRemoteSettings(): Promise<Settings> {
  const payload = await request<{ settings: Settings | null }>('/api/settings');
  return normaliseSettings(payload.settings);
}

export async function saveRemoteSettings(settings: Settings): Promise<void> {
  await request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}
