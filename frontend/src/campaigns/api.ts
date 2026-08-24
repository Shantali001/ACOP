import type { Campaign, CampaignInput, CampaignStats, MembersListResponse } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? 'Request failed.';
  } catch {
    return 'Request failed.';
  }
}

function authHeaders(token: string | null) {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function listCampaigns(token: string, status = '') {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const res = await fetch(`${apiBaseUrl}/campaigns?${params.toString()}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Campaign[];
}

export async function createCampaign(token: string, payload: CampaignInput) {
  const res = await fetch(`${apiBaseUrl}/campaigns`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Campaign;
}

export async function updateCampaign(token: string, id: string, payload: CampaignInput) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Campaign;
}

export async function activateCampaign(token: string, id: string) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/activate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { id: string; status: string };
}

export async function closeCampaign(token: string, id: string) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/close`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { id: string; status: string };
}

export async function getCampaign(token: string, id: string) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Campaign;
}

export async function getCampaignStats(token: string, id: string) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/stats`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CampaignStats;
}

export async function addMembers(token: string, id: string, customerIds: string[]) {
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/members`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerIds }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { added: string[]; skipped: string[] };
}

export async function listMembers(token: string, id: string, search = '', page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`${apiBaseUrl}/campaigns/${id}/members?${params.toString()}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as MembersListResponse;
}
