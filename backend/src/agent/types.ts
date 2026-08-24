type AnyRow = Record<string, unknown>;

export type QueueSummary = {
  totalAssigned: number;
  completed: number;
  remaining: number;
};

export type NextCustomer = {
  assignmentId: string;
  campaignId: string | null;
  campaignName: string | null;
  customerId: string | null;
  customerName: string;
  phoneNumber: string;
  ward: string | null;
  lga: string | null;
  status: string;
};

function readString(row: AnyRow, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return fallback;
}

function readNullableString(row: AnyRow, keys: string[]) {
  const value = readString(row, keys);
  return value || null;
}

export function mapQueueSummary(row: AnyRow | undefined): QueueSummary {
  return {
    totalAssigned: Number(row?.total_assigned ?? row?.totalAssigned ?? 0),
    completed: Number(row?.completed ?? row?.completed_customers ?? row?.completedCustomers ?? 0),
    remaining: Number(row?.remaining ?? row?.pending ?? 0),
  };
}

export function mapNextCustomer(row: AnyRow | undefined): NextCustomer | null {
  if (!row) return null;

  const assignmentId = readString(row, ['assignment_id', 'customer_assignment_id', 'id']);
  if (!assignmentId) return null;

  return {
    assignmentId,
    campaignId: readNullableString(row, ['campaign_id']),
    campaignName: readNullableString(row, ['campaign_name', 'campaign']),
    customerId: readNullableString(row, ['customer_id']),
    customerName: readString(row, ['customer_name', 'full_name', 'name'], 'Unknown customer'),
    phoneNumber: readString(row, ['phone_number', 'phone'], 'No phone'),
    ward: readNullableString(row, ['ward']),
    lga: readNullableString(row, ['lga']),
    status: readString(row, ['assignment_status', 'status'], 'ACTIVE'),
  };
}