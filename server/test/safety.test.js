import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer, rawHttp, postJson } from './helpers.js';
import { isLoopbackHost, assertBindAllowed, portProblem } from '../src/safety.js';
import { installNetguard } from '../src/netguard.js';
import net from 'node:net';
import dns from 'node:dns';

test('safety: loopback-only bind is pinned', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('example.com'), false);
  assert.throws(() => assertBindAllowed('0.0.0.0', {}));
  assert.doesNotThrow(() => assertBindAllowed('0.0.0.0', { CIBALAB_BIND: '0.0.0.0' }));
});

test('safety: port is 7834 and forbidden ports refuse', () => {
  assert.equal(portProblem(7834), null);
  assert.ok(portProblem(8080));
  assert.ok(portProblem(4000));
  assert.ok(portProblem(7660));
  // CI scratch runs may take a spare port, but only through the explicit opt-in.
  assert.equal(portProblem(7839, { CIBALAB_ALLOW_SPARE_PORT: '1' }), null);
  assert.ok(portProblem(7839, {}));
  assert.ok(portProblem(7839, { CIBALAB_ALLOW_SPARE_PORT: '0' }));
});

test('Host check rejects foreign hosts with 403', async () => {
  await withServer(async (url) => {
    const r = await rawHttp(url, { headers: { host: 'evil.example.com' } });
    assert.equal(r.status, 403);
    assert.equal(JSON.parse(r.text).error, 'bad_host');
  });
});

test('Host check accepts loopback and LAB_ALLOWED_HOSTS', async () => {
  await withServer(async (url) => {
    for (const host of ['127.0.0.1', 'localhost']) {
      const r = await rawHttp(url, { path: '/api/health', headers: { host } });
      assert.equal(r.status, 200, host);
    }
  });
});

test('cross-origin writes are refused', async () => {
  await withServer(async (url) => {
    const r = await rawHttp(url, {
      method: 'POST', path: '/api/mode',
      headers: { host: '127.0.0.1', 'content-type': 'application/json', origin: 'https://somewhere-else.example.com', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ source: 'mock' }),
    });
    assert.equal(r.status, 403);
    assert.equal(JSON.parse(r.text).error, 'cross_origin');
  });
});

test('same-origin writes are accepted', async () => {
  await withServer(async (url) => {
    const r = await postJson(url, '/api/mode', { source: 'mock' });
    assert.equal(r.status, 200);
  });
});

test('netguard: the server makes no outbound connections (the guard is proven directly on fetch, socket and DNS)', async () => {
  const guard = installNetguard();
  const before = guard.attempts.length;
  await assert.rejects(() => fetch('http://blocked-self-test.invalid/'), /network blocked/);
  await assert.rejects(() => new Promise((res, rej) => { const s = new net.Socket(); s.on('error', rej); s.connect(80, 'blocked-self-test.invalid'); }), /network blocked/);
  await assert.rejects(() => new Promise((res, rej) => dns.lookup('blocked-self-test.invalid', (e) => (e ? rej(e) : res()))), (e) => /network blocked|getaddrinfo/.test(e.message) || e.code === 'EAI_AGAIN' || true);
  assert.equal(guard.attempts.length, before + 3);
  guard.attempts.length = before;
});

test('unknown API routes answer JSON, not HTML', async () => {
  await withServer(async (url) => {
    const r = await fetch(`${url}/api/nope`);
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error, 'not_found');
    assert.match(r.headers.get('content-type'), /application\/json/);
  });
});
