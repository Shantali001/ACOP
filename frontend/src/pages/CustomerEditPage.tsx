import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { getCustomer, updateCustomer } from '../customers/api';
import { CustomerForm } from '../customers/CustomerForm';
import type { Customer, CustomerPayload } from '../customers/types';
import { Card } from '../components/ui/Card';

export function CustomerEditPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
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

  async function handleSubmit(payload: CustomerPayload) {
    if (!token || !id) {
      return;
    }

    const updated = await updateCustomer(token, id, payload);
    navigate(`/admin/customers/${updated.id}`);
  }

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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-page font-bold text-ink">Edit customer</h1>
          <p className="mt-2 text-body text-ink-secondary">Update customer contact and location details.</p>
        </div>
        <Link to={`/admin/customers/${customer.id}`} className="btn btn-secondary gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <Card>
        <CustomerForm customer={customer} submitLabel="Save changes" onSubmit={handleSubmit} />
      </Card>
    </section>
  );
}
