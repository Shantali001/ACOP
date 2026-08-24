import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { UserPlus, Users, Search } from 'lucide-react';

import { listAgents } from '../agents/api';
import type { Agent } from '../agents/types';
import { createAssignments } from '../assignments/api';
import { useAuth } from '../auth/useAuth';
import { listCampaigns } from '../campaigns/api';
import type { Campaign } from '../campaigns/types';
import { listCustomers } from '../customers/api';
import type { Customer } from '../customers/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const pageSize = 10;

export function AssignmentPage() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const pageRef = useRef(page);
  pageRef.current = page;

  const loadCustomers = useCallback(
    async (targetPage: number) => {
      if (!token) return;

      setIsLoadingCustomers(true);
      setError(null);
      setSelectedCustomerIds([]);

      try {
        const result = await listCustomers(token, search, targetPage, pageSize);
        setCustomers(result.data);
        setPage(result.page);
        setTotal(result.total);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load customers.');
      } finally {
        setIsLoadingCustomers(false);
      }
    },
    [search, token],
  );

  useEffect(() => {
    if (!token) return;

    Promise.all([listCampaigns(token, 'ACTIVE'), listAgents(token)])
      .then(([campaignResults, agentResults]) => {
        setCampaigns(campaignResults);
        setAgents(agentResults.filter((agent) => agent.status === 'ACTIVE'));
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Could not load assignment data.'));

    void loadCustomers(1);
  }, [token, loadCustomers]);

  function toggleCustomer(customerId: string) {
    setSelectedCustomerIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId],
    );
  }

  function toggleAllCustomers() {
    if (selectedCustomerIds.length === customers.length && customers.length > 0) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(customers.map((customer) => customer.id));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsAssigning(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createAssignments(token, campaignId, agentId, selectedCustomerIds);
      setSelectedCustomerIds([]);
      setMessage(`${result.assigned} customer assignment(s) created.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not assign customers.');
    } finally {
      setIsAssigning(false);
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const allSelected = customers.length > 0 && selectedCustomerIds.length === customers.length;
  const someSelected = selectedCustomerIds.length > 0 && !allSelected;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-page font-bold text-ink">Customer Assignment</h1>
        <p className="mt-2 text-body text-ink-secondary">Assign selected customers to an active agent for a campaign.</p>
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

      <Card title="New assignment">
        <form className="grid gap-4 xl:grid-cols-[280px_280px_1fr]" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-body text-ink-secondary">Campaign</span>
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="input mt-2" required>
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.campaignName}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-body text-ink-secondary">Agent</span>
            <select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="input mt-2" required>
              <option value="">Select agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.fullName}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button type="submit" disabled={isAssigning || !selectedCustomerIds.length} className="btn btn-primary">
              <UserPlus className="h-4 w-4" />
              {isAssigning ? 'Assigning...' : `Assign ${selectedCustomerIds.length} selected`}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-muted" />
            <h2 className="text-card font-semibold text-ink">Customers</h2>
            {!isLoadingCustomers && (
              <Badge variant="neutral">{total}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers"
              className="input max-w-md"
            />
            <button type="button" onClick={() => void loadCustomers(1)} className="btn btn-primary">
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="table-container border-0 shadow-none">
          {isLoadingCustomers && !customers.length ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : !customers.length ? (
            <EmptyState
              title="No customers found"
              description="Try adjusting your search or add new customers."
            />
          ) : (
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
                      onChange={toggleAllCustomers}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Ward</th>
                  <th>LGA</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
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
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-secondary">
          Page {page} of {totalPages} - {total} customers
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void loadCustomers(page - 1)}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => void loadCustomers(page + 1)}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
