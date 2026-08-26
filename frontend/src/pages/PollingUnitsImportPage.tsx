import { useMemo, useState } from 'react';
import { Upload, Plus, Pencil, Trash2 } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { createPollingUnit, deletePollingUnit, getPollingUnits, importPollingUnits, updatePollingUnit } from '../election/api';
import type { PollingUnit } from '../election/types';

const emptyForm = { puCode: '', puName: '', ward: '', lga: '', state: '', registeredVoters: 0, fieldAgentName: '', fieldAgentPhone: '' };

export function PollingUnitsImportPage() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number; invalid: { row: number; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pus, setPus] = useState<PollingUnit[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const filteredPus = useMemo(() => {
    if (!search.trim()) return pus;
    const q = search.toLowerCase();
    return pus.filter((pu) => pu.puCode.toLowerCase().includes(q) || pu.puName.toLowerCase().includes(q) || pu.ward.toLowerCase().includes(q) || pu.lga.toLowerCase().includes(q));
  }, [pus, search]);

  async function loadPus() {
    const list = await getPollingUnits(token!, { pageSize: 1000 });
    setPus(list.data);
  }

  async function handleImport() {
    if (!token || !file) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importPollingUnits(token, file);
      setResult(res);
      await loadPus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await createPollingUnit(token, form);
      setForm(emptyForm);
      await loadPus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Create failed.');
    }
  }

  function startEdit(pu: PollingUnit) {
    setEditingId(pu.id);
    setEditForm({
      puCode: pu.puCode,
      puName: pu.puName,
      ward: pu.ward,
      lga: pu.lga,
      state: pu.state,
      registeredVoters: pu.registeredVoters,
      fieldAgentName: pu.fieldAgentName ?? '',
      fieldAgentPhone: pu.fieldAgentPhone ?? '',
    });
  }

  async function handleUpdate() {
    if (!token || !editingId) return;
    setError(null);
    try {
      await updatePollingUnit(token, editingId, editForm);
      setEditingId(null);
      setEditForm(emptyForm);
      await loadPus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Update failed.');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm('Delete this polling unit?')) return;
    try {
      await deletePollingUnit(token, id);
      await loadPus();
    } catch {
      setError('Delete failed.');
    }
  }

  return (
    <section className="py-6 space-y-6">
      <h1 className="text-page font-bold text-ink">Polling Units</h1>
      <p className="text-body text-ink-muted">Bulk import or manually manage polling units.</p>

      {error && <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Bulk import">
          <div className="px-6 py-5 space-y-4">
            <label className="flex items-center gap-3">
              <Upload size={20} className="text-ink-muted" />
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />
            </label>
            <button onClick={() => void handleImport()} disabled={!file || isLoading} className="btn btn-primary">
              {isLoading ? 'IMPORTING...' : 'IMPORT'}
            </button>
            {result && (
              <div className="text-sm text-ink-secondary">
                Imported {result.added} polling units. Skipped {result.skipped}.
              </div>
            )}
          </div>
        </Card>

        <Card title="Add polling unit">
          <form onSubmit={handleCreate} className="px-6 py-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">PU Code</span>
                <input type="text" value={form.puCode} onChange={(e) => setForm({ ...form, puCode: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">PU Name</span>
                <input type="text" value={form.puName} onChange={(e) => setForm({ ...form, puName: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Ward</span>
                <input type="text" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">LGA</span>
                <input type="text" value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">State</span>
                <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Registered Voters</span>
                <input type="number" min="0" value={form.registeredVoters} onChange={(e) => setForm({ ...form, registeredVoters: Number(e.target.value) })} className="input" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Field Agent Name</span>
                <input type="text" value={form.fieldAgentName} onChange={(e) => setForm({ ...form, fieldAgentName: e.target.value })} className="input" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Field Agent Phone</span>
                <input type="text" value={form.fieldAgentPhone} onChange={(e) => setForm({ ...form, fieldAgentPhone: e.target.value })} className="input" />
              </label>
            </div>
            <button type="submit" className="btn btn-primary gap-2"><Plus size={16} /> Add</button>
          </form>
        </Card>
      </div>

      <Card title="Polling Units">
        <div className="px-6 py-5 space-y-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Search PU code, name, ward, or LGA..." />
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>PU Code</th>
                  <th>Name</th>
                  <th>Ward</th>
                  <th>LGA</th>
                  <th>State</th>
                  <th>Registered Voters</th>
                  <th>Field Agent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPus.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-ink-muted">No polling units found.</td></tr>
                ) : (
                  filteredPus.map((pu) => (
                    <tr key={pu.id}>
                      {editingId === pu.id ? (
                        <>
                          <td><input type="text" value={editForm.puCode} onChange={(e) => setEditForm({ ...editForm, puCode: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="text" value={editForm.puName} onChange={(e) => setEditForm({ ...editForm, puName: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="text" value={editForm.ward} onChange={(e) => setEditForm({ ...editForm, ward: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="text" value={editForm.lga} onChange={(e) => setEditForm({ ...editForm, lga: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="text" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="number" value={editForm.registeredVoters} onChange={(e) => setEditForm({ ...editForm, registeredVoters: Number(e.target.value) })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td><input type="text" value={editForm.fieldAgentName} onChange={(e) => setEditForm({ ...editForm, fieldAgentName: e.target.value })} className="input h-8 text-xs sm:text-sm" /></td>
                          <td>
                            <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                              <button onClick={() => void handleUpdate()} className="btn btn-sm btn-primary w-full sm:w-auto">Save</button>
                              <button onClick={() => { setEditingId(null); setEditForm(emptyForm); }} className="btn btn-sm btn-secondary w-full sm:w-auto">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-medium">{pu.puCode}</td>
                          <td>{pu.puName}</td>
                          <td>{pu.ward}</td>
                          <td>{pu.lga}</td>
                          <td>{pu.state}</td>
                          <td>{pu.registeredVoters}</td>
                          <td>{pu.fieldAgentName ?? '—'}</td>
                          <td>
                            <div className="flex gap-2">
                              <button onClick={() => startEdit(pu)} className="btn btn-sm"><Pencil size={14} /></button>
                              <button onClick={() => handleDelete(pu.id)} className="btn btn-sm btn-danger"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </>
                      )}
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
