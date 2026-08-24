import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Calendar, FileText, Filter, Search, X } from 'lucide-react';

import { listAuditLogs } from '../audit/api';
import type { AuditLog } from '../audit/types';
import { useAuth } from '../auth/useAuth';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const FILTER_KEYS = ['user', 'action', 'entity', 'search'] as const;

function getActionBadgeVariant(action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('remove')) return 'danger';
  if (lower.includes('update') || lower.includes('edit') || lower.includes('change')) return 'warning';
  if (lower.includes('create') || lower.includes('add') || lower.includes('login')) return 'success';
  if (lower.includes('export') || lower.includes('view')) return 'info';
  return 'neutral';
}

export function AuditLogPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    user: '',
    action: '',
    entity: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await listAuditLogs(token, filters);
      setLogs(result.data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLogs();
  }

  function clearFilters() {
    setFilters({ user: '', action: '', entity: '', dateFrom: '', dateTo: '', search: '' });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== '');

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-page text-ink">Audit Logs</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Search operational activity by user, action, entity or date.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger-light bg-danger-light px-4 py-3 text-body text-danger">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-ink-muted" />
              <h2 className="text-card text-ink">Filters</h2>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {FILTER_KEYS.map((key) => (
              <label key={key} className="block">
                <span className="text-body text-ink-secondary capitalize">{key}</span>
                <div className="relative mt-2">
                  {key === 'search' && (
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  )}
                  <input
                    value={filters[key]}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [key]: event.target.value }))
                    }
                    placeholder={`Filter by ${key}`}
                    className={`input ${key === 'search' ? 'pl-9' : ''}`}
                  />
                </div>
              </label>
            ))}
            <label className="block">
              <span className="text-body text-ink-secondary">Date from</span>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                  }
                  className="input pl-9"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-body text-ink-secondary">Date to</span>
              <div className="relative mt-2">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, dateTo: event.target.value }))
                  }
                  className="input pl-9"
                />
              </div>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              <Filter className="h-4 w-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      <div className="card card-hover overflow-hidden">
        <div className="table-container border-0 shadow-none">
          {isLoading ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No audit logs found"
                description="Adjust your filters or check back later for activity."
                icon={<FileText className="h-12 w-12 text-ink-muted" />}
              />
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.userName ?? log.userEmail ?? 'System'}</td>
                    <td>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td>{log.entityType ?? '—'}</td>
                    <td>{log.entityId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
