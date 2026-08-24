import { FormEvent, useState } from 'react';
import { Upload } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { importCustomers } from '../customers/api';
import type { ImportSummary } from '../customers/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

export function CustomersImportPage() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);

    if (!token || !file) {
      setError('Choose a CSV or XLSX file.');
      return;
    }

    setIsUploading(true);

    try {
      setSummary(await importCustomers(token, file));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Import failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-page font-bold text-ink">Import customers</h1>
        <p className="mt-2 text-body text-ink-secondary">Upload a CSV or Excel file to bulk-create customer records.</p>
      </div>

      <Card>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="card">
              <div className="px-6 py-4 text-sm text-danger" role="alert">
                {error}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-body text-ink-secondary">File</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="input mt-2"
            />
          </label>

          <button type="submit" disabled={isUploading} className="btn btn-primary">
            <Upload className="h-4 w-4" />
            {isUploading ? 'Importing...' : 'Import customers'}
          </button>
        </form>
      </Card>

      {summary && (
        <Card title="Import summary" description="Review the results of your import.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card-hover rounded-xl border border-border bg-success-light p-5">
              <p className="text-table text-success">Rows added</p>
              <p className="mt-3 text-card font-semibold text-ink">{summary.added}</p>
            </div>
            <div className="card-hover rounded-xl border border-border bg-warning-light p-5">
              <p className="text-table text-warning">Rows skipped/invalid</p>
              <p className="mt-3 text-card font-semibold text-ink">{summary.skipped}</p>
            </div>
          </div>

          {summary.invalid.length ? (
            <div className="mt-6">
              <h3 className="text-card font-semibold text-ink">Invalid rows</h3>
              <div className="table-container mt-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.invalid.map((issue) => (
                      <tr key={`${issue.row}-${issue.reason}`}>
                        <td className="text-ink-secondary">{issue.row}</td>
                        <td className="text-ink-secondary">{issue.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="All rows valid"
                description="No invalid rows were found in this import."
                icon={<Badge variant="success">OK</Badge>}
              />
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
