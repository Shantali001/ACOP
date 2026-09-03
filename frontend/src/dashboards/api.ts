import type { AdminDashboardMetrics, AgentDashboardMetrics, CampaignDashboardData, DashboardFilters, SupervisorResponse } from './types';

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

export async function getAdminDashboard(token: string) {
  const response = await fetch(`${apiBaseUrl}/admin/dashboard`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as AdminDashboardMetrics;
}

export async function getAgentDashboard(token: string) {
  const response = await fetch(`${apiBaseUrl}/agent/dashboard`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as AgentDashboardMetrics;
}

export async function getSupervisorDashboard(token: string) {
  const response = await fetch(`${apiBaseUrl}/admin/supervisor`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as SupervisorResponse;
}

export async function getCampaignDashboard(token: string, filters: DashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.state) params.set('state', filters.state);
  if (filters.lga) params.set('lga', filters.lga);
  if (filters.ward) params.set('ward', filters.ward);
  if (filters.agentId) params.set('agentId', filters.agentId);
  if (filters.trendPeriod) params.set('trendPeriod', filters.trendPeriod);
  if (filters.callActivity) params.set('callActivity', filters.callActivity);

  const queryString = params.toString();
  const url = `${apiBaseUrl}/admin/campaign-dashboard${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as CampaignDashboardData;
}

export async function getLgasByState(token: string, state: string) {
  const url = `${apiBaseUrl}/admin/campaign-dashboard/lgas?state=${encodeURIComponent(state)}`;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as string[];
}

export async function getWardsByLga(token: string, lga: string) {
  const url = `${apiBaseUrl}/admin/campaign-dashboard/wards?lga=${encodeURIComponent(lga)}`;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as string[];
}

