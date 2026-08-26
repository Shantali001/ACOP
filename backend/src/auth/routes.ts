import { Router } from 'express';

import { pool } from '../db/pool.js';
import { writeAuditLog } from '../audit/helper.js';
import { createToken } from './jwt.js';
import { requireAuth, requireRole } from './middleware.js';
import { assertPasswordStrength, createTemporaryPassword } from './passwords.js';
import { revokeToken } from './tokenBlacklist.js';
import type { UserRole } from './types.js';

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
};

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const result = await pool.query<UserRow>(
      `
        select id, full_name, email, role, status
        from users
        where lower(email) = lower($1)
          and password_hash = crypt($2, password_hash)
        limit 1
      `,
      [email, password],
    );
    const user = result.rows[0];

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    await pool.query(
      'update users set last_login = now(), updated_at = now() where id = $1::uuid',
      [user.id],
    );

    await writeAuditLog({
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
    });

    const { token, expiresAt } = createToken({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      expiresAt,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  revokeToken(req.user!.jti, req.user!.exp);
  await writeAuditLog({
    userId: req.user!.id,
    action: 'user.logout',
    entityType: 'user',
    entityId: req.user!.id,
  });
  res.status(204).send();
});

authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required.' });
      return;
    }

    assertPasswordStrength(newPassword);

    const verifyResult = await pool.query<{ id: string }>(
      `
        select id
        from users
        where id = $1::uuid
          and password_hash = crypt($2, password_hash)
        limit 1
      `,
      [req.user!.id, currentPassword],
    );

    if (!verifyResult.rows[0]) {
      res.status(401).json({ message: 'Current password is incorrect.' });
      return;
    }

    await pool.query(
      `
        update users
        set password_hash = crypt($2, gen_salt('bf')),
            updated_at = now()
        where id = $1::uuid
      `,
      [req.user!.id, newPassword],
    );

    revokeToken(req.user!.jti, req.user!.exp);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/reset-agent-password',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { agentUserId, email } = req.body as { agentUserId?: string; email?: string };

      if (!agentUserId && !email) {
        res.status(400).json({ message: 'agentUserId or email is required.' });
        return;
      }

      const temporaryPassword = createTemporaryPassword();
      const result = await pool.query<UserRow>(
        `
          update users
          set password_hash = crypt($3, gen_salt('bf')),
              updated_at = now()
          where role = 'AGENT'
            and ($1::uuid is null or id = $1)
            and ($2::text is null or lower(email) = lower($2))
          returning id, full_name, email, role, status
        `,
        [agentUserId ?? null, email ?? null, temporaryPassword],
      );
      const user = result.rows[0];

      if (!user) {
        res.status(404).json({ message: 'Agent user not found.' });
        return;
      }

      res.json({
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
        },
        temporaryPassword,
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/setup/admin', async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body as { email?: string; password?: string; fullName?: string };

    if (!email || !password || !fullName) {
      res.status(400).json({ message: 'email, password, and fullName are required.' });
      return;
    }

    const existingAdmin = await pool.query<UserRow>(
      "select id from users where role = 'ADMIN' limit 1",
    );

    if (existingAdmin.rows[0]) {
      const resetResult = await pool.query<UserRow>(
        `
          update users
          set password_hash = crypt($1, gen_salt('bf')),
              updated_at = now()
          where role = 'ADMIN'
          returning id, full_name, email, role, status
        `,
        [password],
      );
      res.json({
        user: {
          id: resetResult.rows[0].id,
          fullName: resetResult.rows[0].full_name,
          email: resetResult.rows[0].email,
          role: resetResult.rows[0].role,
        },
      });
      return;
    }

    const result = await pool.query<UserRow>(
      `
        insert into users (email, full_name, password_hash, role, status)
        values ($1, $2, crypt($3, gen_salt('bf')), 'ADMIN', 'ACTIVE')
        returning id, full_name, email, role, status
      `,
      [email, fullName, password],
    );

    res.status(201).json({
      user: {
        id: result.rows[0].id,
        fullName: result.rows[0].full_name,
        email: result.rows[0].email,
        role: result.rows[0].role,
      },
    });
  } catch (error) {
    next(error);
  }
});
