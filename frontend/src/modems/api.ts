import type { Modem, ModemUpdate } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? 'Request failed.';
  } catch {
    return 'Request failed.';
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function listModems(token: string) {
  const response = await fetch(`${apiBaseUrl}/modems`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Modem[];
}

export async function createModem(token: string, payload: { name?: string; port?: string; simNumber?: string; imei?: string; status?: Modem['status'] }) {
  const response = await fetch(`${apiBaseUrl}/modems`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Modem;
}

export async function discoverModems(token: string) {
  const response = await fetch(`${apiBaseUrl}/modems/discover`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Modem[];
}

export async function testModem(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/modems/${id}/test`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ modemId: string; online: boolean; status: Modem['status']; message: string }>;
}

export async function updateModem(token: string, id: string, payload: ModemUpdate) {
  const response = await fetch(`${apiBaseUrl}/modems/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Modem;
}

export async function assignModem(token: string, agentId: string, modemId: string) {
  const response = await fetch(`${apiBaseUrl}/modems/assign`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, modemId }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ agentId: string; modemId: string }>;
}