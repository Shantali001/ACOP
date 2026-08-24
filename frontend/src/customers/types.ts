export type Customer = {
  id: string;
  fullName: string;
  phoneNumber: string;
  ward: string;
  pollingUnit: string | null;
  lga: string;
  state: string;
  gender: string | null;
  createdAt: string;
};

export type CustomerPayload = {
  fullName: string;
  phoneNumber: string;
  ward: string;
  pollingUnit: string;
  lga: string;
  state: string;
  gender: string;
};

export type CustomersListResponse = {
  data: Customer[];
  page: number;
  pageSize: number;
  total: number;
};

export type ImportSummary = {
  added: number;
  skipped: number;
  invalid: Array<{
    row: number;
    reason: string;
  }>;
};
