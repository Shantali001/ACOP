import { SerialPort } from 'serialport';

import { env } from '../config/env.js';
import type { IModemDriver, ModemDevice, ModemTestResult } from './types.js';

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseModemResponse(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('ok') ||
    lower.includes('huawei') ||
    lower.includes('simcom') ||
    lower.includes('quectel') ||
    lower.includes('telit') ||
    lower.includes('sierra') ||
    lower.includes('option') ||
    lower.includes('zte') ||
    lower.includes('ericsson') ||
    lower.includes('novatel') ||
    lower.includes('ubiquiti') ||
    lower.includes('factory') ||
    lower.includes('ati') ||
    /\+copps:\s*\d+/.test(lower) ||
    /\+creg:\s*\d+/.test(lower) ||
    /\+cgsn:\s*"/.test(lower) ||
    /\+cgmm:\s*"/.test(lower) ||
    /\+cgmr:\s*"/.test(lower)
  );
}

async function probePort(path: string, baudRate = 115200, timeoutMs = 1500): Promise<{ ok: boolean; info: string }> {
  return new Promise((resolve) => {
    const port = new SerialPort({
      path,
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false,
    });

    let settled = false;
    let portOpened = false;

    const done = (ok: boolean, info = '') => {
      if (settled) return;
      settled = true;
      if (portOpened) {
        try {
          port.close();
        } catch {
          // ignore close errors
        }
      }
      resolve({ ok, info });
    };

    const responses: string[] = [];

    port.open((err) => {
      if (err) {
        done(false, String(err));
        return;
      }

      portOpened = true;

      const onData = (buffer: Buffer) => {
        const text = buffer.toString('utf8');
        responses.push(text);
        if (parseModemResponse(text)) {
          port.removeAllListeners('data');
          done(true, responses.join(' '));
        }
      };

      port.on('data', onData);

      const checkTimer = setTimeout(() => {
        port.removeListener('data', onData);
        done(false, responses.length ? `unrecognized: ${responses.join(' ')}` : 'timeout');
      }, timeoutMs);

      const commands = ['AT\r', 'AT+COPS?\r', 'AT+CGMM\r'];
      let commandIndex = 0;

      const sendNext = () => {
        if (commandIndex >= commands.length) {
          clearTimeout(checkTimer);
          port.removeListener('data', onData);
          done(false, responses.length ? `unrecognized: ${responses.join(' ')}` : 'no response');
          return;
        }

        port.write(commands[commandIndex]!, (writeErr) => {
          if (writeErr) {
            clearTimeout(checkTimer);
            port.removeListener('data', onData);
            done(false, String(writeErr));
            return;
          }
          commandIndex += 1;
          setTimeout(sendNext, 250);
        });
      };

      sendNext();
    });

    port.on('error', () => {
      // terminal errors handled in open callback or timer
    });
  });
}

async function listModemPorts(): Promise<string[]> {
  try {
    const ports = await SerialPort.list();
    return ports
      .filter((entry) => typeof entry.path === 'string' && entry.path)
      .map((entry) => entry.path as string)
      .filter((path) => !/bluetooth/i.test(path));
  } catch {
    return [];
  }
}

async function isPortAvailable(path: string): Promise<boolean> {
  const ports = await listModemPorts();
  const normalized = path.trim().toUpperCase();
  return ports.some((port) => port.trim().toUpperCase() === normalized);
}

const windowsComPattern = /^COM\d+$/i;

function commonWindowsComPorts(): string[] {
  const ports: string[] = [];
  for (let index = 1; index <= 32; index += 1) {
    ports.push(`COM${index}`);
  }
  return ports;
}

async function discoverModemPort(excludePaths: string[] = []): Promise<string | null> {
  const excluded = new Set(excludePaths.map((path) => path.trim().toUpperCase()));
  const candidates: string[] = [];

  const ports = await listModemPorts();
  for (const path of ports) {
    if (!candidates.includes(path)) {
      candidates.push(path);
    }
  }

  if (process.platform === 'win32') {
    const commonPorts = commonWindowsComPorts();
    for (const path of commonPorts) {
      if (!candidates.includes(path)) {
        candidates.push(path);
      }
    }
  }

  for (const path of candidates) {
    if (excluded.has(path.trim().toUpperCase())) continue;
    const result = await probePort(path);
    if (result.ok) {
      return path;
    }
  }

  return null;
}

async function discoverAllModemPorts(): Promise<string[]> {
  const candidates: string[] = [];

  const ports = await listModemPorts();
  for (const path of ports) {
    if (!candidates.includes(path)) {
      candidates.push(path);
    }
  }

  if (process.platform === 'win32') {
    const commonPorts = commonWindowsComPorts();
    for (const path of commonPorts) {
      if (!candidates.includes(path)) {
        candidates.push(path);
      }
    }
  }

  const results = await Promise.all(
    candidates.map(async (path) => {
      const result = await probePort(path);
      return result.ok ? path : null;
    }),
  );

  return results.filter((path): path is string => Boolean(path));
}

let cachedPort: string | null = null;

// Remembers the last port that actually answered AT commands for a given
// modem id, so dial/hangup/answer (which must stay fast and can't safely
// re-probe a port that may already be open for an active call) can trust it
// between explicit health checks.
const knownGoodPortByModem = new Map<string, string>();

export type PortCorrectionEvent = {
  modemId: string;
  previousPort: string | null;
  newPort: string;
};

type PortCorrectionHandler = (event: PortCorrectionEvent) => void | Promise<void>;

let portCorrectionHandler: PortCorrectionHandler | null = null;

// Lets the routes layer (which owns the DB connection) find out whenever the
// driver discovers that a modem's real, working port no longer matches what
// is stored in the database — e.g. the OS reassigned COM17 to COM16 — so it
// can persist the fix instead of requiring someone to edit it by hand.
export function onPortCorrected(handler: PortCorrectionHandler) {
  portCorrectionHandler = handler;
}

async function notifyCorrection(modemId: string | undefined, previousPort: string | null, newPort: string) {
  if (!modemId || newPort === previousPort) return;
  knownGoodPortByModem.set(modemId, newPort);
  cachedPort = newPort;
  if (portCorrectionHandler) {
    try {
      await portCorrectionHandler({ modemId, previousPort, newPort });
    } catch (err) {
      console.log(`[serialport] port-correction-handler-failed: modemId=${modemId} error=${(err as Error).message}`);
    }
  }
}

export class SerialModemDriver implements IModemDriver {
  // Ports that are currently "in a call" — kept open across ATD -> ATH so that
  // closing the connection between commands doesn't drop DTR and hang up the call.
  private activeCallPorts = new Map<string, SerialPort>();

  private async openPersistentPort(portPath: string): Promise<SerialPort> {
    const existing = this.activeCallPorts.get(portPath);
    if (existing && existing.isOpen) return existing;

    console.log(`[serialport] persistent-open-start: path=${portPath}`);

    const port = new SerialPort({
      path: portPath,
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false,
    });

    await new Promise<void>((resolve, reject) => {
      port.on('error', () => {});
      port.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`[serialport] persistent-open-ok: path=${portPath}`);

    // Many terminal tools (RealTerm, PuTTY, etc.) assert DTR/RTS the moment
    // they open a port — the OS/driver default for a raw Node open may leave
    // these lines low, and some modems only fully engage voice-call handling
    // once DTR/RTS are actually asserted. Match that terminal behavior here.
    try {
      await new Promise<void>((resolve, reject) => {
        port.set({ dtr: true, rts: true }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`[serialport] dtr-rts-set-ok: path=${portPath}`);
    } catch (err) {
      console.log(`[serialport] dtr-rts-set-failed: path=${portPath} error=${(err as Error).message}`);
    }

    port.once('close', () => {
      if (this.activeCallPorts.get(portPath) === port) {
        this.activeCallPorts.delete(portPath);
      }
    });

    // Log every unsolicited byte the modem sends back (RING, NO CARRIER, BUSY,
    // NO ANSWER, CONNECT, +CME ERROR, etc.) so we can see actual call/network
    // status, not just whether the AT command itself was accepted.
    port.on('data', (buffer: Buffer) => {
      const text = buffer.toString('utf8').trim();
      if (text) {
        console.log(`[serialport] modem-data: path=${portPath} data=${JSON.stringify(text)}`);
      }
    });

    // Tell the modem to ignore DTR transitions so a later, unrelated port
    // close (crash, restart, etc.) can't accidentally hang up an active call.
    console.log(`[serialport] at-command: path=${portPath} command=AT&D0`);
    try {
      await new Promise<void>((resolve) => {
        port.write('AT&D0\r', () => resolve());
      });
    } catch {
      // Non-fatal if the modem doesn't support this setting.
    }

    this.activeCallPorts.set(portPath, port);
    return port;
  }

  private async closePersistentPort(portPath: string): Promise<void> {
    const port = this.activeCallPorts.get(portPath);
    if (!port) return;

    this.activeCallPorts.delete(portPath);

    if (!port.isOpen) return;

    console.log(`[serialport] persistent-close-start: path=${portPath}`);
    await new Promise<void>((resolve) => {
      port.close(() => resolve());
    });
    console.log(`[serialport] persistent-close-ok: path=${portPath}`);
  }

  // Fast path used by dial/hangup/answer, which must not add probing latency
  // or risk opening a second connection to a port that may already be held
  // open for an active call. It trusts the configured/cached port and does
  // NOT verify it — verification and self-healing happen in test().
  async resolvePort(modem?: ModemDevice): Promise<string> {
    const hint = modem?.port ?? env.modemSerialPort;

    if (hint && hint.trim()) {
      const direct = hint.trim();
      cachedPort = direct;
      if (modem?.id) knownGoodPortByModem.set(modem.id, direct);
      return direct;
    }

    const modemCached = modem?.id ? knownGoodPortByModem.get(modem.id) : null;
    if (modemCached) return modemCached;

    if (cachedPort) return cachedPort;

    const discovered = await discoverModemPort();
    if (discovered) {
      await notifyCorrection(modem?.id, hint ?? null, discovered);
      return discovered;
    }

    throw new Error(
      'Serial modem port is not configured and no modem was auto-discovered. ' +
        'Connect a modem or set MODEM_SERIAL_PORT to a valid COM/tty path.',
    );
  }

  private async sendCommand(modem: ModemDevice, command: string): Promise<void> {
    const portPath = await this.resolvePort(modem);
    await this.sendCommandOnPath(portPath, command);
  }

  private async sendCommandOnPath(portPath: string, command: string): Promise<void> {
    const normalized = portPath.trim();
    if (!normalized) throw new Error('Serial modem port is not configured.');

    const activeCallPort = this.activeCallPorts.get(normalized);
    if (activeCallPort && activeCallPort.isOpen) {
      // A call is already using this port — reuse the open connection instead
      // of trying to open a second, conflicting one.
      await new Promise<void>((resolve, reject) => {
        activeCallPort.write(`${command}\r`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return;
    }

    const port = new SerialPort({
      path: normalized,
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false,
    });

    let portOpened = false;

    try {
      await new Promise<void>((resolve, reject) => {
        port.on('error', () => {});
        port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      portOpened = true;

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const onError = (err: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          port.removeListener('error', onError);
        };

        port.once('error', onError);

        port.write(`${command}\r`, (writeErr) => {
          if (writeErr) {
            onError(writeErr);
            return;
          }
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        });
      });
    } finally {
      if (portOpened) {
        try {
          await new Promise<void>((resolve, reject) => {
            port.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch {
          // ignore close errors
        }
      }
    }
  }

  // This is the one place that actually verifies a modem's configured port
  // still works, and self-heals when it doesn't: if the stored/hinted port
  // no longer responds (classic symptom: Windows reassigned the COM port
  // number on reconnect), it scans for whatever port DOES respond right now
  // and, if found, adopts it and reports the correction via
  // onPortCorrected() so the caller can persist it to the database.
  async test(modem: ModemDevice, options: { excludePorts?: string[] } = {}): Promise<ModemTestResult> {
    const hint = (modem.port ?? env.modemSerialPort)?.trim() || null;
    // Ports already known to belong to other modems, so auto-discovery for
    // this modem never "steals" a port that's already correctly assigned
    // elsewhere.
    const excludePorts = (options.excludePorts ?? []).filter((path) => path.trim().toUpperCase() !== hint?.toUpperCase());

    try {
      let portToUse = hint;

      if (portToUse) {
        const probe = await probePort(portToUse, 115200, 1200);
        if (!probe.ok) {
          console.log(`[serialport] configured-port-unresponsive: modemId=${modem.id} port=${portToUse}, searching for working port`);
          portToUse = await discoverModemPort(excludePorts);
        }
      } else {
        portToUse = await discoverModemPort(excludePorts);
      }

      if (!portToUse) {
        throw new Error(
          hint
            ? `Configured port ${hint} is not responding, and no other working modem port was found.`
            : 'No modem port is configured and none could be auto-discovered.',
        );
      }

      await this.sendCommandOnPath(portToUse, 'AT');

      const corrected = portToUse !== hint;
      if (corrected) {
        await notifyCorrection(modem.id, hint, portToUse);
      } else {
        knownGoodPortByModem.set(modem.id, portToUse);
        cachedPort = portToUse;
      }

      return {
        modemId: modem.id,
        online: true,
        status: 'READY',
        message: corrected
          ? `Port auto-corrected from ${hint ?? '(none set)'} to ${portToUse}.`
          : 'AT command sent successfully.',
      };
    } catch (error) {
      return {
        modemId: modem.id,
        online: false,
        status: 'OFFLINE',
        message: error instanceof Error ? error.message : 'Serial modem test failed.',
      };
    }
  }

  async dial(modem: ModemDevice, phoneNumber: string) {
    const portPath = await this.resolvePort(modem);
    const port = await this.openPersistentPort(portPath);

    console.log(`[serialport] dial-start: path=${portPath} number=${phoneNumber}`);
    try {
      await new Promise<void>((resolve, reject) => {
        port.write(`ATD${phoneNumber};\r`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`[serialport] dial-ok: path=${portPath} number=${phoneNumber}`);
    } catch (err) {
      console.log(`[serialport] dial-fail: path=${portPath} number=${phoneNumber} error=${(err as Error).message}`);
      throw err;
    }
    // Port intentionally stays open here — closing it now would drop DTR
    // and, on most modems, immediately hang up the call that was just dialed.
  }

  async hangup(modem: ModemDevice) {
    const portPath = await this.resolvePort(modem);
    const port = await this.openPersistentPort(portPath);

    console.log(`[serialport] hangup-start: path=${portPath}`);
    try {
      await new Promise<void>((resolve, reject) => {
        port.write('AT+CHUP\r', (err) => {
          if (err) {
            console.log(`[serialport] hangup-write-fail: path=${portPath} error=${(err as Error).message}`);
            reject(err);
          } else {
            console.log(`[serialport] hangup-write-ok: path=${portPath}`);
            resolve();
          }
        });
      });
    } finally {
      await wait(2000);
      await this.closePersistentPort(portPath);
    }
  }

  async answer(modem: ModemDevice) {
    const portPath = await this.resolvePort(modem);
    const port = await this.openPersistentPort(portPath);

    console.log(`[serialport] answer-start: path=${portPath}`);
    await new Promise<void>((resolve, reject) => {
      port.write('ATA\r', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[serialport] answer-ok: path=${portPath}`);
  }
}

export class MockModemDriver implements IModemDriver {
  async test(modem: ModemDevice): Promise<ModemTestResult> {
    await wait(120);
    return {
      modemId: modem.id,
      online: modem.enabled,
      status: modem.enabled ? 'READY' : 'OFFLINE',
      message: modem.enabled ? 'Mock modem responded to AT.' : 'Mock modem is disabled.',
    };
  }

  async dial(modem: ModemDevice, phoneNumber: string) {
    if (!modem.enabled) throw new Error('Assigned modem is disabled.');
    console.log(`[mock-modem] ${modem.name} dialing ${phoneNumber} with ATD${phoneNumber};`);
  }

  async hangup(modem: ModemDevice) {
    if (!modem.enabled) throw new Error('Assigned modem is disabled.');
    console.log(`[mock-modem] ${modem.name} hangup with ATH`);
  }

  async answer(modem: ModemDevice) {
    if (!modem.enabled) throw new Error('Assigned modem is disabled.');
    console.log(`[mock-modem] ${modem.name} answer with ATA`);
  }
}

export function createModemDriver(): IModemDriver {
  return env.modemDriver === 'serial' ? new SerialModemDriver() : new MockModemDriver();
}

export { discoverModemPort, discoverAllModemPorts, probePort };