import type { AgentReport, CampaignReport, OverallReport } from './types';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
async function parseError(response: Response) { try { const body = await response.json() as { message?: string }; return body.message ?? 'Request failed.'; } catch { return 'Request failed.'; } }
function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }
export async function getOverallReport(token: string) { const r = await fetch(`${apiBaseUrl}/reports/overall`, { headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); return await r.json() as OverallReport; }
export async function getAgentReports(token: string) { const r = await fetch(`${apiBaseUrl}/reports/agents`, { headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); return await r.json() as AgentReport[]; }
export async function getCampaignReports(token: string) { const r = await fetch(`${apiBaseUrl}/reports/campaigns`, { headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); return await r.json() as CampaignReport[]; }