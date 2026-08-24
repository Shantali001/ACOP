import { FormEvent, useState } from 'react';

import type { Customer, CustomerPayload } from './types';

const emptyPayload: CustomerPayload = {
  fullName: '',
  phoneNumber: '',
  ward: '',
  pollingUnit: '',
  lga: '',
  state: '',
  gender: '',
};

const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;

type CustomerFormProps = {
  customer?: Customer;
  submitLabel: string;
  onSubmit: (payload: CustomerPayload) => Promise<void>;
};

export function CustomerForm({ customer, submitLabel, onSubmit }: CustomerFormProps) {
  const [payload, setPayload] = useState<CustomerPayload>(() =>
    customer
      ? {
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          ward: customer.ward,
          pollingUnit: customer.pollingUnit ?? '',
          lga: customer.lga,
          state: customer.state,
          gender: customer.gender ?? '',
        }
      : emptyPayload,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof CustomerPayload, value: string) {
    setPayload((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!phonePattern.test(payload.phoneNumber.trim())) {
      setError('Enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Customer save failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" value={payload.fullName} onChange={(value) => updateField('fullName', value)} required />
        <Field label="Phone number" value={payload.phoneNumber} onChange={(value) => updateField('phoneNumber', value)} required />
        <Field label="Ward" value={payload.ward} onChange={(value) => updateField('ward', value)} required />
        <Field label="Polling unit" value={payload.pollingUnit} onChange={(value) => updateField('pollingUnit', value)} />
        <Field label="LGA" value={payload.lga} onChange={(value) => updateField('lga', value)} required />
        <Field label="State" value={payload.state} onChange={(value) => updateField('state', value)} required />
        <Field label="Gender" value={payload.gender} onChange={(value) => updateField('gender', value)} />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-body text-ink-secondary">{label}</span>
      <input
        className="input mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}
