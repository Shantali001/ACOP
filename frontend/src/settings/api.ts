import type { SystemSettings } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? 'Request failed.';
  } catch {
    return 'Request failed.';
  }
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getSettings() {
  const response = await fetch(`${apiBaseUrl}/settings`);
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as SystemSettings;
}

export async function updateSettings(token: string, payload: Omit<SystemSettings, 'updatedAt'>) {
  const response = await fetch(`${apiBaseUrl}/settings`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as SystemSettings;
}