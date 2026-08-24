import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, Pencil, Power, TestTube, UserPlus, Search, Plus } from 'lucide-react';

import { listAgents } from '../agents/api';
import type { Agent } from '../agents/types';
import { useAuth } from '../auth/useAuth';
import { assignModem, createModem, discoverModems, listModems, testModem, updateModem } from '../modems/api';
import type { Modem } from '../modems/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function ModemsListPage() {
  const { token } = useAuth();
  const [modems, setModems] = useState<Modem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentByModem, setSelectedAgentByModem] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [modemResults, agentResults] = await Promise.all([listModems(token), listAgents(token)]);
      setModems(modemResults);
      setAgents(agentResults.filter((agent) => agent.status === 'ACTIVE'));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load modems.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleTest(modem: Modem) {
    if (!token) return;

    try {
      const result = await testModem(token, modem.id);
      setMessage(result.message);
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not test modem.');
    }
  }

  async function handleDiscover() {
    if (!token) return;

    try {
      await discoverModems(token);
      setMessage('Modem discovery complete.');
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not discover modems.');
    }
  }

  async function handleAddModem() {
    if (!token) return;

    const name = window.prompt('Modem name (optional)');
    if (name === null) return;
    const port = window.prompt('COM port (e.g., COM9)');
    if (port === null) return;

    try {
      await createModem(token, { name: name || undefined, port: port || undefined });
      setMessage('Modem added.');
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not add modem.');
    }
  }

  async function handleToggle(modem: Modem) {
    if (!token) return;

    try {
      const updated = await updateModem(token, modem.id, { enabled: !modem.enabled });
      setModems((current) => current.map((item) => (item.id === modem.id ? { ...item, enabled: updated.enabled } : item)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update modem.');
    }
  }

  async function handleMetadata(modem: Modem) {
    if (!token) return;

    const name = window.prompt('Modem name', modem.name);
    if (name === null) return;
    const port = window.prompt('Serial port/device path', modem.port ?? '');
    if (port === null) return;
    const simNumber = window.prompt('SIM number/info', modem.simNumber ?? '');
    if (simNumber === null) return;

    try {
      const updated = await updateModem(token, modem.id, { name, port, simNumber });
      setModems((current) => current.map((item) => (item.id === modem.id ? { ...item, ...updated } : item)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save modem metadata.');
    }
  }

  async function handleAssign(modem: Modem) {
    if (!token) return;

    const agentId = selectedAgentByModem[modem.id];
    if (!agentId) {
      setError('Select an agent before assigning the modem.');
      return;
    }

    try {
      await assignModem(token, agentId, modem.id);
      setMessage('Modem assigned to agent.');
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not assign modem.');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page font-bold text-ink">Modems</h1>
          <p className="mt-2 text-body text-ink-secondary">Manage GSM modem availability and agent assignment.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="btn btn-secondary gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
        <button type="button" onClick={() => void handleDiscover()} className="btn btn-secondary gap-2">
          <Search className="h-4 w-4" />
          Discover
        </button>
        <button type="button" onClick={() => void handleAddModem()} className="btn btn-secondary gap-2">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}
      {message && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-success" role="status">
            {message}
          </div>
        </div>
      )}

      <Card>
        <div className="table-container border-0 shadow-none">
          {isLoading && !modems.length ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ) : !modems.length ? (
            <EmptyState
              title="No modems found"
              description="Connect a modem and click Discover to get started."
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Modem</th>
                  <th>Status</th>
                  <th>Signal</th>
                  <th>SIM</th>
                  <th>Assigned agent</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modems.map((modem) => {
                  const statusVariant = modem.status === 'READY' ? 'success' : modem.status === 'BUSY' ? 'warning' : 'danger';
                  return (
                    <tr key={modem.id}>
                      <td>
                        <div className="font-medium text-ink">{modem.name}</div>
                        <div className="text-xs text-ink-muted">{modem.port ?? 'No port set'}</div>
                      </td>
                      <td>
                        <Badge variant={statusVariant}>{modem.status}</Badge>
                        <div className="mt-1 text-xs text-ink-muted">{modem.enabled ? 'Enabled' : 'Disabled'}</div>
                      </td>
                      <td className="text-ink-secondary">{modem.signalStrength ?? 'Unknown'}</td>
                      <td className="text-ink-secondary">{modem.simNumber ?? 'Not set'}</td>
                      <td className="text-ink-secondary">{modem.assignedAgentName ?? 'Unassigned'}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => void handleTest(modem)} className="btn btn-secondary btn-sm gap-1">
                            <TestTube className="h-3.5 w-3.5" />
                            Test
                          </button>
                          <button type="button" onClick={() => void handleToggle(modem)} className="btn btn-secondary btn-sm gap-1">
                            <Power className="h-3.5 w-3.5" />
                            {modem.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button type="button" onClick={() => void handleMetadata(modem)} className="btn btn-secondary btn-sm gap-1">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <select
                            value={selectedAgentByModem[modem.id] ?? ''}
                            onChange={(event) => setSelectedAgentByModem((current) => ({ ...current, [modem.id]: event.target.value }))}
                            className="input h-9 w-auto"
                          >
                            <option value="">Agent</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>{agent.fullName}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => void handleAssign(modem)} className="btn btn-primary btn-sm gap-1">
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </section>
  );
}
