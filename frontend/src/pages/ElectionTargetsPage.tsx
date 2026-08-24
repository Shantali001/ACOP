import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { getElectionTargets, updateElectionTargets } from '../election/api';

export function ElectionTargetsPage() {
  const { token } = useAuth();
  const [target, setTarget] = useState<{ votesNeededToWin: number; expectedTurnoutPercent: number }>({ votesNeededToWin: 0, expectedTurnoutPercent: 50 });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getElectionTargets(token).then((data) => {
      if (data.target) {
        setTarget({ votesNeededToWin: data.target.votesNeededToWin, expectedTurnoutPercent: data.target.expectedTurnoutPercent });
      }
    }).catch(() => {});
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaved(null);
    try {
      const res = await updateElectionTargets(token, target);
      setTarget({ votesNeededToWin: res.votesNeededToWin, expectedTurnoutPercent: res.expectedTurnoutPercent });
      setSaved('Targets updated successfully.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.');
    }
  }

  return (
    <section className="py-6 space-y-6">
      <h1 className="text-page font-bold text-ink">Election Targets</h1>
      <p className="text-body text-ink-muted">Set votes needed to win and expected turnout percentage for projection math.</p>

      {error && <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}
      {saved && <div className="rounded-lg border border-success/20 bg-success-light px-4 py-3 text-sm text-success">{saved}</div>}

      <Card>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-secondary">Votes needed to win</span>
              <input type="number" min="0" value={target.votesNeededToWin} onChange={(e) => setTarget({ ...target, votesNeededToWin: Number(e.target.value) })} className="input" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-secondary">Expected turnout (%)</span>
              <input type="number" min="0" max="100" step="0.01" value={target.expectedTurnoutPercent} onChange={(e) => setTarget({ ...target, expectedTurnoutPercent: Number(e.target.value) })} className="input" required />
            </label>
          </div>
          <button type="submit" className="btn btn-primary gap-2">
            <Target size={16} />
            Save Targets
          </button>
        </form>
      </Card>
    </section>
  );
}
