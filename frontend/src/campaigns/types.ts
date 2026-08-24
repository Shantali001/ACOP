export type Campaign = {
  id: string;
  campaignName: string;
  description: string | null;
  status: 'ACTIVE' | 'CLOSED';
  startDate: string | null;
  endDate: string | null;
  totalMembers?: number;
  totalAssigned?: number;
  completed?: number;
  pending?: number;
};

export type CampaignInput = {
  campaignName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
};

export type CampaignStats = {
  totalMembers: number;
  totalAssigned: number;
  completed: number;
  pending: number;
};

export type MembersListResponse = {
  data: Array<{
    id: string;
    full_name: string;
    phone_number: string;
    ward: string;
    lga: string;
    state: string;
    created_at: string;
    assignment_id: string | null;
    agent_id: string | null;
    agent_name: string | null;
    assignment_status: 'ACTIVE' | 'COMPLETED' | 'REASSIGNED' | null;
  }>;
  page: number;
  pageSize: number;
  total: number;
};

export type CampaignListResponse = Campaign[];
