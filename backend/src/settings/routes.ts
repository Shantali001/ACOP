import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import type { PasswordPolicy, SettingsRow } from './types.js';

export const settingsRouter = Router();

function mapSettings(row: SettingsRow) {
  return {
    organizationName: row.organization_name,
    organizationLogo: row.organization_logo,
    theme: row.theme,
    backupEnabled: row.backup_enabled,
    passwordPolicy: row.password_policy,
    updatedAt: row.updated_at,
  };
}

async function ensureSettings() {
  await pool.query(
    `
      insert into settings (id, organization_name, theme, backup_enabled, password_policy)
      values (1, 'AMSAF', 'light', false, '{"minLength":8,"requireNumbers":false,"requireSymbols":false}'::jsonb)
      on conflict (id) do nothing
    `,
  );
}

settingsRouter.get('/', async (_req, res, next) => {
  try {
    await ensureSettings();
    const result = await pool.query<SettingsRow>('select organization_name, organization_logo, theme, backup_enabled, password_policy, updated_at from settings where id = 1');
    res.json(mapSettings(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await ensureSettings();
    const body = req.body as Record<string, unknown>;
    const organizationName = typeof body.organizationName === 'string' && body.organizationName.trim() ? body.organizationName.trim() : 'AMSAF';
    const organizationLogo = typeof body.organizationLogo === 'string' && body.organizationLogo.trim() ? body.organizationLogo.trim() : null;
    const theme = typeof body.theme === 'string' && body.theme.trim() ? body.theme.trim() : 'light';
    const backupEnabled = typeof body.backupEnabled === 'boolean' ? body.backupEnabled : false;
    const rawPasswordPolicy = typeof body.passwordPolicy === 'object' && body.passwordPolicy !== null ? body.passwordPolicy as Record<string, unknown> : {};
    const passwordPolicy: PasswordPolicy = {
      minLength: Math.max(Number(rawPasswordPolicy.minLength) || 8, 6),
      requireNumbers: Boolean(rawPasswordPolicy.requireNumbers),
      requireSymbols: Boolean(rawPasswordPolicy.requireSymbols),
    };

    if (organizationLogo && !organizationLogo.startsWith('data:image/')) {
      res.status(400).json({ message: 'organizationLogo must be an image data URL.' });
      return;
    }

    const result = await pool.query<SettingsRow>(
      `
        update settings
        set organization_name = $1,
            organization_logo = $2,
            theme = $3,
            backup_enabled = $4,
            password_policy = $5::jsonb,
            updated_at = now()
        where id = 1
        returning organization_name, organization_logo, theme, backup_enabled, password_policy, updated_at
      `,
      [organizationName, organizationLogo, theme, backupEnabled, JSON.stringify(passwordPolicy)],
    );

    res.json(mapSettings(result.rows[0]));
  } catch (error) {
    next(error);
  }
});