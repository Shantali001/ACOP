export type Assignment = {
  id: string;
  campaignId: string;
  customerId: string;
  agentId: string;
  assignmentStatus: 'ACTIVE' | 'COMPLETED' | 'REASSIGNED';
  createdAt?: string;
};

export type CreateAssignmentsResponse = {
  data: Assignment[];
  assigned: number;
};