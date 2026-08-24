export type AssignmentInput = {
  campaignId: string;
  agentId: string;
  customerIds: string[];
};

export type AssignmentRow = {
  id: string;
  campaign_id: string;
  customer_id: string;
  agent_id: string;
  assignment_status: 'ACTIVE' | 'COMPLETED' | 'REASSIGNED';
  created_at?: string;
};