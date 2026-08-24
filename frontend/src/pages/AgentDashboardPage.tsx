import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../components/Logo';
import { getAgentDashboard } from '../dashboards/api';
import type { AgentDashboardMetrics } from '../dashboards/types';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ElectionMonitoringPage } from './ElectionMonitoringPage';

const emptyMetrics: AgentDashboardMetrics = {
  assignedCustomers: 0,
  remaining: 0,
  completed: 0,
  callsToday: 0,
  averageCallDuration: 0,
  currentCampaign: null,
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

type StatProps = {
  label: string;
  value: string | number;
  hint?: string;
};

function Stat({ label, value, hint }: StatProps) {
  return (
    <Card className="flex flex-1 flex-col justify-between">
      <div>
        <p className="text-table text-ink-muted">{label}</p>
        <p className="mt-3 text-section font-semibold text-ink">{value}</p>
      </div>
      {hint && <p className="mt-3 text-body text-ink-muted">{hint}</p>}
    </Card>
  );
}

export function AgentDashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<AgentDashboardMetrics>(emptyMetrics);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'customers' | 'election'>('customers');

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    getAgentDashboard(token)
      .then(setMetrics)
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Could not load dashboard.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <section className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo />
          <div>
            <h1 className="text-page font-bold text-ink">Agent Dashboard</h1>
            <p className="mt-1 text-body text-ink-secondary">Your calling queue and activity for today.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('customers')}
            className={`btn ${mode === 'customers' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Customer Calls
          </button>
          <button
            type="button"
            onClick={() => setMode('election')}
            className={`btn ${mode === 'election' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Election Monitoring
          </button>
        </div>
      </div>

      {error && mode === 'customers' && (
        <div className="mt-6 card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      {mode === 'customers' ? (
        <>
          {isLoading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                  <div className="px-6 py-5">
                    <Skeleton height={14} width={120} className="mb-3" />
                    <Skeleton height={32} width={80} />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Stat label="Assigned Customers" value={metrics.assignedCustomers} />
              <Stat label="Remaining" value={metrics.remaining} />
              <Stat label="Completed" value={metrics.completed} hint={`${metrics.assignedCustomers} assigned`} />
              <Stat label="Calls Today" value={metrics.callsToday} />
              <Stat label="Average Call Duration" value={formatDuration(metrics.averageCallDuration)} />
              <Stat label="Current Campaign" value={metrics.currentCampaign ?? 'No active queue'} />
            </div>
          )}
          <div className="mt-6">
            <Link to="/agent/next-customer" className="btn btn-primary gap-2">
              <Phone size={16} />
              Start Calling
            </Link>
          </div>
        </>
      ) : (
        <ElectionMonitoringPage />
      )}
    </section>
  );
}
