// One Express app. /api = health, info, mode, diagram, reset. Loopback Host check and
// same-origin writes on everything. Serves web/dist when it exists (step 2+).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { hostCheck, sameOriginWrites } from './safety.js';
import { createHealth } from './health.js';
import { modeFrom, realAvailableFrom, REAL_MODE_VARS } from './config.js';
import { loadCast, verticalFrom, VERTICALS, fillDeep } from './cast.js';
import { workspaceFrom } from './workspaces.js';
import {
  CIBA_APPROVAL_SOURCE, CIBA_APPROVAL_DETAILS, CIBA_APPROVAL_PAYLOADS, CIBA_APPROVAL_STEP_DETAILS,
} from './data/cibaApprovalSequence.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const pathToFileUrl = (p) => `file://${p.split(path.sep).map(encodeURIComponent).join(path.sep)}`;
const WEB_DIST = process.env.WEB_DIST || path.resolve(HERE, '../../web/dist');

export async function createApp({ health = createHealth(), env = process.env } = {}) {
  // Rule 19: runtime server-side mode. Launch-derived (Real if configured, else Mock),
  // then changed only by POST /api/mode. A toggle that only echoes the launch mode does not meet the rule.
  let source = modeFrom(env);
  const app = express();
  app.disable('x-powered-by');
  app.use(hostCheck);
  app.use(sameOriginWrites);
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });

  const api = express.Router();
  api.use(express.json({ limit: '8kb' }));
  api.use('/health', health.router);

  // Rule 10: the story is data with {{cast}} tokens, in three vertical packs. customer.config.json
  // (git-ignored) overrides the default cast; ?vertical= picks a pack.
  const castFile = path.join(HERE, '../../customer.config.json');
  const castFor = (req) => loadCast(castFile, verticalFrom(req.query.vertical));

  api.get('/diagram', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      schema: 'ciba-approval-sequence/1',
      source: CIBA_APPROVAL_SOURCE,
      participants: CIBA_APPROVAL_DETAILS,
      bands: 3,
      messages: CIBA_APPROVAL_STEP_DETAILS.length,
      payloads: CIBA_APPROVAL_PAYLOADS,
      steps: CIBA_APPROVAL_STEP_DETAILS,
      cast: castFor(req),
      verticals: Object.keys(VERTICALS),
    });
  });

  // The presenter's talk track, {{cast}} tokens filled for the requested vertical (rule 10).
  // The source of truth is web/src/talkTrack.js (the same data the Talk track tab renders); the
  // server reads it as data so the page, the API and docs/talk-track.md cannot drift.
  const { TALK: talkTrack } = await import(pathToFileUrl(path.join(HERE, '../../web/src/talkTrack.js')));
  api.get('/talk-track', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ schema: 'ciba-talk-track/1', talk: fillDeep(talkTrack, castFor(req)), verticals: Object.keys(VERTICALS), cast: castFor(req) });
  });

  // What this build is, for the banner and for verifying by content (not by a 200).
  api.get('/info', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      mode: source, source, simulated: true, realAvailable: realAvailableFrom(env),
      demo: { id: 'ciba-approval-sequence-lab', tier: 'Demo', port: 7834 },
      version: (() => { try { return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version || null; } catch { return null; } })(),
    });
  });

  // Rule 19: the Mock/Real toggle. Exactly { source: "mock"|"real" }; 409 when Real is not configured.
  api.post('/mode', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !['mock', 'real'].includes(body.source) || Object.keys(body).length !== 1) {
      return res.status(400).json({ error: 'bad_source', detail: 'body must be exactly { source: "mock" | "real" }' });
    }
    if (body.source === 'real' && !realAvailableFrom(env)) {
      return res.status(409).json({ error: 'real_not_configured', detail: `Real mode needs ${REAL_MODE_VARS.join(', ')} in the lab's .env beside docker-compose.yml (owner-run). Mock keeps working.` });
    }
    source = body.source;
    return res.json({ source });
  });

  const ws = workspaceFrom({ headers: {} });
  // Reset restores default state: mode stays launch-derived (the .env decides), no per-workspace data exists yet.
  api.post('/reset', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ reset: 'ok', workspace: ws, source, realAvailable: realAvailableFrom(env) });
  });

  api.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use('/api', api);
  // Errors become short JSON (rule 23): never an HTML error page or a stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode);
    if (status === 413) return res.status(413).json({ error: 'payload_too_large' });
    if (status >= 400 && status < 500) return res.status(status).json({ error: 'bad_request' });
    return res.status(500).json({ error: 'internal_error', message: err?.message || 'internal error' });
  });

  if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    app.use(express.static(WEB_DIST));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }
  return app;
}

export function startHttpServer({ port, host, app = createApp() } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}/` }));
    server.once('error', reject);
  });
}
