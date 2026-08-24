import { ElementType, useEffect, useState } from 'react';
import { BarChart3, Download, FileBarChart, Users } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { getAgentReports, getCampaignReports, getOverallReport } from '../reports/api';
import type { AgentReport, CampaignReport, OverallReport } from '../reports/types';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

type Tab = 'overall' | 'agents' | 'campaigns';

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('overall');
  const [overall, setOverall] = useState<OverallReport | null>(null);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    Promise.all([getOverallReport(token), getAgentReports(token), getCampaignReports(token)])
      .then(([overallResult, agentResults, campaignResults]) => {
        setOverall(overallResult);
        setAgents(agentResults);
        setCampaigns(campaignResults);
        setError(null);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Could not load reports.')
      )
      .finally(() => setIsLoading(false));
  }, [token]);

  const tabs: Array<{ id: Tab; label: string; icon: ElementType }> = [
    { id: 'overall', label: 'Overall', icon: FileBarChart },
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: BarChart3 },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-page text-ink">Reports</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Export campaign, agent and call performance metrics.
          </p>
        </div>
        {!isLoading && overall && (
          <button
            type="button"
            onClick={() => downloadCsv('overall-report.csv', [overall])}
            className="btn btn-secondary"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-danger-light bg-danger-light px-4 py-3 text-body text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`btn ${
                tab === item.id ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overall' && (
        <div className="card card-hover p-6">
          <h2 className="text-section text-ink">Overview</h2>
          {isLoading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : overall ? (
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {Object.entries(overall).map(([key, value]) => (
                <div
                  key={key}
                  className="card-hover rounded-xl border border-border bg-surface p-5"
                >
                  <p className="text-table text-ink-muted">{key}</p>
                  <p className="mt-2 text-card text-primary">{String(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No data available"
                description="Overall report data is not yet available."
                icon={<FileBarChart className="h-12 w-12 text-ink-muted" />}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'agents' && (
        <ReportTable
          rows={agents}
          isLoading={isLoading}
          onExport={() => downloadCsv('agent-report.csv', agents)}
          columns={[
            { header: 'Agent', render: (row) => row.fullName },
            { header: 'Email', render: (row) => row.email },
            { header: 'Calls', render: (row) => row.callsMade },
            {
              header: 'Success',
              render: (row) => (
                <Badge variant="success">{row.successRate}%</Badge>
              ),
            },
          ]}
          emptyTitle="No agent reports found"
          emptyDescription="Agent performance data will appear here once available."
        />
      )}

      {tab === 'campaigns' && (
        <ReportTable
          rows={campaigns}
          isLoading={isLoading}
          onExport={() => downloadCsv('campaign-report.csv', campaigns)}
          columns={[
            { header: 'Campaign', render: (row) => row.campaignName },
            {
              header: 'Status',
              render: (row) => {
                const variant = row.status.toLowerCase() === 'active' ? 'info' : row.status.toLowerCase() === 'completed' ? 'success' : 'warning';
                return <Badge variant={variant}>{row.status}</Badge>;
              },
            },
            { header: 'Progress', render: (row) => `${row.progress}%` },
            { header: 'Completed', render: (row) => row.completed },
            { header: 'Pending', render: (row) => row.pending },
          ]}
          emptyTitle="No campaign reports found"
          emptyDescription="Campaign data will appear here once available."
        />
      )}
    </section>
  );
}

type ReportColumn<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
};

function ReportTable<T extends Record<string, string | number | null>>({
  rows,
  isLoading,
  onExport,
  columns,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[];
  isLoading: boolean;
  onExport: () => void;
  columns: ReportColumn<T>[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isLoading) {
    return (
      <div className="card p-6">
        <Skeleton className="mb-4 h-10 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onExport}
        className="btn btn-secondary"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>

      {rows.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={<BarChart3 className="h-12 w-12 text-ink-muted" />}
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((col) => (
                    <td key={col.header}>{col.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
