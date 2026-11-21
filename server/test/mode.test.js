import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer, postJson } from './helpers.js';

test('GET /api/info: mock default, realAvailable=false, simulated', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/info`)).json();
    assert.equal(j.source, 'mock');
    assert.equal(j.mode, 'mock');
    assert.equal(j.realAvailable, false);
    assert.equal(j.simulated, true);
    assert.equal(j.demo.id, 'ciba-approval-sequence-lab');
  });
});

test('GET /api/info: realAvailable=true when the real-mode vars are set', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/info`)).json();
    assert.equal(j.source, 'real');
    assert.equal(j.realAvailable, true);
  }, { env: { REAL_CIBA_ENV_ID: 'e', REAL_CIBA_CLIENT_ID: 'c', REAL_CIBA_CLIENT_SECRET: 's' } });
});

test('POST /api/mode: mock -> real 409 when Real is not configured', async () => {
  await withServer(async (url) => {
    const r = await postJson(url, '/api/mode', { source: 'real' });
    assert.equal(r.status, 409);
    const j = JSON.parse(r.text);
    assert.equal(j.error, 'real_not_configured');
    // the info contract is unchanged after the refusal
    const info = await (await fetch(`${url}/api/info`)).json();
    assert.equal(info.source, 'mock');
  });
});

test('POST /api/mode: mock -> real 200 when Real IS configured, and real -> mock back', async () => {
  await withServer(async (url) => {
    let r = await postJson(url, '/api/mode', { source: 'real' });
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.text), { source: 'real' });
    r = await postJson(url, '/api/mode', { source: 'mock' });
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.text), { source: 'mock' });
  }, { env: { REAL_CIBA_ENV_ID: 'e', REAL_CIBA_CLIENT_ID: 'c', REAL_CIBA_CLIENT_SECRET: 's' } });
});

test('POST /api/mode: bad bodies are 400, not 409', async () => {
  await withServer(async (url) => {
    for (const [body, error] of [[{}, 'bad_source'], [{ source: 'live' }, 'bad_source'], [{ source: null }, 'bad_source'], ['mock', 'bad_request']]) {
      const r = await postJson(url, '/api/mode', body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(JSON.parse(r.text).error, error);
    }
  });
});

test('POST /api/mode: the switch is runtime state, echoed by /api/info and /api/reset (rule 19)', async () => {
  await withServer(async (url) => {
    const info = async () => (await (await fetch(`${url}/api/info`)).json()).source;
    assert.equal(await info(), 'mock');
    // real is not configured: switching is refused and the mode does not move
    assert.equal((await postJson(url, '/api/mode', { source: 'real' })).status, 409);
    assert.equal(await info(), 'mock');
    // a mock switch is accepted (a no-op but a valid toggle press) and the state follows
    const r = await postJson(url, '/api/mode', { source: 'mock' });
    assert.equal(r.status, 200);
    assert.equal(await info(), 'mock');
  }, { env: { } });
});

test('POST /api/mode: the switch is runtime state in real-configured mode too', async () => {
  await withServer(async (url) => {
    const info = async () => (await (await fetch(`${url}/api/info`)).json()).source;
    assert.equal(await info(), 'real'); // launch-derived: Real if configured
    const r = await postJson(url, '/api/mode', { source: 'mock' });
    assert.equal(r.status, 200);
    assert.equal(await info(), 'mock');
    assert.equal((await postJson(url, '/api/mode', { source: 'real' })).status, 200);
    assert.equal(await info(), 'real');
    // reset restores the launch-derived default, not the last toggled value
    const reset = await postJson(url, '/api/reset', {});
    assert.equal(JSON.parse(reset.text).source, 'real');
  }, { env: { REAL_CIBA_ENV_ID: 'e', REAL_CIBA_CLIENT_ID: 'c', REAL_CIBA_CLIENT_SECRET: 's' } });
});

test('POST /api/mode: extra keys are refused — body must be exactly { source }', async () => {
  await withServer(async (url) => {
    const r = await postJson(url, '/api/mode', { source: 'mock', extra: 1 });
    assert.equal(r.status, 400);
    assert.equal(JSON.parse(r.text).error, 'bad_source');
  });
});

test('POST /api/reset restores default state', async () => {
  await withServer(async (url) => {
    const r = await postJson(url, '/api/reset', {});
    assert.equal(r.status, 200);
    const j = JSON.parse(r.text);
    assert.equal(j.reset, 'ok');
    assert.equal(j.workspace, 'default');
    assert.equal(j.source, 'mock');
    // data still served intact after reset
    const d = await (await fetch(`${url}/api/diagram`)).json();
    assert.equal(d.messages, 71);
  });
});
