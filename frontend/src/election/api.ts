import type { ElectionDialResponse, GeoRollupItem, Incident, IncidentInput, MyElectionAssignmentsResponse, NextPollingUnitResponse, PartyCandidate, PollingUnit, PollingUnitResultInput, Projection, SituationRoomSummary } from './types';

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

export async function getPollingUnits(token: string, params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value));
  }
  const url = `${apiBaseUrl}/election/polling-units${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: PollingUnit[]; page: number; pageSize: number; total: number }>;
}

export async function importPollingUnits(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBaseUrl}/election/polling-units/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ added: number; skipped: number; invalid: { row: number; reason: string }[] }>;
}

export async function createPollingUnit(token: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl}/election/polling-units`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<PollingUnit>;
}

export async function updatePollingUnit(token: string, id: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl}/election/polling-units/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<PollingUnit>;
}

export async function deletePollingUnit(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/election/polling-units/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function createElectionAssignments(token: string, payload: { agentId: string; pollingUnitIds: string[]; checkInIntervalMinutes?: number }) {
  const response = await fetch(`${apiBaseUrl}/election/election-assignments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ assigned: number }>;
}

export async function getElectionAssignmentSummary(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/election-assignments/summary`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: { agentId: string; fullName: string; email: string; assignedCount: number }[] }>;
}

export async function getNextPollingUnit(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/election-assignments/next`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as NextPollingUnitResponse;
}

export async function getMyElectionAssignments(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/election-assignments/mine`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<MyElectionAssignmentsResponse>;
}

export async function dialElectionAssignment(token: string, assignmentId: string) {
  const response = await fetch(`${apiBaseUrl}/agent/election-calls/dial`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<ElectionDialResponse>;
}

export async function submitPollingUnitReport(token: string, payload: {
  assignmentId: string;
  reportType: string;
  accreditedVoters?: number;
  notes?: string;
  results?: PollingUnitResultInput[];
  incident?: IncidentInput;
}) {
  const response = await fetch(`${apiBaseUrl}/election/polling-unit-reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ reportId: string; incidentId?: string; flagged: boolean }>;
}

export async function getSituationRoomSummary(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/situation-room/summary`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<SituationRoomSummary>;
}

export async function getSituationRoomGeo(token: string, level: 'state' | 'lga' | 'ward') {
  const response = await fetch(`${apiBaseUrl}/election/situation-room/geo?level=${level}`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: GeoRollupItem[] }>;
}

export async function getSituationRoomStale(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/situation-room/stale`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: { id: string; puCode: string; puName: string; ward: string; lga: string; state: string; lastCalledAt: string | null; checkInIntervalMinutes: number; dueAt: string }[] }>;
}

export async function getSituationRoomIncidents(token: string, severity?: string) {
  const url = severity ? `${apiBaseUrl}/election/situation-room/incidents?severity=${encodeURIComponent(severity)}` : `${apiBaseUrl}/election/situation-room/incidents`;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: Incident[] }>;
}

export async function getProjection(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/situation-room/projection`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<Projection>;
}

export async function getElectionTargets(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/election-targets`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ target: { id: string; scopeLevel: string; scopeValue: string | null; votesNeededToWin: number; expectedTurnoutPercent: number; createdAt: string; updatedAt: string } | null }>;
}

export async function updateElectionTargets(token: string, payload: { votesNeededToWin: number; expectedTurnoutPercent: number }) {
  const response = await fetch(`${apiBaseUrl}/election/election-targets`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ id: string; scopeLevel: string; scopeValue: string | null; votesNeededToWin: number; expectedTurnoutPercent: number; createdAt: string; updatedAt: string }>;
}

export async function getPartiesCandidates(token: string) {
  const response = await fetch(`${apiBaseUrl}/election/parties-candidates`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as Promise<{ data: PartyCandidate[] }>;
}

export async function createPartyCandidate(token: string, payload: { name: string; partyCode?: string; isOurParty?: boolean; sortOrder?: number }) {
  const response = await fetch(`${apiBaseUrl}/election/parties-candidates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<PartyCandidate>;
}

export async function updatePartyCandidate(token: string, id: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl}/election/parties-candidates/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<PartyCandidate>;
}

export async function deletePartyCandidate(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/election/parties-candidates/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await parseError(response));
}
