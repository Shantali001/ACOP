export type AgentInput = {
  fullName: string;
  email: string;
};

export type AgentRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  total_calls: string | number;
  completed_customers: string | number;
};