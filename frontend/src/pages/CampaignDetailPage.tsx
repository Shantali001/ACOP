import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCcw, Phone, UserPlus, UserCheck } from 'lucide-react';

import { listAgents } from '../agents/api';
import type { Agent } from '../agents/types';
import { reassignAssignment } from '../assignments/api';
import { useAuth } from '../auth/useAuth';
import { getCampaign, getCampaignStats, listMembers, addMembers, activateCampaign, closeCampaign } from '../campaigns/api';
import { listCustomers } from '../customers/api';
import type { Campaign, CampaignStats, MembersListResponse } from '../campaigns/types';
import type { Customer } from '../customers/types';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function CampaignDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [members, setMembers] = useState<MembersListResponse | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [reassignAgentByAssignment, setReassignAgentByAssignment] = useState<Record<string, string>>({});

  const loadCampaignDetails = useCallback(async () => {
    if (!token || !id) return;

    try {
      const [statsResult, membersResult] = await Promise.all([getCampaignStats(token, id), listMembers(token, id)]);
      setStats(statsResult);
      setMembers(membersResult);
    } catch {
      setStats(null);
      setMembers(null);
    }
  }, [id, token]);

  const loadAvailableCustomers = useCallback(
    async (page = 1) => {
      if (!token) return;

      setIsSearchingCustomers(true);
      try {
        const result = await listCustomers(token, customerSearch, page, 10);
        setAvailableCustomers(result.data);
        setCustomerPage(result.page);
        setCustomerTotal(result.total);
      } catch {
        setAvailableCustomers([]);
        setCustomerPage(1);
        setCustomerTotal(0);
      } finally {
        setIsSearchingCustomers(false);
      }
    },
    [customerSearch, token],
  );

  useEffect(() => {
    if (!token || !id) return;

    setCampaignError(null);
    getCampaign(token, id)
      .then(setCampaign)
      .catch((error) => setCampaignError(error instanceof Error ? error.message : 'Unable to load campaign.'));

    void loadCampaignDetails();
    void loadAvailableCustomers(1);
    listAgents(token).then((result) => setAgents(result.filter((agent) => agent.status === 'ACTIVE'))).catch(() => setAgents([]));
  }, [id, loadAvailableCustomers, loadCampaignDetails, token]);

  function toggleCustomerSelection(customerId: string) {
    setSelectedCustomerIds((current) =>
      current.includes(customerId) ? current.filter((idToRemove) => idToRemove !== customerId) : [...current, customerId],
    );
  }

  async function handleAddSelectedCustomers() {
    if (!token || !id || !selectedCustomerIds.length) return;

    setIsUpdatingMembers(true);
    try {
      await addMembers(token, id, selectedCustomerIds);
      setSelectedCustomerIds([]);
      await Promise.all([loadCampaignDetails(), loadAvailableCustomers(customerPage)]);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Unable to add campaign members.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  async function handleCampaignStatusChange(status: 'ACTIVE' | 'CLOSED') {
    if (!token || !id) return;

    setIsUpdatingMembers(true);
    try {
      const result = status === 'ACTIVE' ? await activateCampaign(token, id) : await closeCampaign(token, id);
      if (campaign) {
        setCampaign({ ...campaign, status: result.status as Campaign['status'] });
      }
      await loadCampaignDetails();
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Unable to update campaign status.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  async function handleReassign(assignmentId: string) {
    if (!token) return;

    const agentId = reassignAgentByAssignment[assignmentId];
    if (!agentId) {
      setCampaignError('Select an agent before reassigning.');
      return;
    }

    setIsUpdatingMembers(true);
    setCampaignError(null);

    try {
      await reassignAssignment(token, assignmentId, agentId);
      setReassignAgentByAssignment((current) => ({ ...current, [assignmentId]: '' }));
      await loadCampaignDetails();
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Unable to reassign customer.');
    } finally {
      setIsUpdatingMembers(false);
    }
  }

  const customerTotalPages = Math.max(Math.ceil(customerTotal / 10), 1);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-page font-bold text-ink">{campaign?.campaignName ?? 'Campaign details'}</h1>
          <p className="mt-2 text-body text-ink-secondary">Overview, members and available customers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign?.status === 'CLOSED' ? (
            <button
              type="button"
              disabled={isUpdatingMembers}
              onClick={() => void handleCampaignStatusChange('ACTIVE')}
              className="btn btn-primary gap-2"
            >
              <Phone className="h-4 w-4" />
              Activate campaign
            </button>
          ) : (
            <button
              type="button"
              disabled={isUpdatingMembers}
              onClick={() => void handleCampaignStatusChange('CLOSED')}
              className="btn btn-secondary gap-2"
            >
              Close campaign
            </button>
          )}
          <Link to={`/admin/campaigns`} className="btn btn-secondary gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      {campaignError && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {campaignError}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Status" value={campaign?.status ?? 'Not set'} />
        <StatCard label="Start" value={campaign?.startDate ?? 'Not set'} />
        <StatCard label="End" value={campaign?.endDate ?? 'Not set'} />
        <StatCard label="Members" value={String(stats?.totalMembers ?? 'Not set')} />
        <StatCard label="Assigned" value={String(stats?.totalAssigned ?? 'Not set')} />
        <StatCard label="Completed" value={String(stats?.completed ?? 'Not set')} />
        <StatCard label="Pending" value={String(stats?.pending ?? 'Not set')} />
      </div>

      {campaign?.description && (
        <Card>
          <p className="text-table text-ink-muted">Description</p>
          <p className="mt-2 text-body text-ink">{campaign.description}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Add customers to campaign" description="Search existing customers and add them to this campaign.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search available customers"
                className="input"
              />
              <button
                type="button"
                onClick={() => void loadAvailableCustomers(1)}
                className="btn btn-primary"
              >
                Search
              </button>
            </div>
            <button
              type="button"
              onClick={() => void loadAvailableCustomers(1)}
              className="btn btn-secondary gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="table-container mt-4">
            {isSearchingCustomers && !availableCustomers.length ? (
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ) : !availableCustomers.length ? (
              <EmptyState
                title="No customers found"
                description="Try adjusting your search."
              />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Ward</th>
                    <th>LGA</th>
                  </tr>
                </thead>
                <tbody>
                  {availableCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="font-medium text-ink">{customer.fullName}</td>
                      <td className="text-ink-secondary">{customer.phoneNumber}</td>
                      <td className="text-ink-secondary">{customer.ward}</td>
                      <td className="text-ink-secondary">{customer.lga}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-secondary">
                {selectedCustomerIds.length} customer(s) selected
              </span>
              <button
                type="button"
                onClick={() => void handleAddSelectedCustomers()}
                disabled={!selectedCustomerIds.length || isUpdatingMembers}
                className="btn btn-primary gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add selected customers
              </button>
            </div>
            <span className="text-sm text-ink-muted">
              Page {customerPage} of {customerTotalPages}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={customerPage <= 1}
              onClick={() => void loadAvailableCustomers(customerPage - 1)}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={customerPage >= customerTotalPages}
              onClick={() => void loadAvailableCustomers(customerPage + 1)}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </Card>

        <Card title="Campaign members" description="Customers already assigned to this campaign.">
          <div className="table-container border-0 shadow-none">
            {!members?.data.length ? (
              <EmptyState
                title="No members found"
                description="Add customers to this campaign to get started."
              />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Ward</th>
                    <th>LGA</th>
                    <th>Agent</th>
                    <th className="text-right">Reassign</th>
                  </tr>
                </thead>
                <tbody>
                  {members.data.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium text-ink">{m.full_name}</td>
                      <td className="text-ink-secondary">{m.phone_number}</td>
                      <td className="text-ink-secondary">{m.ward}</td>
                      <td className="text-ink-secondary">{m.lga}</td>
                      <td className="text-ink-secondary">{m.agent_name ?? 'Unassigned'}</td>
                      <td>
                        {m.assignment_id ? (
                          <div className="flex justify-end gap-2">
                            <select
                              value={reassignAgentByAssignment[m.assignment_id] ?? ''}
                              onChange={(event) => setReassignAgentByAssignment((current) => ({ ...current, [m.assignment_id!]: event.target.value }))}
                              className="input h-9 w-auto"
                            >
                              <option value="">Agent</option>
                              {agents.filter((agent) => agent.id !== m.agent_id).map((agent) => (
                                <option key={agent.id} value={agent.id}>{agent.fullName}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={isUpdatingMembers || !reassignAgentByAssignment[m.assignment_id]}
                              onClick={() => void handleReassign(m.assignment_id!)}
                              className="btn btn-secondary btn-sm gap-1"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Reassign
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-muted">No assignment</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-table text-ink-muted">{label}</p>
      <p className="mt-3 text-card font-semibold text-ink">{value}</p>
    </Card>
  );
}
