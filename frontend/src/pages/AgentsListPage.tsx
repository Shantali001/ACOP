import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';

import { activateAgent, deleteAgent, listAgents, suspendAgent } from '../agents/api';
import type { Agent } from '../agents/types';
import { useAuth } from '../auth/useAuth';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

export function AgentsListPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    setSelectedIds([]);

    try {
      setAgents(await listAgents(token));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load agents.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  async function handleStatusToggle(agent: Agent) {
    if (!token) return;

    try {
      const updated = agent.status === 'ACTIVE' ? await suspendAgent(token, agent.id) : await activateAgent(token, agent.id);
      setAgents((current) => current.map((item) => (item.id === agent.id ? { ...item, status: updated.status } : item)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update agent status.');
    }
  }

  async function handleDelete(agent: Agent) {
    if (!token || !window.confirm(`Delete ${agent.fullName}?`)) return;

    try {
      await deleteAgent(token, agent.id);
      setAgents((current) => current.filter((item) => item.id !== agent.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete agent.');
    }
  }

  async function handleBulkDelete() {
    if (!token || !window.confirm(`Delete ${selectedIds.length} selected agent(s)?`)) {
      return;
    }

    setIsBulkDeleting(true);
    setError(null);

    try {
      await Promise.all(selectedIds.map((id) => deleteAgent(token, id)));
      setSelectedIds([]);
      await loadAgents();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete selected agents.');
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleBulkStatusToggle(status: 'ACTIVE' | 'SUSPENDED') {
    if (!token) return;

    setIsBulkUpdating(true);
    setError(null);

    try {
      const promises = selectedIds.map((id) => (status === 'ACTIVE' ? activateAgent(token, id) : suspendAgent(token, id)));
      const results = await Promise.all(promises);
      const updatedIds = new Set(results.map((r) => r.id));
      setAgents((current) => current.map((agent) => (updatedIds.has(agent.id) ? { ...agent, status } : agent)));
      setSelectedIds([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update selected agents.');
    } finally {
      setIsBulkUpdating(false);
    }
  }

  const statusVariant = (status: string) => (status === 'ACTIVE' ? 'success' : 'warning');
  const allSelected = agents.length > 0 && selectedIds.length === agents.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <section className="py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-section font-semibold text-ink">Agents</h1>
          <p className="mt-1 text-body text-ink-secondary">Manage field and call-center agents.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/assignments" className="btn btn-secondary gap-2">
            <Users size={16} />
            Assign customers
          </Link>
          <Link to="/admin/agents/new" className="btn btn-primary gap-2">
            <Plus size={16} />
            Add Agent
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-secondary">{selectedIds.length} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() => void handleBulkStatusToggle('ACTIVE')}
                className="btn btn-success btn-sm gap-1"
              >
                Activate
              </button>
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() => void handleBulkStatusToggle('SUSPENDED')}
                className="btn btn-secondary btn-sm gap-1"
              >
                Suspend
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => void handleBulkDelete()}
                className="btn btn-danger btn-sm gap-1"
              >
                <Trash2 size={14} />
                {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="All agents"
        className="mt-6"
      >
        <p className="mb-4 text-body text-ink-muted">
          {agents.length > 0 ? `${agents.length} agent${agents.length === 1 ? '' : 's'} total` : 'No agents found.'}
        </p>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = someSelected;
                      }
                    }}
                    onChange={() => {
                      if (allSelected) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(agents.map((agent) => agent.id));
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th className="text-right">Total calls</th>
                <th className="text-right">Completed customers</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={cellIndex}>
                        <Skeleton height={20} width={cellIndex === 0 ? '60%' : '40%'} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !agents.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No agents yet"
                      description="Get started by creating your first agent."
                      action={
                        <Link to="/admin/agents/new" className="btn btn-primary mt-2">
                          <Plus size={16} />
                          Add Agent
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(agent.id)}
                        onChange={() =>
                          setSelectedIds((current) =>
                            current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id],
                          )
                        }
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="font-medium text-ink">{agent.fullName}</td>
                    <td className="text-ink-secondary">{agent.email}</td>
                    <td>
                      <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                    </td>
                    <td className="text-right text-ink">{agent.totalCalls}</td>
                    <td className="text-right text-ink">{agent.completedCustomers}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link to={`/admin/agents/${agent.id}/edit`} className="btn btn-secondary btn-sm gap-1">
                          <Pencil size={14} />
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="btn btn-success btn-sm gap-1"
                          onClick={() => void handleStatusToggle(agent)}
                        >
                          {agent.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm gap-1"
                          onClick={() => void handleDelete(agent)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
