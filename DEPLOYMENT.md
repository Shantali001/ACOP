# ACOP Deployment Guide

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL with `pgcrypto` enabled
- A production `backend/.env`
- A production `frontend/.env`

## Database Setup

Run the original blueprint schema first:

```sql
-- Apply 001_init_schema.sql from the ACOP blueprint package.
```

Then apply repository migrations in order:

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/002_notifications.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/003_audit_logs.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/004_settings.sql
```

The prompt for Phase 8 specifically calls out `002_notifications.sql`; Phase 9 also needs `003_audit_logs.sql` and `004_settings.sql` for audit logs and system settings.

## Backend Environment

Copy `backend/.env.example` to `backend/.env` and set production values:

```bash
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/acop
DATABASE_SSL=true
JWT_SECRET=use-a-long-random-production-secret
JWT_EXPIRES_IN_SECONDS=3600
FRONTEND_ORIGIN=https://your-frontend-domain.example
VERIFY_DB_ON_STARTUP=true
MODEM_DRIVER=mock
MODEM_SERIAL_PORT=COM3
```

Use `MODEM_DRIVER=mock` until GSM hardware is connected and tested.

## Frontend Environment

Copy `frontend/.env.example` to `frontend/.env`:

```bash
VITE_API_BASE_URL=https://your-backend-domain.example
```

## Build

From the repository root:

```bash
npm install
npm run build
```

This builds both workspaces.

## Start Backend

```bash
npm run start --workspace backend
```

In production, run this with a process manager such as systemd, PM2, Docker, or your hosting provider's service runner.

## Serve Frontend

The frontend production bundle is created in `frontend/dist`. Serve it with any static web server, for example Nginx, Caddy, or your hosting provider's static-site service.

For a local production preview:

```bash
npm run preview --workspace frontend
```

## Demo Seed Data

After migrations, create demo users/data:

```bash
npm run seed:demo --workspace backend
```

Default demo credentials:

- Admin: `admin@acop.demo` / `AdminPass123!`
- Agents: `agent1@acop.demo`, `agent2@acop.demo`, `agent3@acop.demo` / `AgentPass123!`

## Integration Tests

Integration tests are DB-backed and skipped unless `TEST_DATABASE_URL` is set.

```bash
set TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/acop_test
npm run test:integration --workspace backend
```

Use a disposable database because tests insert data.

## Real Modem Hardware

Local development uses the mock modem driver. To use real GSM hardware:

```bash
MODEM_DRIVER=serial
MODEM_SERIAL_PORT=COM3
```

Use the correct device path for the host, such as `COM3` on Windows or `/dev/ttyUSB0` on Linux. The serial driver sends:

- `AT` for modem test
- `ATD<number>;` to dial
- `ATH` to hang up
- `ATA` to answer

Also ensure each modem row has correct port/device metadata and each agent is assigned a modem in the admin Modems page.

## Version 1 Module Review

Direct comparison against `AMSAF_ACOP_Project_Blueprint_v1.docx` could not be completed in this workspace because the file was not present under the accessible project folders. Based on the phase prompts implemented here:

- Implemented: authentication, dashboards, customer management, campaign management, agent management, assignment, next customer queue, manual dialer/mock modem integration, reports, notifications, audit logs, system settings.
- Partially implemented: real modem serial control exists as a minimal Node file-handle AT command implementation, but production-grade serial handling should be validated with actual hardware and may need a dedicated serial-port library.
- Deferred or not fully implemented in code: automated backup execution behind `backup_enabled`, full enforcement of stored password policy during password changes, websocket/live push updates, production migration runner, and any blueprint-only requirements not represented in the phase prompts.