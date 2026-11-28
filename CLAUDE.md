# ciba-approval-sequence-LAB

Demo-tier standalone app: the CIBA out-of-band approval flow as a clickable 71-message
sequence diagram (10 lifelines, 3 phases: search, a held booking write needing approval,
replay + polling). The server serves the ported diagram data; the React walkthrough UI is
step 2.

- Run: `npm install && npm start` (http://127.0.0.1:7834). Test: `npm test` (server,
  `node --test test/*.test.js`, a glob). Reset: `npm run reset`.
- Data: `server/src/data/cibaApprovalSequence.js` (ported, origin identifiers scrubbed —
  do not re-add "this repo" claims or other projects' file paths) + `sequenceWrap.js`.
  Served intact by `GET /api/diagram`.
- API: `/api/health` (demo-health/1), `/api/info` (source/realAvailable), `POST /api/mode`
  (exactly `{source}`, 409 when Real not configured), `/api/diagram`, `POST /api/reset`.
- Rules that bite: loopback bind only (127.0.0.1); Host check + LAB_ALLOWED_HOSTS;
  same-origin writes; port 7834; only `.example`/`.invalid` hosts in any text; no outbound
  network in mock (netguard test); `crypto.generateKeyPairSync('ec')` forbidden in
  app/test code; compose sets `restart: unless-stopped` and reads `.env` beside it.
- Real mode is owner-configured via `.env` beside the compose file (see `.env.example`);
  agents never use live credentials. Default is mock.
- Web (step 2): Vite + React in `web/`, built to `web/dist` (`npm run build`) and served
  by the server when present.
- Step 3 (integration): docs/shelf-entry.json (catalog D119, tags ciba/oauth/human-in-the-loop/
  token-exchange), content-pack.json (`npm run content-pack`; validates against the copied schema
  with ajv), docs/talk-track.md (`npm run talk-track`; a test fails on drift from
  web/src/talkTrack.js), doctor (`npm run doctor`: node, port, bind, mode, compose restart policy,
  71-step contract, studio data, vendored pins, info contract), CI (.github/workflows/ci.yml,
  Node 26 only, vendored gate `test/kit/demo-kit-conformance.mjs`), cast templating
  (server/src/cast.js, 4 vertical packs (airlines is the default: AirGuard Airlines), customer.config.json override; a test fails on an
  undefined token), and the vendored diagram-studio flow web/src/studio-data/ (rule 17, pinned).
  The conformance gate must stay 0 FAIL: `npm run conformance`. The diagram renderer is ported from the family reference
  (read-only source; never import across repos). Vendored, byte-pinned, never hand-edited:
  `web/src/top-menu/` (rule 22), `web/src/components/JsonPane.*` (rule 24/24b),
  `web/src/standalone-ui.css` (check with `sh scripts/check-ui-standard.sh`). Tests:
  `npm test` runs server (node --test) + web (vitest) + the token-decode and
  stylesheet-pin checks.
