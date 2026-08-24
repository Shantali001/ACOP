export type ModemStatus = 'READY' | 'BUSY' | 'OFFLINE';

export type ModemDevice = {
  id: string;
  name: string;
  port: string | null;
  status: ModemStatus;
  signalStrength: number | null;
  simNumber: string | null;
  imei: string | null;
  enabled: boolean;
};

export type ModemTestResult = {
  modemId: string;
  online: boolean;
  status: ModemStatus;
  message: string;
};

export interface IModemDriver {
  test(modem: ModemDevice, options?: { excludePorts?: string[] }): Promise<ModemTestResult>;
  dial(modem: ModemDevice, phoneNumber: string): Promise<void>;
  hangup(modem: ModemDevice): Promise<void>;
  answer(modem: ModemDevice): Promise<void>;
}