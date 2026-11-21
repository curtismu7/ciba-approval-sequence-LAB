#!/usr/bin/env node
// Builds content-pack.json for the Learning Hub from the CIBA step data, so the pack cannot drift from the lab.
//   node scripts/build-content-pack.mjs        (writes content-pack.json)
// The 71 messages become the lesson: one story per phase (plus the closing deny alt) and one try-it card per
// phase that opens the diagram, all built from server/src/data/cibaApprovalSequence.js — never hand-written.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// The step data is a plain ES module with no side effects; import it by path so the builder needs no workspace wiring.
const data = await import(pathToFileUrl(path.join(ROOT, 'server/src/data/cibaApprovalSequence.js')));
const { CIBA_APPROVAL_STEP_DETAILS } = data;

function pathToFileUrl(p) {
  return `file://${p.split(path.sep).map(encodeURIComponent).join(path.sep).replace(/^(file:\/\/)/, 'file:///')}`;
}

// Message ranges (1-based) per phase, from the bands in the data (phase 1: 1-18, phase 2: 19-37, phase 3: 38-63,
// closing deny/pending alt: 64-71). The test pins these against the band titles in the diagram source.
const PHASES = [
  { n: 1, from: 0, to: 17, id: 'search', story: 'S01', title: 'Phase 1: the search (no approval)', term: 'token-exchange' },
  { n: 2, from: 18, to: 36, id: 'held-write', story: 'S02', title: 'Phase 2: the held booking write', term: 'ciba' },
  { n: 3, from: 37, to: 62, id: 'replay', story: 'S03', title: 'Phase 3: replay and polling', term: 'ciba' },
  { n: 4, from: 63, to: 70, id: 'not-approved', story: 'S04', title: 'The closing alt: denied, expired, still pending', term: 'ciba' },
];

const phaseSteps = (p) => CIBA_APPROVAL_STEP_DETAILS.slice(p.from, p.to + 1);
const pick = (p, word) => {
  const s = phaseSteps(p).find((d) => new RegExp(word, 'i').test(`${d.what} ${d.why}`));
  return s ? `${s.why}` : phaseSteps(p)[0].why;
};

const SAY = {
  S01: 'Everything here is simulated: every host is .example and the tokens are teaching values. Phase 1 is the search — no approval needed. Watch the token narrow at every hop: the user token becomes a gateway-bound token, then the MCP server exchanges it (RFC 8693) for a scoped upstream token with audience approval-gateway.example.com and scope flights-api.',
  S02: 'The booking write is held. PingOne Authorize answers DENY with a 401 WWW-Authenticate challenge naming the approval method ciba-approval. The gateway starts a CIBA backchannel request, shows the binding message BK-XXXX on the person\'s other device, stores what the approval is for in Redis, and returns 401 approval_required up the chain. The MCP server turns it into an MCP tool error carrying _meta, and the agent holds the call open with the model told nothing.',
  S03: 'The replay carries the auth_req_id, never a verdict. The gateway binds the replay to the stored request (user, method, path, body hash), marks the approval spent, sets its own trusted x-ciba-approval: approved, and polls PingOne at the token endpoint. authorization_pending means keep waiting. When the person approves on the other device, PingOne returns tokens that only prove approval, the policy permits, and the booking is created.',
  S04: 'The closing alt is what happens when the answer is not yes: access_denied or expired_token ends polling, a 403 approval_denied or approval_expired is final and must not be retried, and authorization pending keeps the loop alive until the deadline from expiresIn. The model never approves; it only explains the outcome.',
};

export function buildPack() {
  return {
    schema: 'demo-content-pack/1',
    id: 'ciba-approval-sequence',
    title: 'CIBA Approval Sequence LAB',
    version,
    demo: { id: 'ciba-approval-sequence-lab', name: 'CIBA Approval Sequence LAB', catalog: 'D119', baseUrl: 'http://localhost:7834', doctor: '/api/health', tags: ['ciba', 'oauth', 'human-in-the-loop', 'token-exchange'] },
    glossary: [
      { id: 'ciba', term: 'CIBA (Client-Initiated Backchannel Authentication)', definition: 'OpenID Connect CIBA Core 1.0: the client (here the API gateway\'s approval plugin) asks the authorization server to authenticate and get consent from the user out of band, on a different device. The client polls the token endpoint with the auth_req_id until the user approves, denies or the request expires.', aliases: ['backchannel authentication', 'out-of-band approval'] },
      { id: 'auth-req-id', term: 'auth_req_id', definition: 'The handle CIBA returns for a pending approval. The agent replays the call with it; the gateway exchanges it at the token endpoint. It is not a verdict — only PingOne knows whether the user said yes.', aliases: ['request state', 'approval handle'] },
      { id: 'token-exchange', term: 'Token exchange (RFC 8693)', definition: 'Swapping one token for another with a narrower audience and scope. Each hop in this flow exchanges before it calls downstream, so a leaked token is useful against one service, for one scope, for minutes.', aliases: ['RFC 8693', 'on-behalf-of'] },
      { id: 'binding-message', term: 'binding_message', definition: 'The short human-readable code (BK-XXXX here) shown on both the initiating device and the approval device, so the person approves the request they were shown. PingOne limits it to 8 characters.', aliases: ['BK-XXXX'] },
      { id: 'sideband', term: 'Sideband decision', definition: 'The API gateway forwards each call\'s method, path and headers to PingOne Authorize (POST /sideband/request) and enforces the verdict. The gateway enforces; the policy engine decides.', aliases: ['PingOne Authorize sideband'] },
    ],
    sources: [
      { id: 'ciba-core', title: 'OpenID Connect CIBA Core 1.0', url: 'https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html', kind: 'standard', use: 'Backchannel authentication, auth_req_id, poll mode, binding_message, the authorization_pending / access_denied / expired_token answers.', status: 'not-read', checked: '2026-11-21' },
      { id: 'rfc8693', title: 'RFC 8693: OAuth 2.0 Token Exchange', url: 'https://www.rfc-editor.org/rfc/rfc8693', kind: 'standard', use: 'The token narrowing at every hop: subject_token, audience and scope in the exchange request, issued_token_type in the answer.', status: 'not-read', checked: '2026-11-21' },
      { id: 'rfc6749', title: 'RFC 6749: The OAuth 2.0 Authorization Framework', url: 'https://www.rfc-editor.org/rfc/rfc6749', kind: 'standard', use: 'Token endpoint request and error shapes (5.1, 5.2) the poll answers use.', status: 'not-read', checked: '2026-11-21' },
    ],
    cards: [
      ...PHASES.map((p) => ({ id: `try-${p.id}`, label: p.title, description: SAY[p.story].split('. ').slice(1).join('. ') || p.title, group: 'try-it', action: { type: 'route', href: '/#flow' }, terms: [p.term], story: p.story })),
      { id: 'concept-binding', label: 'Match the codes: the binding message', description: 'BK-XXXX appears on both the chat and the other device; approving matches them, so a stolen approval approves nothing else.', group: 'concept', action: { type: 'route', href: '/#flow' }, terms: ['binding-message', 'ciba'], story: 'S02' },
      { id: 'concept-narrow', label: 'Watch the tokens narrow', description: 'Click any message for the wire text and the decoded claims: the audience claim says who may accept each token.', group: 'concept', action: { type: 'route', href: '/#flow' }, terms: ['token-exchange'], story: 'S01' },
      { id: 'ref-doctor', label: 'Doctor and health', description: 'Preflight checks and the demo-health/1 endpoint.', group: 'setup', action: { type: 'route', href: '/api/health' } },
    ],
    stories: PHASES.map((p) => ({ id: p.story, title: p.title, say: SAY[p.story] })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), `${JSON.stringify(buildPack(), null, 2)}\n`);
  console.log('wrote content-pack.json');
}
