import path from 'path';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { authRouter } from './auth/routes.js';
import { verifyDatabaseConnection } from './db/pool.js';
import { customersRouter } from './customers/routes.js';
import { campaignsRouter } from './campaigns/routes.js';
import { agentsRouter } from './agents/routes.js';
import { assignmentsRouter } from './assignments/routes.js';
import { agentRouter } from './agent/routes.js';
import { modemsRouter } from './modems/routes.js';
import { adminRouter } from './admin/routes.js';
import { campaignDashboardRouter } from './admin/campaign-dashboard.js';
import { reportsRouter } from './reports/routes.js';
import { notificationsRouter } from './notifications/routes.js';
import { auditRouter } from './audit/routes.js';
import { settingsRouter } from './settings/routes.js';
import { electionRouter } from './election/routes.js';

export const app = express();

const allowedOrigins = new Set([env.frontendOrigin, ...env.frontendOrigins]);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/customers', customersRouter);
app.use('/campaigns', campaignsRouter);
app.use('/agents', agentsRouter);
app.use('/assignments', assignmentsRouter);
app.use('/agent', agentRouter);
app.use('/modems', modemsRouter);
app.use('/admin', adminRouter);
app.use('/admin/campaign-dashboard', campaignDashboardRouter);
app.use('/reports', reportsRouter);
app.use('/notifications', notificationsRouter);
app.use('/audit-logs', auditRouter);
app.use('/settings', settingsRouter);
app.use('/election', electionRouter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'acop-backend',
  });
});

app.get('/health/db', async (_req, res, next) => {
  try {
    const db = await verifyDatabaseConnection();

    res.json({
      status: 'ok',
      database: db,
    });
  } catch (error) {
    next(error);
  }
});

const frontendDistPath = path.resolve(process.cwd(), '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error('Unhandled server error:', message);
    if (stack) {
      console.error(stack);
    }

    res.status(500).json({
      status: 'error',
      message,
    });
  },
);

