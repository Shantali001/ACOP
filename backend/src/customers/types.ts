export type CustomerInput = {
  fullName: string;
  phoneNumber: string;
  ward: string | null;
  pollingUnit?: string | null;
  lga: string | null;
  state: string | null;
  gender?: string | null;
};

export type CustomerRow = {
  id: string;
  full_name: string;
  phone_number: string;
  ward: string;
  polling_unit: string | null;
  lga: string;
  state: string;
  gender: string | null;
  created_at: Date;
};

export type ImportIssue = {
  row: number;
  reason: string;
};
