import type { NextFunction, Request, Response } from 'express';

import { pool } from '../db/pool.js';

export async function resolveCurrentAgent(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'AGENT') {
    next();
    return;
  }

  try {
    const result = await pool.query<{ id: string }>('select id from agents where user_id = $1 limit 1', [req.user.id]);
    const agent = result.rows[0];

    if (!agent) {
      res.status(403).json({ message: 'Agent profile is not linked to this user.' });
      return;
    }

    req.agentId = agent.id;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAgentAssignmentScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'AGENT') {
    next();
    return;
  }

  if (!req.agentId) {
    res.status(403).json({ message: 'Agent assignment scope is required.' });
    return;
  }

  next();
}

export async function requireOwnAssignment(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'AGENT') {
    next();
    return;
  }

  if (!req.agentId) {
    res.status(403).json({ message: 'Agent assignment scope is required.' });
    return;
  }

  try {
    const result = await pool.query<{ id: string }>(
      'select id from customer_assignments where id = $1 and agent_id = $2 limit 1',
      [req.params.id, req.agentId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Assignment not found.' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}