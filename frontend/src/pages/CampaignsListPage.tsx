import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { listCampaigns } from '../campaigns/api';
import type { Campaign } from '../campaigns/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function CampaignsListPage() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    listCampaigns(token, statusFilter)
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setIsLoading(false));
  }, [token, statusFilter]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page font-bold text-ink">Campaigns</h1>
          <p className="mt-2 text-body text-ink-secondary">Manage campaign lifecycles and members.</p>
        </div>
        <Link to="/admin/campaigns/new" className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Create campaign
        </Link>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-card font-semibold text-ink">All campaigns</h2>
            {!isLoading && (
              <Badge variant="neutral">{campaigns.length}</Badge>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </Card>

      <Card>
        <div className="table-container border-0 shadow-none">
          {isLoading && !campaigns.length ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : !campaigns.length ? (
            <EmptyState
              title="No campaigns found"
              description="Get started by creating your first campaign."
              action={
                <Link to="/admin/campaigns/new" className="btn btn-primary mt-2">
                  <Plus className="h-4 w-4" />
                  Create campaign
                </Link>
              }
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Pending</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink">{c.campaignName}</td>
                    <td>
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>{c.status}</Badge>
                    </td>
                    <td className="text-ink-secondary">{c.totalMembers ?? 0}</td>
                    <td className="text-ink-secondary">{c.totalAssigned ?? 0}</td>
                    <td className="text-ink-secondary">{c.completed ?? 0}</td>
                    <td className="text-ink-secondary">{c.pending ?? 0}</td>
                    <td className="text-ink-secondary">{c.startDate ?? 'Not set'}</td>
                    <td className="text-ink-secondary">{c.endDate ?? 'Not set'}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link to={`/admin/campaigns/${c.id}`} className="btn btn-secondary btn-sm gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        <Link to={`/admin/campaigns/${c.id}/edit`} className="btn btn-secondary btn-sm gap-1">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </div>
                    </td>
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
