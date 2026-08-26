import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { dialElectionAssignment, getMyElectionAssignments, getNextPollingUnit, submitPollingUnitReport } from '../election/api';
import type { IncidentInput, PollingUnitResultInput } from '../election/types';

const reportTypes = [
  { value: 'opening', label: 'Opening' },
  { value: 'checkin', label: 'Check-in' },
  { value: 'final', label: 'Final' },
];

const incidentCategories = [
  'Violence',
  'Technical',
  'Logistics',
  'Vote Buying',
  'Intimidation',
  'Other',
];

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function statusBadge(lastCalledAt: string | null, intervalMinutes: number, status: string) {
  if (status === 'closed') {
    return { label: 'Closed', variant: 'neutral' as const };
  }
  if (!lastCalledAt) {
    return { label: 'Never called', variant: 'warning' as const };
  }
  const diffMs = Date.now() - new Date(lastCalledAt).getTime();
  const diffMins = diffMs / 60000;
  if (diffMins > intervalMinutes + 15) {
    return { label: 'Overdue', variant: 'danger' as const };
  }
  if (diffMins > intervalMinutes) {
    return { label: 'Due soon', variant: 'warning' as const };
  }
  return { label: 'On schedule', variant: 'success' as const };
}

export function ElectionMonitoringPage() {
  const { token } = useAuth();
  const [nextPu, setNextPu] = useState<{
    assignmentId: string;
    puCode: string;
    puName: string;
    ward: string;
    lga: string;
    state: string;
    fieldAgentName: string | null;
    fieldAgentPhone: string | null;
    lastCalledAt: string | null;
    checkInIntervalMinutes: number;
  } | null>(null);
  const [assignments, setAssignments] = useState<{ id: string; status: string; checkInIntervalMinutes: number; lastCalledAt: string | null; puCode: string; puName: string; ward: string; lga: string; fieldAgentName: string | null; fieldAgentPhone: string | null }[]>([]);
  const [reportType, setReportType] = useState('checkin');
  const [accreditedVoters, setAccreditedVoters] = useState('');
  const [notes, setNotes] = useState('');
  const [results, setResults] = useState<{ partyCandidateId: string; voteCount: number }[]>([]);
  const [hasIncident, setHasIncident] = useState(false);
  const [incident, setIncident] = useState<IncidentInput>({ category: '', severity: 'medium', description: '' });
  const [parties, setParties] = useState<{ id: string; name: string }[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getNextPollingUnit(token)
      .then((data) => setNextPu(data.assignment))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load queue.'));
    getMyElectionAssignments(token)
      .then((data) => setAssignments(data.data))
      .catch(() => {});
    fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/election/parties-candidates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { data: { id: string; name: string }[] }) => setParties(data.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isCalling) return;
    const intervalId = window.setInterval(() => setElapsedSeconds((c) => c + 1), 1000);
    return () => window.clearInterval(intervalId);
  }, [isCalling]);

  useEffect(() => {
    if (!token || !nextPu?.assignmentId) return;
    const interval = setInterval(() => {
      getNextPollingUnit(token)
        .then((data) => setNextPu(data.assignment))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [token, nextPu?.assignmentId]);

  async function handleDial() {
    if (!token || !nextPu) return;
    setIsDialing(true);
    setError(null);
    try {
      await dialElectionAssignment(token, nextPu.assignmentId);
      setIsCalling(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not dial field agent.');
    } finally {
      setIsDialing(false);
    }
  }

  async function handleHangup() {
    if (!token) return;
    setIsDialing(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/agent/calls/hangup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Hangup failed');
      setIsCalling(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not hang up call.');
    } finally {
      setIsDialing(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !nextPu) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: {
        assignmentId: string;
        reportType: string;
        accreditedVoters?: number;
        notes?: string;
        results?: PollingUnitResultInput[];
        incident?: IncidentInput;
      } = {
        assignmentId: nextPu.assignmentId,
        reportType,
        accreditedVoters: accreditedVoters ? Number(accreditedVoters) : undefined,
        notes,
        results,
      };
      if (hasIncident && incident.category) {
        payload.incident = incident;
      }
      const response = await submitPollingUnitReport(token, payload);
      if (response.flagged) {
        setSuccess('Report submitted (flagged: accredited voters exceed registered voters).');
      } else {
        setSuccess('Report submitted successfully.');
      }
      setNextPu(null);
      setNotes('');
      setAccreditedVoters('');
      setResults([]);
      setHasIncident(false);
      setIncident({ category: '', severity: 'medium', description: '' });
      setElapsedSeconds(0);
      setIsCalling(false);
      const data = await getNextPollingUnit(token);
      setNextPu(data.assignment);
      const assignmentsData = await getMyElectionAssignments(token);
      setAssignments(assignmentsData.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit report.');
    } finally {
      setIsSaving(false);
    }
  }

  const nextDueTime = useMemo(() => {
    if (!nextPu || nextPu.lastCalledAt) return null;
    return new Date(new Date(nextPu.lastCalledAt!).getTime() + nextPu.checkInIntervalMinutes * 60000).toLocaleString();
  }, [nextPu]);

  return (
    <section className="py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-section font-semibold text-ink">Election Monitoring</h1>
          <p className="mt-1 text-body text-ink-secondary">Proactively check in with field agents at assigned polling units.</p>
        </div>
        <Card className="flex flex-1 min-w-0 flex-col items-end justify-center px-5 py-4 sm:flex-none sm:min-w-[200px]">
          <p className="text-table text-ink-muted">Call timer</p>
          <p className="mt-2 text-section font-semibold text-ink">{formatSeconds(elapsedSeconds)}</p>
        </Card>
      </div>

      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">{error}</div>
        </div>
      )}
      {success && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-success" role="status">{success}</div>
        </div>
      )}

      {!nextPu ? (
        <Card title="No polling units due" description={nextDueTime ? `Next one due at ${nextDueTime}` : 'Check your assignments below.'} className="mt-6">
          <div className="px-6 py-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-warning-light text-warning">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-section font-semibold text-ink">All caught up for now</h2>
              <p className="text-body text-ink-secondary">No polling units are due for check-in right now.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Card className="md:col-span-2">
            <div className="px-6 py-5">
              <p className="text-table text-ink-muted">Polling Unit</p>
              <p className="mt-2 text-xl font-semibold text-ink">{nextPu.puName}</p>
              <p className="mt-1 text-sm text-ink-secondary">{nextPu.puCode}</p>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5">
              <p className="text-table text-ink-muted">Ward / LGA</p>
              <p className="mt-2 text-xl font-semibold text-ink">{nextPu.ward ?? '—'}</p>
              <p className="mt-1 text-sm text-ink-secondary">{nextPu.lga ?? '—'}</p>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5">
              <p className="text-table text-ink-muted">Field Agent</p>
              <p className="mt-2 text-xl font-semibold text-ink">{nextPu.fieldAgentName ?? '—'}</p>
              <p className="mt-1 text-sm text-ink-secondary">{nextPu.fieldAgentPhone ?? '—'}</p>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5">
              <p className="text-table text-ink-muted">Status</p>
              <div className="mt-2">
                <Badge variant={statusBadge(nextPu.lastCalledAt, nextPu.checkInIntervalMinutes, 'active').variant}>
                  {statusBadge(nextPu.lastCalledAt, nextPu.checkInIntervalMinutes, 'active').label}
                </Badge>
                <p className="mt-2 text-xs text-ink-muted">
                  Last called: {nextPu.lastCalledAt ? new Date(nextPu.lastCalledAt).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {nextPu && (
        <form className="mt-6" onSubmit={handleSubmit}>
          <Card title="Log check-in report">
            <div className="px-6 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink-secondary">Report type</span>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="input" required>
                    {reportTypes.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink-secondary">Accredited voters</span>
                  <input type="number" min="0" value={accreditedVoters} onChange={(e) => setAccreditedVoters(e.target.value)} className="input" placeholder="0" />
                </label>
              </div>

              <div className="mt-6">
                <p className="mb-2 block text-sm font-medium text-ink-secondary">Vote tally</p>
                {parties.length === 0 ? (
                  <p className="text-sm text-ink-muted">No parties/candidates configured yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {parties.map((party) => (
                      <label key={party.id} className="block">
                        <span className="mb-1 block text-sm text-ink-secondary">{party.name}</span>
                        <input
                          type="number"
                          min="0"
                          value={results.find((r) => r.partyCandidateId === party.id)?.voteCount ?? ''}
                          onChange={(e) => {
                            const count = e.target.value ? Number(e.target.value) : 0;
                            setResults((prev) => {
                              const exists = prev.find((r) => r.partyCandidateId === party.id);
                              if (exists) return prev.map((r) => r.partyCandidateId === party.id ? { ...r, voteCount: count } : r);
                              return [...prev, { partyCandidateId: party.id, voteCount: count }];
                            });
                          }}
                          className="input"
                          placeholder="0"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hasIncident} onChange={(e) => setHasIncident(e.target.checked)} />
                  <span className="text-sm font-medium text-ink-secondary">Report an incident</span>
                </label>
                {hasIncident && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink-secondary">Category</span>
                      <select value={incident.category} onChange={(e) => setIncident({ ...incident, category: e.target.value })} className="input" required>
                        <option value="">Select category</option>
                        {incidentCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink-secondary">Severity</span>
                      <select value={incident.severity} onChange={(e) => setIncident({ ...incident, severity: e.target.value })} className="input">
                        {['low', 'medium', 'high', 'critical'].map((sev) => <option key={sev} value={sev}>{sev}</option>)}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-ink-secondary">Description</span>
                      <textarea value={incident.description} onChange={(e) => setIncident({ ...incident, description: e.target.value })} className="input" rows={3} placeholder="Describe the incident..." />
                    </label>
                  </div>
                )}
              </div>

              <label className="mt-6 block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} placeholder="Additional observations..." />
              </label>

              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleDial()} disabled={isDialing || isCalling} className="btn btn-primary gap-2">
                  <Phone size={16} />
                  {isDialing && !isCalling ? 'DIALING...' : 'CALL'}
                </button>
                <button type="button" onClick={() => void handleHangup()} disabled={!isCalling || isDialing} className="btn btn-secondary gap-2">
                  <PhoneOff size={16} />
                  END CALL
                </button>
                <button type="submit" disabled={isSaving} className="btn btn-primary gap-2">
                  {isSaving ? 'SAVING...' : 'SAVE & NEXT'}
                </button>
              </div>
            </div>
          </Card>
        </form>
      )}

      <Card title="Your assigned polling units" className="mt-8">
        <div className="px-6 py-5">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>PU Code</th>
                  <th>Name</th>
                  <th>Ward</th>
                  <th>LGA</th>
                  <th>Status</th>
                  <th>Last Called</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-ink-muted">No assignments loaded.</td></tr>
                ) : (
                  assignments.map((a) => {
                    const badge = statusBadge(a.lastCalledAt, a.checkInIntervalMinutes, a.status);
                    return (
                      <tr key={a.id}>
                        <td className="font-medium">{a.puCode}</td>
                        <td>{a.puName}</td>
                        <td>{a.ward}</td>
                        <td>{a.lga}</td>
                        <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                        <td>{a.lastCalledAt ? new Date(a.lastCalledAt).toLocaleString() : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </section>
  );
}
