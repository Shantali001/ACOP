export type CampaignInput = {
  campaignName: string;
  description?: string | null;
  startDate?: string | null; // ISO date string
  endDate?: string | null;
};

export type CampaignRow = {
  id: string;
  campaign_name: string;
  description: string | null;
  status: 'ACTIVE' | 'CLOSED';
  start_date: string | null;
  end_date: string | null;
};

export type MemberPayload = {
  customerIds: string[];
};
