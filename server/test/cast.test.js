import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withServer } from './helpers.js';

const getJson = async (url, p) => {
  const r = await fetch(`${url}${p}`);
  assert.equal(r.status, 200);
  return r.json();
};

test('the default story is AirGuard Airlines: /api/talk-track and /api/diagram carry the airlines cast and no earlier brand', async () => {
  await withServer(async (url) => {
    const talk = await getJson(url, '/api/talk-track');
    assert.equal(talk.cast.castBrand, 'AirGuard Airlines');
    assert.equal(talk.cast.castAgentId, 'passenger-chat-agent');
    assert.deepEqual([...talk.verticals].sort(), ['airlines', 'finance', 'health', 'retail']);
    const text = JSON.stringify(talk.talk);
    assert.match(text, /AirGuard Airlines/);
    assert.ok(!/\{\{/.test(text), 'no raw token reaches the page');
    for (const old of ['Fabrikam', 'Northwind', 'Contoso', 'Harbor', 'Vellum', 'Meridian Air', 'payments-agent']) assert.ok(!text.includes(old), old);
    assert.equal((await getJson(url, '/api/diagram')).cast.castBrand, 'AirGuard Airlines');
  });
});

test('an unknown ?vertical= falls back to the airline default; the older packs still answer when asked for', async () => {
  await withServer(async (url) => {
    assert.equal((await getJson(url, '/api/talk-track?vertical=nonsense')).cast.castBrand, 'AirGuard Airlines');
    assert.equal((await getJson(url, '/api/talk-track?vertical=airlines')).cast.castBrand, 'AirGuard Airlines');
    assert.equal((await getJson(url, '/api/talk-track?vertical=finance')).cast.castBrand, 'Fabrikam Bank');
    assert.equal((await getJson(url, '/api/talk-track?vertical=retail')).cast.castBrand, 'Northwind Retail');
    assert.equal((await getJson(url, '/api/talk-track?vertical=health')).cast.castBrand, 'Contoso Health');
  });
});
