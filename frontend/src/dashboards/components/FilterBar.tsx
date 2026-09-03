import { Search, X } from 'lucide-react';
import type { DashboardFilters, FilterOptions } from '../types';

type Props = {
  filters: DashboardFilters;
  filterOptions: FilterOptions;
  lgas: string[];
  wards: string[];
  isLoadingLgas: boolean;
  isLoadingWards: boolean;
  onFilterChange: (filters: Partial<DashboardFilters>) => void;
  onRefresh: () => void;
  isLoading: boolean;
};

export function FilterBar({ filters, filterOptions, lgas, wards, isLoadingLgas, isLoadingWards, onFilterChange, onRefresh, isLoading }: Props) {
  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const clearFilters = () => {
    onFilterChange({
      dateFrom: undefined,
      dateTo: undefined,
      state: undefined,
      lga: undefined,
      ward: undefined,
      agentId: undefined,
      trendPeriod: undefined,
      callActivity: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">From</label>
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined })}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">To</label>
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onFilterChange({ dateTo: e.target.value || undefined })}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* State */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">State</label>
        <select
          value={filters.state ?? ''}
          onChange={(e) => onFilterChange({ state: e.target.value || undefined })}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">All States</option>
          {filterOptions.states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* LGA */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">LGA</label>
        <select
          value={filters.lga ?? ''}
          onChange={(e) => onFilterChange({ lga: e.target.value || undefined })}
          disabled={!filters.state || isLoadingLgas}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
        >
          <option value="">{isLoadingLgas ? 'Loading...' : 'All LGAs'}</option>
          {lgas.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Ward */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Ward</label>
        <select
          value={filters.ward ?? ''}
          onChange={(e) => onFilterChange({ ward: e.target.value || undefined })}
          disabled={!filters.lga || isLoadingWards}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
        >
          <option value="">{isLoadingWards ? 'Loading...' : 'All Wards'}</option>
          {wards.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      {/* Agent */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Agent</label>
        <select
          value={filters.agentId ?? ''}
          onChange={(e) => onFilterChange({ agentId: e.target.value || undefined })}
          className="h-9 rounded-lg border border-border bg-hover px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">All Agents</option>
          {filterOptions.agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="btn btn-primary flex items-center gap-2 h-9 px-4 text-sm"
        >
          <Search className="h-4 w-4" />
          {isLoading ? 'Loading...' : 'Apply'}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 h-9 rounded-lg px-3 text-sm text-ink-muted transition hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

