import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

import { dialCustomer, getAgentModemStatus, getNextCustomer, hangupCall, saveCall } from '../agent/api';
import type { AgentModemStatusResponse, NextCustomer, QueueSummary } from '../agent/types';
import { useAuth } from '../auth/useAuth';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

const outcomes = [
  'ANSWERED',
  'BUSY',
  'NO_ANSWER',
  'SWITCHED_OFF',
  'WRONG_NUMBER',
  'CALL_BACK_LATER',
  'SUPPORTER',
  'UNDECIDED',
  'NOT_INTERESTED',
  'FOLLOW_UP_REQUIRED',
  'NUMBER_UNREACHABLE',
  'INVALID_NUMBER',
];

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function queuePosition(summary: QueueSummary) {
  if (summary.totalAssigned <= 0) return 0;
  return Math.min(summary.completed + 1, summary.totalAssigned);
}

export function NextCustomerPage() {
  const { token } = useAuth();
  const [customer, setCustomer] = useState<NextCustomer | null>(null);
  const [summary, setSummary] = useState<QueueSummary>({ totalAssigned: 0, completed: 0, remaining: 0 });
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modemStatus, setModemStatus] = useState<AgentModemStatusResponse | null>(null);
  const [isModemLoading, setIsModemLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    getNextCustomer(token)
      .then((result) => {
        setCustomer(result.customer);
        setSummary(result.summary);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Could not load queue.'));
  }, [token]);

  useEffect(() => {
    if (!isCalling) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isCalling]);

  useEffect(() => {
    if (!token) return;

    setIsModemLoading(true);
    getAgentModemStatus(token)
      .then(setModemStatus)
      .catch(() => setModemStatus(null))
      .finally(() => setIsModemLoading(false));
  }, [token]);

  const currentNumber = useMemo(() => queuePosition(summary), [summary]);

  async function handleCall() {
    if (!token || !customer) return;

    setIsDialing(true);
    setError(null);

    try {
      await dialCustomer(token, customer.assignmentId);
      setIsCalling(true);
      await refreshModemStatus();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not dial customer.');
    } finally {
      setIsDialing(false);
    }
  }

  async function handleEndCall() {
    if (!token) return;

    setIsDialing(true);
    setError(null);

    try {
      await hangupCall(token);
      setIsCalling(false);
      await refreshModemStatus();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not hang up call.');
    } finally {
      setIsDialing(false);
    }
  }

  async function refreshModemStatus() {
    if (!token) return;
    setIsModemLoading(true);
    try {
      const status = await getAgentModemStatus(token);
      setModemStatus(status);
    } catch {
      setModemStatus(null);
    } finally {
      setIsModemLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !customer) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveCall(token, customer.assignmentId, outcome, notes, elapsedSeconds);
      setCustomer(result.customer);
      setSummary(result.summary);
      setNotes('');
      setOutcome('');
      setElapsedSeconds(0);
      setIsCalling(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save call.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!customer) {
    return (
      <section className="py-6">
        <Card title="Queue complete" description="Review the campaign summary below.">
          <div className="px-6 py-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-success-light text-success">
                <span className="text-2xl font-bold">✓</span>
              </div>
              <h2 className="text-section font-semibold text-ink">All caught up</h2>
              <p className="text-body text-ink-secondary">No customers remain in your queue.</p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card>
                <div className="px-6 py-5">
                  <p className="text-table text-ink-muted">Total assigned</p>
                  <p className="mt-3 text-section font-semibold text-ink">{summary.totalAssigned}</p>
                </div>
              </Card>
              <Card>
                <div className="px-6 py-5">
                  <p className="text-table text-ink-muted">Completed</p>
                  <p className="mt-3 text-section font-semibold text-ink">{summary.completed}</p>
                </div>
              </Card>
              <Card>
                <div className="px-6 py-5">
                  <p className="text-table text-ink-muted">Remaining</p>
                  <p className="mt-3 text-section font-semibold text-ink">{summary.remaining}</p>
                </div>
              </Card>
            </div>

            {error && (
              <div className="mt-6 card">
                <div className="px-6 py-4 text-sm text-danger" role="alert">
                  {error}
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-section font-semibold text-ink">
            Customer #{currentNumber} of {summary.totalAssigned}
          </h1>
          <p className="mt-1 text-body text-ink-secondary">{customer.campaignName ?? 'Campaign queue'}</p>
        </div>
        <Card className="flex flex-1 min-w-0 flex-col items-end justify-center px-5 py-4 sm:flex-none sm:min-w-[200px]">
          <p className="text-table text-ink-muted">Call timer</p>
          <p className="mt-2 text-section font-semibold text-ink">{formatSeconds(elapsedSeconds)}</p>
        </Card>
        <Card className="flex flex-1 min-w-0 flex-col justify-center px-5 py-4 sm:flex-none sm:min-w-[220px]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-table text-ink-muted">Modem</p>
            <button
              type="button"
              onClick={() => void refreshModemStatus()}
              disabled={isModemLoading}
              className="text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
          {isModemLoading && !modemStatus ? (
            <p className="mt-2 text-sm text-ink-muted">Checking modem...</p>
          ) : modemStatus?.modem ? (
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{modemStatus.modem.name}</span>
                <Badge variant={modemStatus.modem.status === 'READY' ? 'success' : modemStatus.modem.status === 'BUSY' ? 'warning' : 'danger'}>
                  {modemStatus.modem.status}
                </Badge>
              </div>
              <p className="mt-1 text-ink-secondary">
                {modemStatus.modem.port ?? 'No port'} · Signal {modemStatus.modem.signalStrength ?? '?'}%
              </p>
              {modemStatus.test && (
                <p className="mt-1 text-xs text-ink-muted">{modemStatus.test.message}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-danger">No modem assigned</p>
          )}
        </Card>
      </div>

      {error && (
        <div className="mt-6 card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-2">
          <div className="px-6 py-5">
            <p className="text-table text-ink-muted">Customer</p>
            <p className="mt-2 text-xl font-semibold text-ink">{customer.customerName}</p>
          </div>
        </Card>
        <Card>
          <div className="px-6 py-5">
            <p className="text-table text-ink-muted">Phone</p>
            <p className="mt-2 text-xl font-semibold text-ink">{customer.phoneNumber}</p>
          </div>
        </Card>
        <Card>
          <div className="px-6 py-5">
            <p className="text-table text-ink-muted">Ward</p>
            <p className="mt-2 text-xl font-semibold text-ink">{customer.ward ?? 'Not set'}</p>
          </div>
        </Card>
        <Card>
          <div className="px-6 py-5">
            <p className="text-table text-ink-muted">LGA</p>
            <p className="mt-2 text-xl font-semibold text-ink">{customer.lga ?? 'Not set'}</p>
          </div>
        </Card>
      </div>

      <form className="mt-6" onSubmit={handleSave}>
        <Card title="Log call">
          <div className="px-6 py-6">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Status</span>
                <select
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select outcome</option>
                  {outcomes.map((item) => (
                    <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input"
                  placeholder="Call notes"
                  rows={4}
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCall()}
                disabled={isDialing || isCalling}
                className="btn btn-primary gap-2"
              >
                <Phone size={16} />
                {isDialing && !isCalling ? 'DIALING...' : 'CALL'}
              </button>
              <button
                type="button"
                onClick={() => void handleEndCall()}
                disabled={!isCalling || isDialing}
                className="btn btn-secondary gap-2"
              >
                <PhoneOff size={16} />
                END CALL
              </button>
              <button
                type="submit"
                disabled={isSaving || !outcome}
                className="btn btn-primary gap-2"
              >
                {isSaving ? 'SAVING...' : 'SAVE & NEXT'}
              </button>
            </div>
          </div>
        </Card>
      </form>
    </section>
  );
}
