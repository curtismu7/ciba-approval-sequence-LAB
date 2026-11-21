#!/usr/bin/env node
// Preflight doctor for ciba-approval-sequence-LAB. Checks and exits non-zero on any failure.
// Needs no network except the optional port-occupied-by-this-app check (loopback only).
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertBindAllowed, bindHost, resolvePort, DEFAULT_PORT } from '../server/src/safety.js';
import { modeFrom, realAvailableFrom } from '../server/src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* optional */ }

const checks = [];
const check = (id, ok, detail = '') => checks.push({ id, ok, detail });
const [major] = process.versions.node.split('.').map(Number);
check('node', major >= 26, `node ${process.versions.node}`);
try { check('port-config', resolvePort() === DEFAULT_PORT || process.env.CIBALAB_ALLOW_SPARE_PORT === '1', `port ${resolvePort()}`); } catch (e) { check('port-config', false, e.message); }
try { assertBindAllowed(bindHost()); check('bind', true, bindHost()); } catch (e) { check('bind', false, e.message); }
check('mode', ['mock', 'real'].includes(modeFrom()), `${modeFrom()}${realAvailableFrom() ? ' (real configured)' : ' (mock only)'}`);

// Rule 21: the compose file parses and every long-running service restarts unless-stopped.
try {
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  const services = compose.split(/^ {2}(\S[\w-]*):\s*$/m);
  let longRunning = 0;
  const blocks = compose.split('\n');
  for (let i = 0; i < blocks.length; i += 1) {
    const m = /^ {2}([\w-]+):\s*$/.exec(blocks[i]);
    if (!m || m[1] === 'services') continue;
    const body = [];
    for (let j = i + 1; j < blocks.length && !/^ {2}\S/.test(blocks[j]); j += 1) body.push(blocks[j]);
    const text = body.join('\n');
    if (/^\s{4}(build|command):/m.test(text)) { // a long-running service builds or runs a command
      longRunning += 1;
      check(`compose-restart:${m[1]}`, /^\s{4}restart:\s*unless-stopped\s*$/m.test(text), 'restart: unless-stopped (rule 21)');
    }
  }
  check('compose-services', longRunning > 0, `${longRunning} long-running service(s)`);
} catch (e) { check('compose', false, `docker-compose.yml: ${e.message}`); }

// The diagram contract: the step data still yields 71 steps (what GET /api/diagram serves).
try {
  const { CIBA_APPROVAL_STEP_DETAILS } = await import('../server/src/data/cibaApprovalSequence.js');
  check('diagram', CIBA_APPROVAL_STEP_DETAILS.length === 71, `${CIBA_APPROVAL_STEP_DETAILS.length} steps (contract: 71)`);
} catch (e) { check('diagram', false, e.message); }

// Rule 17: the studio overview is diagram-studio/1 data, vendored byte for byte with a sha256 pin.
try {
  const pinText = fs.readFileSync(path.join(root, 'web/src/studio-data/studio-data.sha256'), 'utf8');
  const pins = pinText.split('\n').map((l) => l.trim()).filter((l) => /^[0-9a-f]{64}\s/.test(l));
  let ok = pins.length > 0; const bad = [];
  for (const pin of pins) {
    const [h, f] = pin.split(/\s+/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, path.dirname('web/src/studio-data/x'), path.basename(f)))).digest('hex');
    if (actual !== h) { ok = false; bad.push(path.basename(f)); }
  }
  const studio = JSON.parse(fs.readFileSync(path.join(root, 'web/src/studio-data/pfl-ciba-flow.json'), 'utf8'));
  if (studio.schema !== 'diagram-studio/1') { ok = false; bad.push('schema'); }
  check('studio-data', ok, ok ? `diagram-studio/1 (${studio.nodes.length} nodes, ${studio.edges.length} edges, pinned)` : `MISMATCH: ${bad.join(', ')}`);
} catch (e) { check('studio-data', false, e.message); }

// Vendored pins (rules 22 / 24): every pin file matches the files it names.
const pins = [
  ['web/src/top-menu/top-menu.sha256', ['TopMenu.jsx', 'top-menu.css'].map((f) => `web/src/top-menu/${f}`)],
  ['web/src/components/JsonPane.sha256', ['JsonPane.jsx'].map((f) => `web/src/components/${f}`)],
  ['web/src/components/JsonPane.css.sha256', ['JsonPane.css'].map((f) => `web/src/components/${f}`)],
];
for (const [pinFile, files] of pins) {
  try {
    const pinLines = fs.readFileSync(path.join(root, pinFile), 'utf8').split('\n').filter((l) => /^[0-9a-f]{64}\s/.test(l));
    const pinned = new Map(pinLines.map((l) => { const [h, f] = l.trim().split(/\s+/); return [path.basename(f), h]; }));
    let ok = true; const bad = [];
    for (const f of files) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
      const expected = pinned.get(path.basename(f));
      if (!expected) { ok = false; bad.push(`${path.basename(f)}: not in pin`); }
      else if (expected !== actual) { ok = false; bad.push(path.basename(f)); }
    }
    check(`pin:${path.basename(pinFile)}`, ok, ok ? `${files.length} file(s) match` : `MISMATCH: ${bad.join(', ')}`);
  } catch (e) { check(`pin:${path.basename(pinFile)}`, false, e.message); }
}

// If a server is already on our port, it must be THIS app: /api/health answers demo-health/1 with our demo id.
const port = resolvePort();
await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', async () => {
    // occupied: see whether it is us
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) });
      const j = await r.json();
      const ours = j.schema === 'demo-health/1' && j.demo?.id === 'ciba-approval-sequence-lab';
      check('port-free', false, ours ? `${port} is occupied by this lab (already running)` : `${port} is occupied by something else`);
    } catch (e) { check('port-free', false, `${port} is occupied (probe failed: ${e.message})`); }
    resolve();
  });
  probe.listen(port, '127.0.0.1', () => { probe.close(() => { check('port-free', true, `${port} is free`); resolve(); }); });
});

// The info contract, proven against the data the running server would serve (no network needed).
check('info-contract', ['mock', 'real'].includes(modeFrom()) && typeof realAvailableFrom() === 'boolean', `/api/info serves source=${modeFrom()}, realAvailable=${realAvailableFrom()}`);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.id}${c.detail ? `: ${c.detail}` : ''}`);
  if (!c.ok) failed++;
}
process.exit(failed ? 1 : 0);
