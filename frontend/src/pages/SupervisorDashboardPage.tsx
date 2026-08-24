import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { getSupervisorDashboard } from '../dashboards/api';
import type { SupervisorAgent } from '../dashboards/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'Not calling';
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatDate(value: string | null) {
  if (!value) return 'No activity';
  return new Date(value).toLocaleString();
}

export function SupervisorDashboardPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<SupervisorAgent[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSupervisor = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSupervisorDashboard(token);
      setAgents(result.agents);
      setGeneratedAt(result.generatedAt);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load supervisor dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSupervisor();
    const intervalId = window.setInterval(() => {
      void loadSupervisor();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadSupervisor]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page font-bold text-ink">Supervisor Dashboard</h1>
          <p className="mt-2 text-body text-ink-secondary">Live agent status, refreshed every 5 seconds.</p>
        </div>
        <button type="button" onClick={() => void loadSupervisor()} className="btn btn-secondary gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="text-sm text-ink-muted">
        {isLoading ? 'Refreshing...' : generatedAt ? `Last updated ${formatDate(generatedAt)}` : 'Waiting for data'}
      </div>

      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      <Card>
        <div className="table-container border-0 shadow-none">
          {isLoading && !agents.length ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ) : !agents.length ? (
            <EmptyState
              title="No agents found"
              description="Agent status will appear here once available."
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Current Customer</th>
                  <th>Modem</th>
                  <th>Call Duration</th>
                  <th>Calls Today</th>
                  <th>Remaining</th>
                  <th>Avg Time</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td>
                      <div className="font-medium text-ink">{agent.fullName}</div>
                      <div className="text-xs text-ink-muted">{agent.email}</div>
                    </td>
                    <td>
                      <Badge variant={agent.onlineStatus === 'ACTIVE' ? 'success' : 'neutral'}>{agent.onlineStatus}</Badge>
                    </td>
                    <td className="text-ink-secondary">{agent.currentCustomer ?? 'None'}</td>
                    <td>
                      <div className="text-ink-secondary">{agent.assignedModem ?? 'Unassigned'}</div>
                      <div className="text-xs text-ink-muted">{agent.assignedModemStatus ?? 'Unknown'}</div>
                    </td>
                    <td className="text-ink-secondary">{formatDuration(agent.currentCallDuration)}</td>
                    <td className="text-ink-secondary">{agent.callsCompletedToday}</td>
                    <td className="text-ink-secondary">{agent.customersRemaining}</td>
                    <td className="text-ink-secondary">{formatDuration(agent.averageCallTime)}</td>
                    <td className="text-ink-secondary">{formatDate(agent.lastActivityTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </section>
  );
}
