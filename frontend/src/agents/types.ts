export type Agent = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  totalCalls: number;
  completedCustomers: number;
};

export type AgentInput = {
  fullName: string;
  email: string;
};

export type CreateAgentResponse = {
  agent: Agent;
  temporaryPassword: string;
};