export type CustomerGenderBreakdown = {
  name: string;
  value: number;
};

export type AdminDashboardMetrics = {
  generatedAt: string;
  totalCustomers: number;
  totalAgents: number;
  activeAgents: number;
  connectedModems: number;
  activeCampaigns: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  pendingCustomers: number;
  completedCustomers: number;
  successRate: number;
  customerGenderBreakdown: CustomerGenderBreakdown[];
};

export type AgentDashboardMetrics = {
  assignedCustomers: number;
  remaining: number;
  completed: number;
  callsToday: number;
  averageCallDuration: number;
  currentCampaign: string | null;
};

export type SupervisorAgent = {
  agentId: string;
  fullName: string;
  email: string;
  onlineStatus: 'ACTIVE' | 'SUSPENDED';
  currentCustomer: string | null;
  assignedModem: string | null;
  assignedModemStatus: string | null;
  currentCallDuration: number | null;
  callsCompletedToday: number;
  customersRemaining: number;
  averageCallTime: number;
  lastActivityTime: string | null;
};

export type SupervisorResponse = {
  generatedAt: string;
  agents: SupervisorAgent[];
};

// ── New Campaign Dashboard Types ──────────────────────────────

export type SummaryCardData = {
  value: number;
  change: number; // percentage increase/decrease
};

export type SummaryCards = {
  totalSupporters: SummaryCardData;
  totalOpposition: SummaryCardData;
  totalUndecided: SummaryCardData;
  newSupportersToday: SummaryCardData;
  newSupportersThisWeek: SummaryCardData;
  callsMadeToday: SummaryCardData;
  activeAgents: SummaryCardData;
  totalRegisteredSupporters: SummaryCardData;
};

export type SupportDistributionItem = {
  name: string;
  value: number;
  color: string;
};

export type TrendDataPoint = {
  period: string;
  count: number;
};

export type AgentCallsData = {
  agentName: string;
  agentId: string;
  calls: number;
};

export type WardData = {
  ward: string;
  count: number;
};

export type LGAData = {
  lga: string;
  supporters: number;
  opposition: number;
  undecided: number;
};

export type AgentLeaderboardEntry = {
  agentId: string;
  agentName: string;
  email: string;
  callsCompleted: number;
  supportersRegistered: number;
  successRate: number;
};

export type CallActivityData = {
  period: string;
  calls: number;
};

export type ConversionData = {
  callsMade: number;
  answeredCalls: number;
  supportersGained: number;
  conversionRate: number;
};

export type ActivityItem = {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  createdAt: string;
};

export type FilterOptions = {
  states: string[];
  lgas: string[];
  wards: string[];
  agents: { id: string; name: string }[];
};

export type CampaignDashboardData = {
  generatedAt: string;
  summaryCards: SummaryCards;
  supportDistribution: SupportDistributionItem[];
  newSupportersTrend: TrendDataPoint[];
  callsPerAgent: AgentCallsData[];
  supportersByWard: WardData[];
  supportersVsOppositionLGA: LGAData[];
  agentLeaderboard: AgentLeaderboardEntry[];
  dailyCallActivity: CallActivityData[];
  conversion: ConversionData;
  recentActivity: ActivityItem[];
  filterOptions: FilterOptions;
};

export type DashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  lga?: string;
  ward?: string;
  agentId?: string;
  trendPeriod?: '24h' | '7d' | '30d' | '12m';
  callActivity?: 'daily' | 'weekly' | 'monthly';
};

