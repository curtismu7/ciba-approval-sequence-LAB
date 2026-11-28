import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('the files the standalone rules ask for are present', () => {
  for (const f of ['README.md', 'CLAUDE.md', 'LICENSE', 'Dockerfile', 'docker-compose.yml', '.github/workflows/ci.yml', 'docs/talk-track.md', 'docs/shelf-entry.json', 'content-pack.json', 'scripts/doctor.mjs', 'scripts/reset.mjs', 'test/kit/demo-kit-conformance.mjs']) {
    assert.ok(fs.existsSync(path.join(root, f)), f);
  }
});

test('the shelf entry is valid and portable: relative composeFile, loopback url, health path', () => {
  const e = JSON.parse(read('docs/shelf-entry.json')).demos[0];
  assert.equal(e.id, 'ciba-approval-sequence');
  assert.equal(e.kind, 'Demo');
  assert.equal(e.healthPath, '/api/health');
  assert.match(e.url, /^http:\/\/localhost:78\d\d$/);
  assert.ok(!path.isAbsolute(e.composeFile), 'composeFile must be relative or a placeholder');
  assert.ok(!/\/Users\//.test(JSON.stringify(e)), 'no absolute home path');
  // tags only from the demo shelf's registered tag list (sibling checkout; skipped when it is absent, e.g. in CI)
  const tagsFile = new URL('../../demo-shelf-LAB/data/tags.json', import.meta.url);
  if (fs.existsSync(tagsFile)) {
    const tags = new Set(JSON.parse(fs.readFileSync(tagsFile, 'utf8')).groups.flatMap((g) => g.tags.map((t) => t.id)));
    for (const t of e.tags || []) assert.ok(tags.has(t), `tag ${t} not registered`);
  }
});

test('docs/talk-track.md is exactly what the web talk-track data renders (no drift, {{cast}} filled with the default cast)', async () => {
  const { TALK } = await import(pathToFileUrl(path.join(root, 'web/src/talkTrack.js')));
  const { loadCast, fillDeep } = await import(pathToFileUrl(path.join(root, 'server/src/cast.js')));
  const rendered = [
    '# Talk track',
    '',
    '<!-- Generated from web/src/talkTrack.js by `npm run talk-track`. Do not edit by hand. -->',
    '',
    ...fillDeep(TALK, loadCast(null)).flatMap((t) => [`## ${t.title}`, '', t.say, '']),
  ].join('\n');
  assert.equal(read('docs/talk-track.md'), rendered, 'stale docs/talk-track.md: run npm run talk-track');
  // the raw {{cast}} tokens never reach the doc
  assert.ok(!read('docs/talk-track.md').includes('{{'));
  // the web App uses the same data module, not its own copy
  const app = read('web/src/App.jsx');
  assert.match(app, /import \{ TALK \} from "\.\/talkTrack"/);
  assert.doesNotMatch(app, /say-first/);
});

test('the cast: four vertical packs (airlines is the default), every {{cast}} token defined, customer.config values are bounded', async () => {
  const castMod = await import(pathToFileUrl(path.join(root, 'server/src/cast.js')));
  const { TALK } = await import(pathToFileUrl(path.join(root, 'web/src/talkTrack.js')));
  assert.deepEqual(Object.keys(castMod.VERTICALS).sort(), ['airlines', 'finance', 'health', 'retail']);
  assert.equal(castMod.DEFAULT_VERTICAL, 'airlines');
  assert.equal(castMod.loadCast(null).castBrand, 'AirGuard Airlines', 'a fresh run with no config is AirGuard Airlines');
  for (const v of Object.keys(castMod.VERTICALS)) {
    const cast = castMod.loadCast(null, v);
    assert.deepEqual(castMod.unfilled(TALK.map((t) => t.say).join(' '), cast), [], v);
  }
  // a hostile customer.config value never reaches the cast: no URL, no host, bounded length
  const os = await import('node:os');
  const tmp = path.join(os.tmpdir(), `cibalab-cast-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ cast: { brand: 'Evil <script> Industries', host: 'real-tenant.pingone.com', agentId: 'x'.repeat(200) } }));
  const cast = castMod.loadCast(tmp, 'finance');
  fs.rmSync(tmp, { force: true });
  assert.ok(!JSON.stringify(cast).includes('real-tenant'), 'real host refused');
  assert.ok(cast.castBrand.length <= 40, 'brand bounded');
  assert.ok(cast.castAgentId.length <= 40, 'agentId bounded');
  assert.equal(cast.castHost, 'fabrikam', 'bad host keeps the pack default');
});

test('an unknown or older vertical id keeps working: unknown falls back to airlines, finance/retail/health render their own brand', async () => {
  const castMod = await import(pathToFileUrl(path.join(root, 'server/src/cast.js')));
  assert.equal(castMod.verticalFrom('nonsense'), 'airlines');
  assert.equal(castMod.verticalFrom(undefined), 'airlines');
  assert.equal(castMod.verticalFrom('__proto__'), 'airlines');
  assert.equal(castMod.loadCast(null, castMod.verticalFrom('nonsense')).castBrand, 'AirGuard Airlines');
  assert.equal(castMod.loadCast(null, 'finance').castBrand, 'Fabrikam Bank');
  assert.equal(castMod.loadCast(null, 'retail').castBrand, 'Northwind Retail');
  assert.equal(castMod.loadCast(null, 'health').castBrand, 'Contoso Health');
});

test('retired names: the airline run (cast, filled talk track, diagram data, content pack, generated doc) names no earlier brand', async () => {
  const castMod = await import(pathToFileUrl(path.join(root, 'server/src/cast.js')));
  const { TALK } = await import(pathToFileUrl(path.join(root, 'web/src/talkTrack.js')));
  const diagram = await import(pathToFileUrl(path.join(root, 'server/src/data/cibaApprovalSequence.js')));
  const cast = castMod.loadCast(null, 'airlines');
  const rendered = JSON.stringify({ cast, talk: castMod.fillDeep(TALK, cast), diagram: Object.fromEntries(Object.entries(diagram)) })
    + read('content-pack.json') + read('docs/talk-track.md');
  const retired = ['Meridian Air', 'Meridian Journeys', 'Skyline Air', 'Northwind', 'Contoso', 'Tessera Travel', 'Fabrikam', 'Harbor', 'Vellum', 'payments-agent', 'orders-agent', 'claims-agent'];
  for (const name of retired) assert.ok(!rendered.toLowerCase().includes(name.toLowerCase()), `retired name in the airline run: ${name}`);
  assert.match(rendered, /AirGuard Airlines/);
  assert.match(rendered, /passenger-chat-agent/);
});

test('content-pack.json is exactly what the builder makes (no drift)', async () => {
  const { buildPack } = await import(pathToFileUrl(path.join(root, 'scripts/build-content-pack.mjs')));
  const committed = JSON.parse(read('content-pack.json'));
  assert.deepEqual(committed, buildPack());
});

test('the content pack teaches the real phases: 4 stories, every card story exists, hosts are .example', async () => {
  const pack = JSON.parse(read('content-pack.json'));
  assert.equal(pack.stories.length, 4);
  const ids = new Set(pack.stories.map((s) => s.id));
  for (const c of pack.cards) if (c.story) assert.ok(ids.has(c.story), c.id);
  assert.ok(!/https?:\/\/(?!(www\.|openid\.net))/.test(JSON.stringify(pack).replaceAll('https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html', '').replaceAll('https://www.rfc-editor.org/rfc/rfc8693', '').replaceAll('https://www.rfc-editor.org/rfc/rfc6749', '').replaceAll('http://localhost:7834', '')), 'only spec links and localhost');
});

function pathToFileUrl(p) {
  return `file://${p}`;
}
