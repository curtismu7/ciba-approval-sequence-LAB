// App tests: the shell behaviours the rules require — the simulation banner (rule 2) and the
// Mock/Real toggle (rule 19: POST /api/mode with exactly { source }, 409 surfaced, Real disabled
// with a how-to tooltip when realAvailable=false, data reload on success).
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { BANNER_UNKNOWN, bannerFor } from "../App.jsx";

// FlowTab fetches the 71-message diagram; jsdom fetch is stubbed per test.
function stubFetch(routes) {
  const calls = [];
  const fn = vi.fn(async (url, init = {}) => {
    const method = init.method || "GET";
    calls.push({ path: url, method, init });
    const r = routes[`${method} ${url}`];
    if (!r) return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
    const out = typeof r === "function" ? r(init.body ? JSON.parse(init.body) : undefined) : r;
    return out.status
      ? { ok: out.status < 400, status: out.status, json: async () => out.body }
      : { ok: true, status: 200, json: async () => out };
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const INFO = { mode: "mock", source: "mock", simulated: true, realAvailable: false, version: "0.1.0" };
const DIAGRAM = { schema: "ciba-approval-sequence/1", source: "sequenceDiagram\n", participants: {}, bands: 3, messages: 71, payloads: [], steps: [] };

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("simulation banner (rule 2)", () => {
  it("is present and names what is simulated", async () => {
    stubFetch({ "GET /api/info": INFO, "GET /api/diagram": DIAGRAM });
    render(<App />);
    const banner = await screen.findByTestId("banner");
    expect(banner.textContent).toMatch(/SIMULATED/i);
    expect(banner.textContent).toMatch(/mock tokens/i);
  });

  it("reacts to the mode from /api/info: Real mode names what is real vs simulated", () => {
    expect(bannerFor({ ...INFO, source: "real", mode: "real" })).toMatch(/REAL MODE/i);
    expect(bannerFor({ ...INFO, source: "real", mode: "real" })).toMatch(/modelled sequence/i);
    expect(bannerFor(null)).toBe(BANNER_UNKNOWN);
    expect(bannerFor(INFO)).toMatch(/mock tokens/i);
  });
});

describe("Mock/Real toggle (rule 19)", () => {
  it("calls POST /api/mode with exactly { source } and reloads the data after the switch", async () => {
    let source = "mock";
    const calls = stubFetch({
      "GET /api/info": () => ({ mode: source, source, simulated: true, realAvailable: true, version: "0.1.0" }),
      "GET /api/diagram": DIAGRAM,
      "POST /api/mode": (b) => {
        expect(b).toEqual({ source: "real" }); // exactly { source }
        source = b.source;
        return { source };
      },
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<App />);
    const toggle = await screen.findByTestId("mode-select");
    await waitFor(() => expect(toggle).toHaveValue("mock"));
    await userEvent.selectOptions(toggle, "real");
    await waitFor(() => expect(calls.some((c) => c.path === "/api/mode" && c.method === "POST")).toBe(true));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("a 409 from POST /api/mode (Real lost its configuration between load and switch) surfaces the server's detail and the badge stays Mock", async () => {
    stubFetch({
      "GET /api/info": { ...INFO, realAvailable: true },
      "GET /api/diagram": DIAGRAM,
      "POST /api/mode": { status: 409, body: { error: "real_not_configured", detail: "Real mode needs REAL_CIBA_ENV_ID (owner-run). Mock keeps working." } },
    });
    render(<App />);
    const toggle = await screen.findByTestId("mode-select");
    await waitFor(() => expect(toggle).toHaveValue("mock"));
    await userEvent.selectOptions(toggle, "real");
    await waitFor(() => expect(screen.getByText(/REAL_CIBA_ENV_ID/)).toBeTruthy());
    expect(screen.getByTestId("mode-badge").textContent).toBe("Mock");
  });

  it("when realAvailable is false the Real option is disabled, carries the how-to tooltip, and switching never reaches the server", async () => {
    const calls = stubFetch({ "GET /api/info": INFO, "GET /api/diagram": DIAGRAM });
    render(<App />);
    const toggle = await screen.findByTestId("mode-select");
    const real = toggle.querySelector('option[value="real"]');
    await waitFor(() => expect(real).toBeDisabled());
    expect(real.title).toMatch(/REAL_CIBA_ENV_ID/);
    await userEvent.selectOptions(toggle, "real");
    expect(calls.some((c) => c.path === "/api/mode")).toBe(false);
  });
});
