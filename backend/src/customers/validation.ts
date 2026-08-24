import type { CustomerInput } from './types.js';

const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;

function normalizeOptional(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequired(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export interface ValidationContext {
  rowNumber?: number;
}

export function validateCustomerInput(input: Record<string, unknown>, context: ValidationContext = {}) {
  const customer: CustomerInput = {
    fullName: normalizeRequired(input.fullName ?? input.full_name),
    phoneNumber: normalizeRequired(input.phoneNumber ?? input.phone_number),
    ward: normalizeOptional(input.ward),
    pollingUnit: normalizeOptional(input.pollingUnit ?? input.polling_unit),
    lga: normalizeOptional(input.lga),
    state: normalizeOptional(input.state),
    gender: normalizeOptional(input.gender),
  };
  const errors: string[] = [];

  const rowPrefix = context.rowNumber ? `Row ${context.rowNumber}: ` : '';

  if (!customer.fullName) {
    errors.push(`${rowPrefix}Full name is required.`);
  }

  if (!customer.phoneNumber) {
    errors.push(`${rowPrefix}Phone number is required.`);
  } else if (!phonePattern.test(customer.phoneNumber)) {
    errors.push(`${rowPrefix}Phone number format is invalid.`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[import:validation] ${rowPrefix}input:`, input, 'errors:', errors);
  }

  return { customer, errors };
}

export function mapCustomer(row: import('./types.js').CustomerRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    ward: row.ward,
    pollingUnit: row.polling_unit,
    lga: row.lga,
    state: row.state,
    gender: row.gender,
    createdAt: row.created_at,
  };
}
