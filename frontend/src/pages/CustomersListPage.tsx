import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, Plus, Search, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';

import { deleteCustomer, exportCustomers, exportSelectedCustomers, listAllCustomerIds, listCustomers } from '../customers/api';
import type { Customer } from '../customers/types';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const pageSize = 10;

export function CustomersListPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectAllPages, setSelectAllPages] = useState(false);

  const pageRef = useRef(page);
  pageRef.current = page;

  const loadCustomers = useCallback(
    async (targetPage: number) => {
      if (!token) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setSelectedIds([]);

      try {
        const result = await listCustomers(token, search, targetPage, pageSize);
        setCustomers(result.data);
        setTotal(result.total);
        setPage(result.page);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load customers.');
      } finally {
        setIsLoading(false);
      }
    },
    [search, token],
  );

  useEffect(() => {
    if (!token) return;
    void loadCustomers(1);
  }, [token, search, loadCustomers]);

  function toggleCustomer(customerId: string) {
    setSelectedIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId],
    );
  }

  function togglePageSelection() {
    if (selectedIds.length === customers.length && customers.length > 0) {
      setSelectedIds((current) => current.filter((id) => !customers.some((customer) => customer.id === id)));
    } else {
      const pageIds = customers.map((customer) => customer.id);
      setSelectedIds((current) => {
        const combined = new Set([...current, ...pageIds]);
        return Array.from(combined);
      });
    }
  }

  async function toggleSelectAllPages() {
    if (selectAllPages) {
      setSelectedIds([]);
      setSelectAllPages(false);
    } else {
      if (!token) return;
      try {
        const { ids } = await listAllCustomerIds(token, search);
        setSelectedIds(ids);
        setSelectAllPages(true);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load all customer IDs.');
      }
    }
  }

  async function handleBulkDelete() {
    if (!token || !window.confirm(`Delete ${selectedIds.length} selected customer(s)?`)) {
      return;
    }

    setIsBulkDeleting(true);
    setError(null);

    try {
      await Promise.all(selectedIds.map((id) => deleteCustomer(token, id)));
      setSelectedIds([]);
      setSelectAllPages(false);
      await loadCustomers(pageRef.current);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete selected customers.');
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!token || !window.confirm(`Delete ${customer.fullName}?`)) {
      return;
    }

    await deleteCustomer(token, customer.id);
    await loadCustomers(pageRef.current);
  }

  async function handleExport() {
    if (!token) {
      return;
    }

    const blob = await exportCustomers(token, search);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function handleExportSelected() {
    if (!token || !selectedIds.length) {
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const blob = await exportSelectedCustomers(token, selectedIds);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'selected_customers.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not export selected customers.');
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const pageAllSelected = customers.length > 0 && selectedIds.length === customers.length;
  const pageSomeSelected = selectedIds.some((id) => customers.some((customer) => customer.id === id));
  const allSelected = total > 0 && selectedIds.length === total;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page font-bold text-ink">Customers</h1>
          <p className="mt-2 text-body text-ink-secondary">Permanent citizen/contact records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExport} className="btn btn-secondary gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <Link to="/admin/customers/import" className="btn btn-secondary gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link to="/admin/customers/new" className="btn btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-ink-muted" />
            <h2 className="text-card font-semibold text-ink">All customers</h2>
          </div>
          <div className="flex gap-2">
            <input
              className="input max-w-md"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, ward, LGA, state"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ink-secondary">
              {selectAllPages ? 'All customers selected' : `${selectedIds.length} selected`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportSelected()}
                className="btn btn-secondary btn-sm gap-1"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export selected'}
              </button>
              <Link to="/admin/assignments" state={{ selectedCustomerIds: selectedIds }} className="btn btn-secondary btn-sm gap-1">
                <UserPlus className="h-4 w-4" />
                Assign
              </Link>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => void handleBulkDelete()}
                className="btn btn-danger btn-sm gap-1"
              >
                <Trash2 className="h-4 w-4" />
                {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="table-container border-0 shadow-none">
          {selectedIds.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => void toggleSelectAllPages()}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>
                {allSelected
                  ? 'All customers selected'
                  : `Select all ${total} customers across all pages`}
              </span>
            </div>
          )}
          {isLoading && !customers.length ? (
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
              description="Get started by creating a new customer or importing records."
              action={
                <Link to="/admin/customers/new" className="btn btn-primary mt-2">
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Link>
              }
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = pageSomeSelected && !pageAllSelected;
                        }
                      }}
                      onChange={togglePageSelection}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Ward</th>
                  <th>LGA</th>
                  <th>State</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="font-medium text-ink">{customer.fullName}</td>
                    <td className="text-ink-secondary">{customer.phoneNumber}</td>
                    <td className="text-ink-secondary">{customer.ward}</td>
                    <td className="text-ink-secondary">{customer.lga}</td>
                    <td>
                      <Badge variant="neutral">{customer.state}</Badge>
                    </td>
                     <td>
                       <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                         <Link to={`/admin/customers/${customer.id}`} className="btn btn-secondary btn-sm gap-1 w-full sm:w-auto">
                           <Eye className="h-3.5 w-3.5" />
                           View
                         </Link>
                         <Link to={`/admin/customers/${customer.id}/edit`} className="btn btn-secondary btn-sm gap-1 w-full sm:w-auto">
                           <Pencil className="h-3.5 w-3.5" />
                           Edit
                         </Link>
                         <button
                           type="button"
                           className="btn btn-danger btn-sm gap-1 w-full sm:w-auto"
                           onClick={() => void handleDelete(customer)}
                         >
                           <Trash2 className="h-3.5 w-3.5" />
                           Delete
                         </button>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-secondary">
          Page {page} of {totalPages} · {total} customers
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => void loadCustomers(page - 1)}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => void loadCustomers(page + 1)}
            className="btn btn-secondary btn-sm"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
