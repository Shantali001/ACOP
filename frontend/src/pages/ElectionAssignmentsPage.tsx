import { useEffect, useState } from 'react';
import { UserPlus, AlertTriangle, Pencil } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { createElectionAssignments, getElectionAssignmentSummary, getPollingUnits, updatePollingUnit } from '../election/api';
import type { PollingUnit } from '../election/types';

export function ElectionAssignmentsPage() {
  const { token } = useAuth();
  const [pus, setPus] = useState<PollingUnit[]>([]);
  const [agents, setAgents] = useState<{ agentId: string; fullName: string; email: string; assignedCount: number }[]>([]);
  const [selectedPuIds, setSelectedPuIds] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [interval, setInterval] = useState('45');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPollingUnits(token, { pageSize: 1000 }).then((data) => setPus(data.data));
    getElectionAssignmentSummary(token).then((data) => setAgents(data.data)).catch(() => {});
  }, [token]);

  const wards = Array.from(new Set(pus.map((pu) => pu.ward))).sort();

  const filteredPus = pus.filter((pu) => {
    if (wardFilter && pu.ward !== wardFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return pu.puCode.toLowerCase().includes(q) || pu.puName.toLowerCase().includes(q) || pu.fieldAgentName?.toLowerCase().includes(q) || pu.ward.toLowerCase().includes(q);
    }
    return true;
  });

  function togglePu(id: string) {
    setSelectedPuIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function selectAll() {
    if (selectedPuIds.length === filteredPus.length) {
      setSelectedPuIds([]);
    } else {
      setSelectedPuIds(filteredPus.map((pu) => pu.id));
    }
  }

  async function handleSavePhone() {
    if (!token || !editingPhoneId) return;
    try {
      await updatePollingUnit(token, editingPhoneId, { fieldAgentPhone: editingPhone });
      setPus((prev) => prev.map((p) => p.id === editingPhoneId ? { ...p, fieldAgentPhone: editingPhone } : p));
      setEditingPhoneId(null);
      setEditingPhone('');
    } catch {
      setError('Failed to update phone number.');
    }
  }

  async function handleAssign() {
    if (!token || !selectedAgentId || selectedPuIds.length === 0) return;
    setIsAssigning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createElectionAssignments(token, { agentId: selectedAgentId, pollingUnitIds: selectedPuIds, checkInIntervalMinutes: Number(interval) });
      setSuccess(`Assigned ${res.assigned} polling unit(s) successfully.`);
      setSelectedPuIds([]);
      const summary = await getElectionAssignmentSummary(token);
      setAgents(summary.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Assignment failed.');
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <section className="py-6 space-y-6">
      <h1 className="text-page font-bold text-ink">Election Assignments</h1>
      <p className="text-body text-ink-muted">Assign polling units to call center agents for monitoring.</p>

      {error && <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}
      {success && <div className="rounded-lg border border-success/20 bg-success-light px-4 py-3 text-sm text-success">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Polling Units" className="lg:col-span-2">
          <div className="px-6 py-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Search PU code, name, field agent..." />
              <select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} className="input">
                <option value="">All wards</option>
                {wards.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <button onClick={selectAll} className="btn btn-secondary btn-sm">
                {selectedPuIds.length === filteredPus.length && filteredPus.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
              <span className="flex items-center text-sm text-ink-muted">{selectedPuIds.length} selected</span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedPuIds.length === filteredPus.length && filteredPus.length > 0} onChange={selectAll} /></th>
                    <th>PU Code</th>
                    <th>Name</th>
                    <th>Ward</th>
                    <th>LGA</th>
                    <th>Field Agent</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPus.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-ink-muted">No polling units found.</td></tr>
                  ) : (
                    filteredPus.map((pu) => (
                      <tr key={pu.id}>
                        <td><input type="checkbox" checked={selectedPuIds.includes(pu.id)} onChange={() => togglePu(pu.id)} /></td>
                        <td className="font-medium">{pu.puCode}</td>
                        <td>{pu.puName}</td>
                        <td>{pu.ward}</td>
                        <td>{pu.lga}</td>
                        <td>{pu.fieldAgentName ?? <span className="text-ink-muted">Not set</span>}</td>
                        <td>
                          {editingPhoneId === pu.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingPhone}
                                onChange={(e) => setEditingPhone(e.target.value)}
                                className="input"
                                placeholder="Phone number"
                                autoFocus
                              />
                              <button onClick={() => handleSavePhone()} className="btn btn-sm btn-primary">Save</button>
                              <button onClick={() => { setEditingPhoneId(null); setEditingPhone(''); }} className="btn btn-sm btn-secondary">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {pu.fieldAgentPhone ? (
                                <span className="text-sm text-ink">{pu.fieldAgentPhone}</span>
                              ) : (
                                <span className="flex items-center gap-1 text-sm text-danger">
                                  <AlertTriangle size={14} /> Missing
                                </span>
                              )}
                              <button onClick={() => { setEditingPhoneId(pu.id); setEditingPhone(pu.fieldAgentPhone ?? ''); }} className="btn btn-sm">
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Assign to Agent">
            <div className="px-6 py-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Select agent</span>
                <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="input" required>
                  <option value="">Choose an agent</option>
                  {agents.map((a) => <option key={a.agentId} value={a.agentId}>{a.fullName} ({a.email}) — {a.assignedCount} assigned</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Check-in interval (minutes)</span>
                <input type="number" min="5" value={interval} onChange={(e) => setInterval(e.target.value)} className="input" />
              </label>
              <button onClick={() => void handleAssign()} disabled={!selectedAgentId || selectedPuIds.length === 0 || isAssigning} className="btn btn-primary w-full gap-2">
                <UserPlus size={16} />
                {isAssigning ? 'Assigning...' : `Assign ${selectedPuIds.length} PU(s)`}
              </button>
              {selectedPuIds.length > 0 && (
                <p className="text-xs text-ink-muted">
                  {selectedPuIds.filter((id) => pus.find((p) => p.id === id)?.fieldAgentPhone).length} of {selectedPuIds.length} selected PUs have a phone number.
                </p>
              )}
            </div>
          </Card>

          <Card title="Agent Load">
            <div className="px-6 py-5">
              {agents.length === 0 ? (
                <p className="text-sm text-ink-muted">No agents available.</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((a) => (
                    <div key={a.agentId} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{a.fullName}</p>
                        <p className="text-xs text-ink-muted">{a.email}</p>
                      </div>
                      <Badge variant={a.assignedCount === 0 ? 'neutral' : a.assignedCount < 10 ? 'success' : 'warning'}>
                        {a.assignedCount} assigned
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
