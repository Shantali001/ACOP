import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { createCustomer } from '../customers/api';
import { CustomerForm } from '../customers/CustomerForm';
import type { CustomerPayload } from '../customers/types';
import { Card } from '../components/ui/Card';

export function CustomerCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(payload: CustomerPayload) {
    if (!token) {
      return;
    }

    const customer = await createCustomer(token, payload);
    navigate(`/admin/customers/${customer.id}`);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-page font-bold text-ink">Add customer</h1>
        <p className="mt-2 text-body text-ink-secondary">Create a new permanent citizen or contact record.</p>
      </div>

      <Card>
        <CustomerForm submitLabel="Create customer" onSubmit={handleSubmit} />
      </Card>
    </section>
  );
}
