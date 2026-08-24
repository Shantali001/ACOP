import * as XLSX from 'xlsx';

import { parseCsv, rowsToCustomers } from './csv.js';
import type { CustomerInput, ImportIssue } from './types.js';

type UploadedFile = {
  filename: string;
  buffer: Buffer;
};

const isDev = process.env.NODE_ENV !== 'production';

function extractMultipartFile(contentType: string, body: Buffer): UploadedFile {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary.');
  }

  const boundary = `--${boundaryMatch[1] ?? boundaryMatch[2]}`;
  const raw = body.toString('binary');
  const parts = raw.split(boundary);

  for (const part of parts) {
    if (!part.includes('Content-Disposition') || !part.includes('filename=')) {
      continue;
    }

    const filenameMatch = part.match(/filename="([^"]+)"/i);
    const headerEnd = part.indexOf('\r\n\r\n');

    if (headerEnd === -1) {
      continue;
    }

    let content = part.slice(headerEnd + 4);
    content = content.replace(/\r\n--$/, '').replace(/\r\n$/, '');

    return {
      filename: filenameMatch?.[1] ?? 'upload',
      buffer: Buffer.from(content, 'binary'),
    };
  }

  throw new Error('No uploaded file found.');
}

function parseXlsx(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (!workbook.SheetNames.length) {
    throw new Error('XLSX file does not contain any worksheets.');
  }

  const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });

  const rows: string[][] = rawRows.map((row) =>
    row.map((value) => {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      return value == null ? '' : String(value);
    }),
  );

  if (isDev) {
    console.debug('[import:upload] parsed XLSX rows (first 3):', JSON.stringify(rows.slice(0, 3)));
  }

  return rows;
}

export function parseCustomerUpload(contentType: string, body: Buffer) {
  let file: UploadedFile;

  if (contentType.includes('multipart/form-data')) {
    file = extractMultipartFile(contentType, body);
  } else {
    file = { filename: 'customers.csv', buffer: body };
  }

  const lowerName = file.filename.toLowerCase();
  let rows: string[][];
  const issues: ImportIssue[] = [];

  if (lowerName.endsWith('.xlsx')) {
    rows = parseXlsx(file.buffer);
  } else if (lowerName.endsWith('.csv') || contentType.includes('text/csv')) {
    rows = parseCsv(file.buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } else {
    return {
      customers: [] as CustomerInput[],
      issues: [{ row: 1, reason: 'Unsupported file type. Upload CSV or XLSX.' }],
    };
  }

  const parsed = rowsToCustomers(rows);

  if (isDev) {
    console.debug('[import:upload] parse result customers:', parsed.customers.length, 'issues:', parsed.issues.length);
  }

  return {
    customers: parsed.customers,
    issues: [...issues, ...parsed.issues],
  };
}
