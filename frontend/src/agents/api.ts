import type { Agent, AgentInput, CreateAgentResponse } from './types';

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

export async function listAgents(token: string) {
  const response = await fetch(`${apiBaseUrl}/agents`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Agent[];
}

export async function createAgent(token: string, payload: AgentInput) {
  const response = await fetch(`${apiBaseUrl}/agents`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as CreateAgentResponse;
}

export async function updateAgent(token: string, id: string, payload: AgentInput) {
  const response = await fetch(`${apiBaseUrl}/agents/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Agent;
}

export async function activateAgent(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/agents/${id}/activate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Agent;
}

export async function suspendAgent(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/agents/${id}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Agent;
}

export async function deleteAgent(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/agents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
}