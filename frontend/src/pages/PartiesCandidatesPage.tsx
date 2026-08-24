import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { getPartiesCandidates, createPartyCandidate, updatePartyCandidate, deletePartyCandidate } from '../election/api';
import type { PartyCandidate } from '../election/types';

export function PartiesCandidatesPage() {
  const { token } = useAuth();
  const [parties, setParties] = useState<PartyCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', partyCode: '', isOurParty: false, sortOrder: 0 });

  useEffect(() => {
    if (!token) return;
    getPartiesCandidates(token).then((data) => setParties(data.data)).catch(() => {});
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name) return;
    setError(null);
    try {
      const created = await createPartyCandidate(token, form);
      if (form.isOurParty) {
        const others = parties.filter((p) => !p.isOurParty && p.id !== created.id);
        await Promise.all(others.map((p) => updatePartyCandidate(token, p.id, { isOurParty: false })));
        setParties((prev) => prev.map((p) => (p.id === created.id ? created : { ...p, isOurParty: p.id === created.id })));
      } else {
        setParties((prev) => [...prev, created]);
      }
      setForm({ name: '', partyCode: '', isOurParty: false, sortOrder: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Create failed.');
    }
  }

  async function handleToggleOurParty(id: string, current: boolean) {
    if (!token) return;
    setError(null);
    try {
      if (!current) {
        const others = parties.filter((p) => p.isOurParty && p.id !== id);
        await Promise.all(others.map((p) => updatePartyCandidate(token, p.id, { isOurParty: false })));
        setParties((prev) => prev.map((p) => (p.id === id ? { ...p, isOurParty: true } : { ...p, isOurParty: false })));
      } else {
        await updatePartyCandidate(token, id, { isOurParty: false });
        setParties((prev) => prev.map((p) => (p.id === id ? { ...p, isOurParty: false } : p)));
      }
    } catch {
      setError('Update failed.');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm('Delete this party/candidate?')) return;
    try {
      await deletePartyCandidate(token, id);
      setParties((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Delete failed.');
    }
  }

  return (
    <section className="py-6 space-y-6">
      <h1 className="text-page font-bold text-ink">Parties / Candidates</h1>
      <p className="text-body text-ink-muted">Manage the parties and candidates being tallied during election monitoring.</p>

      {error && <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}

      <Card title="Add party / candidate">
        <form onSubmit={handleCreate} className="px-6 py-5 grid gap-4 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink-secondary">Name</span>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink-secondary">Party code</span>
            <input type="text" value={form.partyCode} onChange={(e) => setForm({ ...form, partyCode: e.target.value })} className="input" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isOurParty} onChange={(e) => setForm({ ...form, isOurParty: e.target.checked })} />
            <span className="text-sm font-medium text-ink-secondary">Our party/candidate</span>
          </label>
          <button type="submit" className="btn btn-primary gap-2"><Plus size={16} /> Add</button>
        </form>
      </Card>

      <Card title="All parties / candidates">
        <div className="px-6 py-5">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Party Code</th>
                  <th>Our Party</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parties.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-ink-muted">No parties/candidates yet.</td></tr>
                ) : (
                  parties.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>{p.partyCode ?? '—'}</td>
                      <td>
                        <button onClick={() => handleToggleOurParty(p.id, p.isOurParty)} className="btn btn-sm">
                          {p.isOurParty ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td>
                        <button onClick={() => handleDelete(p.id)} className="btn btn-sm btn-danger"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </section>
  );
}
