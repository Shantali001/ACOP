import { createModemDriver } from './drivers.js';
import type { IModemDriver, ModemDevice } from './types.js';

export class ModemController {
  private readonly activeCalls = new Map<string, { modemId: string; phoneNumber: string; startedAt: Date; assignmentId?: string; customerName?: string }>();

  constructor(private readonly driver: IModemDriver) {}

  async test(modem: ModemDevice, options?: { excludePorts?: string[] }) {
    return this.driver.test(modem, options);
  }

  async dial(agentId: string, modem: ModemDevice, phoneNumber: string, metadata: { assignmentId?: string; customerName?: string } = {}) {
    await this.driver.dial(modem, phoneNumber);
    this.activeCalls.set(agentId, { modemId: modem.id, phoneNumber, startedAt: new Date(), ...metadata });

    return this.activeCalls.get(agentId)!;
  }

  async hangup(agentId: string, modem: ModemDevice) {
    await this.driver.hangup(modem);
    const activeCall = this.activeCalls.get(agentId) ?? null;
    this.activeCalls.delete(agentId);

    return activeCall;
  }

  getActiveCall(agentId: string) {
    return this.activeCalls.get(agentId) ?? null;
  }

  listActiveCalls() {
    return Array.from(this.activeCalls.entries()).map(([agentId, activeCall]) => ({ agentId, ...activeCall }));
  }
}

export const modemController = new ModemController(createModemDriver());