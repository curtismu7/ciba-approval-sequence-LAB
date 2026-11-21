// GET /api/health, contract demo-health/1 (demo-shelf docs/health-contract.md). Public, GET only, no extra fields.
import fs from 'node:fs';
import express from 'express';

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const DEMO = { id: 'ciba-approval-sequence-lab', name: 'CIBA Approval Sequence LAB', version };

export function createHealth({ startedAt = new Date() } = {}) {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ schema: 'demo-health/1', at: new Date().toISOString(), state: 'ready', runtime: 'offline', demo: DEMO });
  });
  router.all('/', (_req, res) => res.set('Allow', 'GET').status(405).json({ error: 'method_not_allowed' }));
  return { router, startedAt, stop: () => {} };
}
