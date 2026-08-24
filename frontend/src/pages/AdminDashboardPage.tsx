import { useAuth } from '../auth/useAuth';
import { useDashboardData } from '../dashboards/hooks/useDashboardData';
import { FilterBar } from '../dashboards/components/FilterBar';
import { SummaryCards } from '../dashboards/components/SummaryCards';
import { SupportDistributionChart } from '../dashboards/components/SupportDistributionChart';
import { NewSupportersTrend } from '../dashboards/components/NewSupportersTrend';
import { CallsPerAgentChart } from '../dashboards/components/CallsPerAgentChart';
import { SupportersByWardChart } from '../dashboards/components/SupportersByWardChart';
import { SupportersVsOppositionLGA } from '../dashboards/components/SupportersVsOppositionLGA';
import { AgentLeaderboard } from '../dashboards/components/AgentLeaderboard';
import { DailyCallActivity } from '../dashboards/components/DailyCallActivity';
import { ConversionRateWidget } from '../dashboards/components/ConversionRateWidget';
import { RecentActivity } from '../dashboards/components/RecentActivity';

export function AdminDashboardPage() {
  const { token } = useAuth();
  const { data, isLoading, error, filters, updateFilters, refresh } = useDashboardData(token);

  const handleTrendPeriodChange = (period: string) => {
    updateFilters({ trendPeriod: period as '24h' | '7d' | '30d' | '12m' });
  };

  const handleCallActivityChange = (period: string) => {
    updateFilters({ callActivity: period as 'daily' | 'weekly' | 'monthly' });
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-page font-bold text-ink">Campaign Dashboard</h1>
        <p className="text-body text-ink-muted">
          Real-time campaign performance overview and analytics. Data generated at:{' '}
          {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        filterOptions={data.filterOptions}
        onFilterChange={updateFilters}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {/* Summary Cards */}
      <SummaryCards data={data.summaryCards} isLoading={isLoading} />

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SupportDistributionChart data={data.supportDistribution} isLoading={isLoading} />
        <NewSupportersTrend
          data={data.newSupportersTrend}
          isLoading={isLoading}
          onPeriodChange={handleTrendPeriodChange}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CallsPerAgentChart data={data.callsPerAgent} isLoading={isLoading} />
        <SupportersByWardChart data={data.supportersByWard} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SupportersVsOppositionLGA data={data.supportersVsOppositionLGA} isLoading={isLoading} />
        <DailyCallActivity
          data={data.dailyCallActivity}
          isLoading={isLoading}
          onPeriodChange={handleCallActivityChange}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionRateWidget data={data.conversion} isLoading={isLoading} />
        <AgentLeaderboard data={data.agentLeaderboard} isLoading={isLoading} />
      </div>

      {/* Recent Activity - full width */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="lg:col-span-2 xl:col-span-3">
          <RecentActivity data={data.recentActivity} isLoading={isLoading} />
        </div>
      </div>
    </section>
  );
}

