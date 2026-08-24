export type Modem = {
  id: string;
  name: string;
  port: string | null;
  status: 'READY' | 'BUSY' | 'OFFLINE';
  signalStrength: number | null;
  simNumber: string | null;
  imei: string | null;
  enabled: boolean;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
};

export type ModemUpdate = {
  name?: string;
  port?: string;
  simNumber?: string;
  imei?: string;
  enabled?: boolean;
  status?: Modem['status'];
};
