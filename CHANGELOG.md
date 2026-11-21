# Changelog

## 0.2.0 (unreleased)
- Step 3 (integration): shelf entry (`docs/shelf-entry.json`, catalog D119), Learning Hub content pack (`content-pack.json`, built from the CIBA step data by `npm run content-pack`), talk track as data (`web/src/talkTrack.js`) with `docs/talk-track.md` generated from it, presenter-mode verification with the banner visible, doctor extended (compose restart policy, 71-step contract, vendored pins, studio data, port free/occupied-by-this-app, info contract), CI on GitHub-hosted runners (Node 26: tests, build, conformance gate, gitleaks, forbidden strings, no-AI-attribution), cast templating with three vertical packs (rule 10) and `GET /api/talk-track`, the diagram-studio `pfl-ciba` overview vendored and pinned (rule 17), and two step-2 fixes: the netguard dead import removed, and canvas edge labels now take the click (React Flow writes `pointer-events: all` inline on every node, so the click-through is set inline on the non-interactive nodes too).

## 0.1.0
- Step 1 (core): server, ported CIBA sequence data (71 messages, 10 lifelines, 3 phases), health/info/mode/diagram/reset API, loopback safety, netguard, 24 server tests.
- Step 2 (web): React walkthrough UI — the 71-message lucid-variant sequence diagram, movie reel with wire detail and decoded tokens, §8f walkthrough controls, vendored TopMenu/JsonPane with pins, rule-19 mode toggle, 14 web tests.
