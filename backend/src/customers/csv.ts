import type { CustomerInput, ImportIssue } from './types.js';
import { validateCustomerInput, type ValidationContext } from './validation.js';

type ParsedImport = {
  customers: CustomerInput[];
  issues: ImportIssue[];
};

type HeaderMap = {
  original: string;
  normalized: string;
  mapped: keyof CustomerInput | null;
};

const isDev = process.env.NODE_ENV !== 'production';

const headerAliases: Record<string, keyof CustomerInput> = {
  fullname: 'fullName',
  full_name: 'fullName',
  firstname: 'fullName',
  lastname: 'fullName',
  surname: 'fullName',
  customername: 'fullName',
  name: 'fullName',
  phonenumber: 'phoneNumber',
  phone_number: 'phoneNumber',
  phoneno: 'phoneNumber',
  phone_no: 'phoneNumber',
  phone: 'phoneNumber',
  mobilenumber: 'phoneNumber',
  mobile_number: 'phoneNumber',
  mobileno: 'phoneNumber',
  mobile_no: 'phoneNumber',
  tel: 'phoneNumber',
  telephone: 'phoneNumber',
  telephone_number: 'phoneNumber',
  tel_number: 'phoneNumber',
  contactnumber: 'phoneNumber',
  contact_number: 'phoneNumber',
  number: 'phoneNumber',
  whatsappnumber: 'phoneNumber',
  whatsapp_number: 'phoneNumber',
  whatsapp: 'phoneNumber',
  ward: 'ward',
  constituency: 'ward',
  pollingunit: 'pollingUnit',
  polling_unit: 'pollingUnit',
  pollingunitname: 'pollingUnit',
  polling_unit_name: 'pollingUnit',
  pu: 'pollingUnit',
  lga: 'lga',
  localgovernmentarea: 'lga',
  local_government_area: 'lga',
  localgovernment: 'lga',
  local_government: 'lga',
  lg: 'lga',
  state: 'state',
  stateoforigin: 'state',
  state_of_origin: 'state',
  stateofresidence: 'state',
  state_of_residence: 'state',
  region: 'state',
  gender: 'gender',
  sex: 'gender',
};

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

export function rowsToCustomers(rows: string[][]): ParsedImport {
  const [headers, ...dataRows] = rows;
  const customers: CustomerInput[] = [];
  const issues: ImportIssue[] = [];

  if (!headers || !headers.some((header) => header.trim())) {
    return { customers, issues: [{ row: 1, reason: 'File is empty or missing headers.' }] };
  }

  const mappedHeaders: HeaderMap[] = headers.map((header) => ({
    original: header.trim(),
    normalized: normalizeHeader(header),
    mapped: headerAliases[normalizeHeader(header)] ?? null,
  }));

  if (isDev) {
    console.debug('[import:csv] headers:', mappedHeaders);
  }

  dataRows.forEach((values, index) => {
    const input: Record<string, unknown> = {};

    mappedHeaders.forEach((header, headerIndex) => {
      if (header.mapped) {
        input[header.mapped] = values[headerIndex]?.trim() ?? '';
      }
    });

    if (isDev && index === 0) {
      console.debug('[import:csv] first parsed row input:', input);
    }

    const { customer, errors } = validateCustomerInput(input, {
      rowNumber: index + 2,
    });
    const rowNumber = index + 2;

    if (errors.length) {
      issues.push({ row: rowNumber, reason: errors.join(' ') });
    } else {
      customers.push(customer);
    }
  });

  return { customers, issues };
}

export function customersToCsv(customers: ReturnType<typeof import('./validation.js').mapCustomer>[]) {
  const headers = ['Full Name', 'Phone Number', 'Ward', 'Polling Unit', 'LGA', 'State', 'Gender'];
  const rows = customers.map((customer) => [
    customer.fullName,
    customer.phoneNumber,
    customer.ward,
    customer.pollingUnit ?? '',
    customer.lga,
    customer.state,
    customer.gender ?? '',
  ]);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(','),
    )
    .join('\r\n');
}
