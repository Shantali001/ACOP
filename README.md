# ACOP - AMSAF Campaign Operations Platform

Foundation scaffold for ACOP, the AMSAF call-center campaign operations platform.

## Structure

- `backend/` - Node.js, Express, TypeScript, PostgreSQL connection
- `frontend/` - React, TypeScript, Vite, React Router, Tailwind CSS
- `assets/branding/` - source branding assets copied into the frontend

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database with `001_init_schema.sql` already applied

## Backend setup

```bash
cd backend
cp .env.example .env
```

Update `backend/.env` with your PostgreSQL connection details.
For Supabase, set `DATABASE_SSL=true`. If your database password contains special URL characters such as `@`, encode them in `DATABASE_URL` (`@` becomes `%40`).

```bash
npm install
npm run dev
```

The backend listens on `http://localhost:4000` by default.

Useful endpoints:

- `GET /health` - service status
- `GET /health/db` - verifies PostgreSQL connectivity with `SELECT 1`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on Vite, usually at `http://localhost:5173`.

The shell includes a top nav, sidebar, blank workspace, and AMSAF logo. The login route is available at `/login`.

## Root scripts

From the repository root after installing dependencies:

```bash
npm run dev:backend
npm run dev:frontend
npm run lint
npm run build
npm run format
```

## Module 1 - Authentication

The backend exposes:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/change-password`
- `POST /auth/reset-agent-password`

Logout uses short-lived JWTs plus an in-memory token blacklist. A logged-out token is rejected until it naturally expires. The blacklist resets when the backend process restarts, so production should use short expiry times or a shared revocation store such as Redis.

Password verification and password updates use PostgreSQL `pgcrypto` bcrypt functions:

- Verify: `password_hash = crypt(input_password, password_hash)`
- Hash: `crypt(new_password, gen_salt('bf'))`

Manual auth test steps:

1. Start the backend with `npm run dev:backend`.
2. Start the frontend with `npm run dev:frontend`.
3. Log in on `/login` with an ADMIN user. It should redirect to `/admin/dashboard`.
4. Log out, then log in with an AGENT user. It should redirect to `/agent/dashboard`.
5. Try the same email with a wrong password. The API should return `401`.
6. Copy an AGENT JWT and call the admin-only password reset route:

```bash
curl -i -X POST http://localhost:4000/auth/reset-agent-password \
  -H "Authorization: Bearer AGENT_JWT_HERE" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"agent@example.com\"}"
```

The response should be `403 Forbidden`.

## Branding

The canonical project logo source is `assets/branding/amsaf-logo.png`. It is copied into `frontend/src/assets/amsaf-logo.png` and rendered through `frontend/src/components/Logo.tsx`.

## Module 8 and 11 - Manual Dialer and Modems

Local development uses the mock modem driver by default. The mock driver logs AT commands and lets the agent call flow run without GSM hardware.

To switch to a real serial modem after hardware is available, set these backend environment variables:

```bash
MODEM_DRIVER=serial
MODEM_SERIAL_PORT=COM3
```

Use the correct serial device path for the machine, for example `COM3` on Windows or `/dev/ttyUSB0` on Linux. The serial driver sends these AT commands: `AT` for test, `ATD<number>;` to dial, `ATH` to hang up, and `ATA` to answer.

## Module 15 - System Settings

System settings are stored in the singleton `settings` table created by `backend/src/db/migrations/004_settings.sql`.

Fields:

- `organization_name` controls the organization text shown by the shared frontend `Logo` component.
- `organization_logo` stores an uploaded image as a data URL. When null, the bundled AMSAF logo is used.
- `theme` stores the selected UI theme preset.
- `backup_enabled` stores the backup toggle.
- `password_policy` is JSONB with this shape: `{ "minLength": 8, "requireNumbers": false, "requireSymbols": false }`.

The frontend Settings page sends uploaded logos as image data URLs through `PUT /settings`, so branding changes do not require a redeploy.
