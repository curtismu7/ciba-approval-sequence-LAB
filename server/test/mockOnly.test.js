import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer, postJson } from './helpers.js';
import { isMockOnly, mockGuard, MOCK_REFUSAL } from '../src/mockOnly.js';

test('mockOnly: env parsing', () => {
  assert.equal(isMockOnly({ MOCK_ONLY: '1' }), true);
  assert.equal(isMockOnly({ MOCK_ONLY: 'true' }), true);
  assert.equal(isMockOnly({ MODE: 'mock' }), true);
  assert.equal(isMockOnly({}), false);
  assert.equal(isMockOnly({ MOCK_ONLY: '0' }), false);
});

test('hosted mock: mode pinned to mock, real refused, writes 403', async () => {
  await withServer(async (url) => {
    const info = await (await fetch(`${url}/api/info`)).json();
    assert.equal(info.source, 'mock');
    assert.equal(info.mockOnly, true);
    assert.equal(info.realAvailable, false);

    // Even with real-mode vars set, MOCK_ONLY pins the toggle off.
    const mode = await postJson(url, '/api/mode', { source: 'real' });
    assert.equal(mode.status, 403);
    assert.equal(JSON.parse(mode.text).error, 'mock_only');

    const reset = await postJson(url, '/api/reset', {});
    assert.equal(reset.status, 403);
    assert.deepEqual(JSON.parse(reset.text), MOCK_REFUSAL);

    // Reads still work.
    const diagram = await fetch(`${url}/api/diagram`);
    assert.equal(diagram.status, 200);
  }, { env: { MOCK_ONLY: '1' } });
});

test('mockGuard: GET passes, POST refused', () => {
  const res = { status(code) { this.code = code; return this; }, json(o) { this.body = o; } };
  const next = () => { res.passed = true; };
  mockGuard({ method: 'GET' }, res, next);
  assert.equal(res.passed, true);
  mockGuard({ method: 'POST' }, res, next);
  assert.equal(res.code, 403);
});
