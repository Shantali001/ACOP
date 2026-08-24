import type { NextFunction, Request, Response } from 'express';

import { verifyToken } from './jwt.js';
import { isTokenRevoked } from './tokenBlacklist.js';
import type { UserRole } from './types.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const user = verifyToken(token);

    if (isTokenRevoked(user.jti)) {
      res.status(401).json({ message: 'Session has been logged out.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ message: 'Forbidden.' });
      return;
    }

    next();
  };
}
