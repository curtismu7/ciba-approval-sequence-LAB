import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer } from './helpers.js';

const load = async (url) => {
  const r = await fetch(`${url}/api/diagram`);
  assert.equal(r.status, 200);
  return r.json();
};

test('/api/diagram: 71 messages, 10 participants, 3 bands, 71 step details', async () => {
  await withServer(async (url) => {
    const d = await load(url);
    assert.equal(d.schema, 'ciba-approval-sequence/1');
    assert.equal(d.messages, 71);
    assert.equal(d.bands, 3);
    assert.equal(d.steps.length, 71);
    assert.equal(Object.keys(d.participants).length, 10);
  });
});

test('/api/diagram: the sequence source parses and carries the messages', async () => {
  await withServer(async (url) => {
    const d = await load(url);
    assert.ok(d.source.startsWith('sequenceDiagram'));
    assert.ok(d.source.includes('autonumber'));
    const arrowLines = d.source.split('\n').filter((l) => l.includes('->>')).length;
    assert.equal(arrowLines, 71);
    for (const id of Object.keys(d.participants)) {
      assert.ok(d.source.includes(`participant ${id} as `), `participant ${id} missing from source`);
    }
  });
});

test('/api/diagram: every step detail is complete and the wire text is well-formed', async () => {
  await withServer(async (url) => {
    const d = await load(url);
    d.steps.forEach((s, i) => {
      assert.equal(typeof s.what, 'string');
      assert.ok(s.what.length > 0, `step ${i + 1}: empty what`);
      assert.ok(Array.isArray(s.refs), `step ${i + 1}: refs missing`);
      if (s.request) assert.match(s.request, /^POST |^GET /, `step ${i + 1}: request first line`);
      if (s.response) assert.match(s.response, /^HTTP\/1\.1 \d{3}/, `step ${i + 1}: response first line`);
      for (const tk of s.tokens || []) {
        assert.ok(tk.label && tk.header && tk.payload, `step ${i + 1}: token shape`);
      }
    });
  });
});

test('/api/diagram: phase bands present (search / approval / replay+polling)', async () => {
  await withServer(async (url) => {
    const d = await load(url);
    assert.ok(d.source.includes('Phase 1 - Search'));
    assert.ok(d.source.includes('Phase 2 - Booking write'));
    assert.ok(d.source.includes('Phase 3 - replay and polling'));
  });
});

test('/api/diagram: only .example / .invalid hosts appear anywhere in the served data', async () => {
  await withServer(async (url) => {
    const text = JSON.stringify(await load(url));
    const hosts = [...text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((m) => m[1]);
    assert.ok(hosts.length > 0);
    for (const h of new Set(hosts)) {
      assert.match(h, /(\.example|\.invalid|\.example\.com|\.example\.net|\.example\.org)(:\d+)?$/, `non-reserved host in data: ${h}`);
    }
    assert.ok(!text.includes('ping-devops.com'));
    assert.ok(!text.includes('demo_api_server'));
    assert.ok(!text.includes('demo_authz_server'));
    assert.ok(!text.includes('ping-gateway/'));
  });
});
