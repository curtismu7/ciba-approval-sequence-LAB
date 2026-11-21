# CIBA Approval Sequence LAB

Tier: Demo.
Repo: https://github.com/curtismu7/ciba-approval-sequence-LAB

The CIBA (Client-Initiated Backchannel Authentication) out-of-band approval flow, told as a
clickable 71-message sequence diagram. An AI agent books a flight: the search is allowed, the
booking write is held by PingOne Authorize until the user approves on another device (CIBA),
and the call is replayed and polled after the approval. Ten lifelines, three phase bands,
a poll loop with an inner alt, and a closing alt. Catalog id D119 (HITL, MFA & CIBA gate).

- Click any message to see the hop: the raw request and response wire text, the decoded tokens,
  the why, and the RFC / spec standards behind it (RFC 8693 token exchange, CIBA Core 1.0,
  RFC 6749, RFC 6750, RFC 8707, MCP, OIDC).
- The 71-message sequence is the one diagram (owner decision 2026-11-21: a compact
  diagram-studio overview was removed because it did not match the sequence story). It renders
  per the family diagram rules: React Flow, Simulate / Prev / Next, Reset, speed control.
- The story is templated (rule 10): three vertical packs (retail / health / finance) name the
  brand, agent and host; `customer.config.json` (git-ignored, see `customer.config.example.json`)
  can override the cast.

## What is simulated vs what would be real

Everything here is educational wire-shape data: every host is `.example`, the tokens are
illustrative examples (labelled, never real credentials), and the sequence models public
product behaviour and the RFCs — not captured traffic. Where the reference chart or public
documentation does not state a detail it is marked `(not traced)` or `Illustrative`.

In a real deployment the same shape would be: a real PingOne environment issuing the tokens
and running CIBA, a real PingOne Authorize policy deciding each call over the Sideband API,
a real API gateway enforcement plugin, and a push to the person's enrolled device. The lab
models all of that offline; it makes no outbound network call (a netguard test proves zero).

Real mode (owner-run) is a contract: `POST /api/mode` accepts `real` only when the owner has
configured the tenant in the `.env` beside the compose file; otherwise it answers 409 and
Mock keeps working. The Mock/Real toggle is in the header of every page.

## Run

```
npm install
npm start                 # http://127.0.0.1:7834/
```

| Command | What it does |

```
docker compose up --build -d   # published on 127.0.0.1:7834 only, restart: unless-stopped
```

## Ports, and what to do if the port is taken

The lab listens on 7834 (from the packed range, registered in demo-shelf). The server binds
127.0.0.1 only. If 7834 is taken by another process:

- Another copy of this lab is already running: use that one (or `docker compose down` in its
  checkout first). `npm run doctor` says when the port is held by this app.
- Something else holds it: `PORT=7835 npm start` for a one-off run (the doctor accepts any
  port), and never register a different port in `docs/shelf-entry.json` — 7834 is this lab's
  registered port.

| Command | What it does |
| --- | --- |
| `npm test` | server tests (node:test) + web tests (vitest) + repo/artifact tests + token-decode and stylesheet-pin checks |
| `npm run build` | builds the web UI to `web/dist` (served by the server when present) |
| `npm run doctor` | preflight: node, port, bind, mode, compose restart policy, 71-step contract, studio data, vendored pins, info contract |
| `npm run reset` | resets the running lab to default state |
| `npm run talk-track` | regenerates `docs/talk-track.md` from the talk-track data |
| `npm run content-pack` | regenerates + validates `content-pack.json` |
| `npm run conformance` | the demo-kit conformance gate (`--new --tier=Demo`) |

## Run from a clone

Prerequisites: Node 26 or newer. Mock mode works with no setup at all: no tenant, no
credentials, no settings file.

```
git clone https://github.com/curtismu7/ciba-approval-sequence-LAB.git
cd ciba-approval-sequence-LAB
npm ci
npm start                 # http://127.0.0.1:7834/
```

## API

- `GET /api/health` — `demo-health/1`.
- `GET /api/info` — `{ source, realAvailable, simulated, ... }` for the mode banner and toggle.
- `POST /api/mode` — exactly `{ source: "mock" | "real" }`; 409 `real_not_configured` when Real is not configured.
- `GET /api/diagram` — the full CIBA sequence data: the sequence source, participants, bands,
  frames, notes, and per-message step details (71 entries), plus the cast and verticals.
- `GET /api/talk-track` — the presenter's talk track with the `{{cast}}` tokens filled.
- `POST /api/reset` — restore default state.

Workspace id `default` (header `X-Workspace`) is reserved for per-visitor data in later steps.

## How the Mock/Real toggle works

The header toggle calls `POST /api/mode` with exactly `{ source }` and reloads the page's data.
The server's mode is launch-derived (Real if the tenant env vars are set, else Mock) and then
runtime state. Real not configured: the button is disabled with a how-to tooltip and the server
answers 409 `real_not_configured`. Both switch directions, the 409 and the data reload have tests.

## Attribution

The 71-message sequence diagram is ported from the AI-DEMO2 banking demo's CIBA approval
sequence page and rewritten for this lab: origin-specific "this repo" implementation notes and
file references were generalized to public product/RFC behaviour, all identifiers were scrubbed,
and no code was imported across repos. The overview diagram is the diagram-studio repo's own
`pfl-ciba` flow (vendored, pinned).
