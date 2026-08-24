import type { CreateAssignmentsResponse } from './types';

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

export async function createAssignments(token: string, campaignId: string, agentId: string, customerIds: string[]) {
  const response = await fetch(`${apiBaseUrl}/assignments`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, agentId, customerIds }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as CreateAssignmentsResponse;
}

export async function reassignAssignment(token: string, assignmentId: string, agentId: string) {
  const response = await fetch(`${apiBaseUrl}/assignments/${assignmentId}/reassign`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<unknown>;
}

export async function deleteAssignment(token: string, assignmentId: string) {
  const response = await fetch(`${apiBaseUrl}/assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
}