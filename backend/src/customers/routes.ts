import express, { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { writeAuditLog } from '../audit/helper.js';
import { pool } from '../db/pool.js';
import { customersToCsv } from './csv.js';
import { parseCustomerUpload } from './upload.js';
import type { CustomerInput, CustomerRow, ImportIssue } from './types.js';
import { mapCustomer, validateCustomerInput } from './validation.js';

export const customersRouter = Router();

customersRouter.use(requireAuth);

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function searchWhere(search: unknown) {
  const values: unknown[] = [];

  if (typeof search !== 'string' || !search.trim()) {
    return { clause: '', values };
  }

  values.push(`%${search.trim()}%`);

  return {
    clause: `
      where full_name ilike $1
         or phone_number ilike $1
         or ward ilike $1
         or lga ilike $1
         or state ilike $1
    `,
    values,
  };
}

async function insertCustomer(customer: CustomerInput) {
  const result = await pool.query<CustomerRow>(
    `
      insert into customers (full_name, phone_number, ward, polling_unit, lga, state, gender)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
    `,
    [
      customer.fullName,
      customer.phoneNumber,
      customer.ward,
      customer.pollingUnit,
      customer.lga,
      customer.state,
      customer.gender,
    ],
  );

  return result.rows[0];
}

customersRouter.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { clause, values } = searchWhere(req.query.search);
    const listParams = [...values, pageSize, offset];
    const countResult = await pool.query<{ count: string }>(
      `select count(*)::text as count from customers ${clause}`,
      values,
    );
    const result = await pool.query<CustomerRow>(
      `
        select id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
        from customers
        ${clause}
        order by created_at desc
        limit $${values.length + 1}
        offset $${values.length + 2}
      `,
      listParams,
    );

    res.json({
      data: result.rows.map(mapCustomer),
      page,
      pageSize,
      total: Number(countResult.rows[0]?.count ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/export', async (req, res, next) => {
  try {
    const { clause, values } = searchWhere(req.query.search);
    const result = await pool.query<CustomerRow>(
      `
        select id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
        from customers
        ${clause}
        order by created_at desc
      `,
      values,
    );
    const csv = customersToCsv(result.rows.map(mapCustomer));

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

customersRouter.post('/export-selected', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const ids = ((req.body?.ids ?? []) as string[]).filter((id) => typeof id === 'string' && id.trim());

    if (!ids.length) {
      res.status(400).json({ message: 'No customer IDs provided.' });
      return;
    }

    const result = await pool.query<CustomerRow>(
      `
        select id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
        from customers
        where id = any($1::uuid[])
        order by created_at desc
      `,
      [ids],
    );
    const csv = customersToCsv(result.rows.map(mapCustomer));

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="selected_customers.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/ids', async (req, res, next) => {
  try {
    const { clause, values } = searchWhere(req.query.search);
    const result = await pool.query<{ id: string }>(
      `
        select id
        from customers
        ${clause}
        order by created_at desc
      `,
      values,
    );

    res.json({ ids: result.rows.map((row) => row.id) });
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query<CustomerRow>(
      `
        select id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
        from customers
        where id = $1
      `,
      [req.params.id],
    );
    const customer = result.rows[0];

    if (!customer) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    res.json(mapCustomer(customer));
  } catch (error) {
    next(error);
  }
});

customersRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { customer, errors } = validateCustomerInput(req.body as Record<string, unknown>);

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const created = await insertCustomer(customer);
    await writeAuditLog({
      userId: req.user!.id,
      action: 'customer.created',
      entityType: 'customer',
      entityId: created.id,
    });
    res.status(201).json(mapCustomer(created));
  } catch (error) {
    next(error);
  }
});

customersRouter.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { customer, errors } = validateCustomerInput(req.body as Record<string, unknown>);

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const result = await pool.query<CustomerRow>(
      `
        update customers
        set full_name = $2,
            phone_number = $3,
            ward = $4,
            polling_unit = $5,
            lga = $6,
            state = $7,
            gender = $8
        where id = $1
        returning id, full_name, phone_number, ward, polling_unit, lga, state, gender, created_at
      `,
      [
        req.params.id,
        customer.fullName,
        customer.phoneNumber,
        customer.ward,
        customer.pollingUnit,
        customer.lga,
        customer.state,
        customer.gender,
      ],
    );
    const updated = result.rows[0];

    if (!updated) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    await writeAuditLog({ userId: req.user!.id, action: 'customer.updated', entityType: 'customer', entityId: updated.id });
    res.json(mapCustomer(updated));
  } catch (error) {
    next(error);
  }
});

customersRouter.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await pool.query('delete from customers where id = $1 returning id', [
      req.params.id,
    ]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Customer not found.' });
      return;
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: 'customer.deleted',
      entityType: 'customer',
      entityId: req.params.id,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

customersRouter.post(
  '/import',
  requireRole('ADMIN'),
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res, next) => {
    try {
      const { customers, issues } = parseCustomerUpload(
        req.header('content-type') ?? '',
        Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
      );
      const insertIssues: ImportIssue[] = [];
      let added = 0;

      for (const [index, customer] of customers.entries()) {
        try {
          await insertCustomer(customer);
          added += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Insert failed.';
          insertIssues.push({ row: index + 2, reason });
        }
      }

      await writeAuditLog({
        userId: req.user!.id,
        action: 'customer.imported',
        entityType: 'customer_import',
        metadata: {
          added,
          skipped: issues.length + insertIssues.length,
        },
      });

      res.json({
        added,
        skipped: issues.length + insertIssues.length,
        invalid: [...issues, ...insertIssues],
      });
    } catch (error) {
      next(error);
    }
  },
);
