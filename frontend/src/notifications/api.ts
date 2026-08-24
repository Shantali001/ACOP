import type { NotificationsResponse } from './types';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
async function parseError(response: Response) { try { const body = await response.json() as { message?: string }; return body.message ?? 'Request failed.'; } catch { return 'Request failed.'; } }
function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }
export async function listNotifications(token: string) { const r = await fetch(`${apiBaseUrl}/notifications`, { headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); return await r.json() as NotificationsResponse; }
export async function markNotificationRead(token: string, id: string) { const r = await fetch(`${apiBaseUrl}/notifications/${id}/read`, { method: 'POST', headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); }
export async function markAllNotificationsRead(token: string) { const r = await fetch(`${apiBaseUrl}/notifications/read-all`, { method: 'POST', headers: authHeaders(token) }); if (!r.ok) throw new Error(await parseError(r)); }