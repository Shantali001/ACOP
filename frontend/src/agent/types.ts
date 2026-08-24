export type QueueSummary = {
  totalAssigned: number;
  completed: number;
  remaining: number;
};

export type NextCustomer = {
  assignmentId: string;
  campaignId: string | null;
  campaignName: string | null;
  customerId: string | null;
  customerName: string;
  phoneNumber: string;
  ward: string | null;
  lga: string | null;
  status: string;
};

export type NextCustomerResponse = {
  customer: NextCustomer | null;
  summary: QueueSummary;
};

export type SaveCallResponse = NextCustomerResponse & {
  callId: string;
};

export type AgentModem = {
  id: string;
  name: string;
  port: string | null;
  status: 'READY' | 'BUSY' | 'OFFLINE';
  signalStrength: number | null;
  simNumber: string | null;
  imei: string | null;
  enabled: boolean;
};

export type AgentModemTest = {
  modemId: string;
  online: boolean;
  status: 'READY' | 'BUSY' | 'OFFLINE';
  message: string;
};

export type AgentModemStatusResponse = {
  modem: AgentModem | null;
  test: AgentModemTest | null;
};