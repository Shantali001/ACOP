import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const geoDataPath = join(__dirname, 'nigeria-states-lgas.json');
const geoData = JSON.parse(readFileSync(geoDataPath, 'utf8')) as Record<string, string[]>;

export const geoRouter = Router();

geoRouter.get('/states', (_req, res) => {
  res.json(Object.keys(geoData).sort());
});

geoRouter.get('/lgas', (req, res) => {
  const state = (req.query.state as string | undefined)?.trim();
  if (!state) return res.json([]);

  const matchedKey = Object.keys(geoData).find(
    (key) => key.toLowerCase() === state.toLowerCase(),
  );

  if (!matchedKey) return res.json([]);
  res.json(geoData[matchedKey]);
});

// Wards intentionally NOT here — they stay customer-driven via
// admin/routes.ts's existing GET /admin/campaign-dashboard/wards.
// A reliable static list for all 774 LGAs' wards isn't something
// I can generate accurately, so real agent-entered data stays the source of truth.