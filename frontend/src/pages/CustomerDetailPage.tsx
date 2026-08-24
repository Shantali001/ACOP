import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { getCustomer } from '../customers/api';
import type { Customer } from '../customers/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export function CustomerDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    getCustomer(token, id)
      .then(setCustomer)
      .catch((caughtError: unknown) =>
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load customer.'),
      );
  }, [id, token]);

  if (error) {
    return (
      <div className="card">
        <div className="px-6 py-4 text-sm text-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card">
        <div className="px-6 py-8 text-center text-sm text-ink-muted">Loading customer...</div>
      </div>
    );
  }

  const genderVariant = customer.gender === 'MALE' ? 'info' : customer.gender === 'FEMALE' ? 'warning' : 'neutral';

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-page font-bold text-ink">{customer.fullName}</h1>
          <p className="mt-1 text-body text-ink-secondary">Customer profile and contact details.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/customers" className="btn btn-secondary gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link to={`/admin/customers/${customer.id}/edit`} className="btn btn-primary gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Detail label="Phone number" value={customer.phoneNumber} />
        <Detail label="Ward" value={customer.ward} />
        <Detail label="Polling unit" value={customer.pollingUnit ?? 'Not set'} />
        <Detail label="LGA" value={customer.lga} />
        <Detail label="State" value={customer.state} />
        <Detail label="Gender" value={customer.gender ?? 'Not set'} badge={customer.gender ? genderVariant : undefined} />
      </div>
    </section>
  );
}

function Detail({ label, value, badge }: { label: string; value: string; badge?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <Card>
      <p className="text-table text-ink-muted">{label}</p>
      <p className="mt-3 text-card font-semibold text-ink">
        {badge ? <Badge variant={badge}>{value}</Badge> : value}
      </p>
    </Card>
  );
}
