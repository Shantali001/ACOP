import type { NextCustomerResponse, QueueSummary, SaveCallResponse } from './types';

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

export async function getAgentModemStatus(token: string) {
  const response = await fetch(`${apiBaseUrl}/agent/modem`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ modem: import('./types').AgentModem | null; test: import('./types').AgentModemTest | null }>;
}

export async function getQueueSummary(token: string) {
  const response = await fetch(`${apiBaseUrl}/agent/queue-summary`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as QueueSummary;
}

export async function getNextCustomer(token: string) {
  const response = await fetch(`${apiBaseUrl}/agent/next-customer`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as NextCustomerResponse;
}

export async function saveCall(token: string, assignmentId: string, outcome: string, notes: string, durationSeconds: number) {
  const response = await fetch(`${apiBaseUrl}/agent/calls`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId, outcome, notes, durationSeconds }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as SaveCallResponse;
}
export async function dialCustomer(token: string, assignmentId: string) {
  const response = await fetch(`${apiBaseUrl}/agent/calls/dial`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ dialing: boolean; phoneNumber: string; modemId: string }>;
}

export async function hangupCall(token: string) {
  const response = await fetch(`${apiBaseUrl}/agent/calls/hangup`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ hungUp: boolean; modemId: string }>;
}