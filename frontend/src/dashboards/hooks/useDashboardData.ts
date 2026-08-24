import { useCallback, useEffect, useState } from 'react';
import { getCampaignDashboard } from '../api';
import type { CampaignDashboardData, DashboardFilters } from '../types';

const emptyData: CampaignDashboardData = {
  generatedAt: '',
  summaryCards: {
    totalSupporters: { value: 0, change: 0 },
    totalOpposition: { value: 0, change: 0 },
    totalUndecided: { value: 0, change: 0 },
    newSupportersToday: { value: 0, change: 0 },
    newSupportersThisWeek: { value: 0, change: 0 },
    callsMadeToday: { value: 0, change: 0 },
    activeAgents: { value: 0, change: 0 },
    totalRegisteredSupporters: { value: 0, change: 0 },
  },
  supportDistribution: [],
  newSupportersTrend: [],
  callsPerAgent: [],
  supportersByWard: [],
  supportersVsOppositionLGA: [],
  agentLeaderboard: [],
  dailyCallActivity: [],
  conversion: { callsMade: 0, answeredCalls: 0, supportersGained: 0, conversionRate: 0 },
  recentActivity: [],
  filterOptions: { states: [], lgas: [], wards: [], agents: [] },
};

export function useDashboardData(token: string | null) {
  const [data, setData] = useState<CampaignDashboardData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});

  const loadData = useCallback(
    async (currentFilters: DashboardFilters) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCampaignDashboard(token, currentFilters);
        setData(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadData(filters);
  }, [loadData, filters]);

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    loadData(filters);
  }, [loadData, filters]);

  return { data, isLoading, error, filters, updateFilters, refresh };
}

