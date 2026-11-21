import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer } from './helpers.js';

test('GET /api/health answers demo-health/1', async (t) => {
  await withServer(async (url) => {
    const r = await fetch(`${url}/api/health`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.schema, 'demo-health/1');
    assert.equal(j.state, 'ready');
    assert.equal(j.runtime, 'offline');
    assert.equal(j.demo.id, 'ciba-approval-sequence-lab');
    assert.deepEqual(Object.keys(j).sort(), ['at', 'demo', 'runtime', 'schema', 'state']);
  });
});

test('GET /api/health is GET only', async (t) => {
  await withServer(async (url) => {
    const r = await fetch(`${url}/api/health`, { method: 'POST' });
    assert.equal(r.status, 405);
    assert.ok(r.headers.get('allow').includes('GET'));
  });
});
