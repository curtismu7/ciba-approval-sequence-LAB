// App tests: the shell behaviours the rules require — the Real-or-mock modal (rule 2, amended 2026-11-28; it replaced the simulation banner) and the
// Mock/Real toggle (rule 19: POST /api/mode with exactly { source }, 409 surfaced, Real disabled
// with a how-to tooltip when realAvailable=false, data reload on success).
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { MODE_LINES } from "../App.jsx";

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

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe("Real-or-mock modal (rule 2)", () => {
  it("opens on MOCK with what is simulated, and there is no banner", async () => {
    stubFetch({ "GET api/info": INFO, "GET api/diagram": DIAGRAM });
    render(<App />);
    const modal = await screen.findByTestId("mode-modal");
    await waitFor(() => expect(modal.textContent).toMatch(/mock tokens/i));
    expect(modal).toHaveAttribute("data-mode", "mock");
    expect(modal.textContent).toMatch(/MOCK/);
    expect(modal.textContent).toMatch(/Simulated:/);
    expect(modal.textContent).toMatch(/mock approval service and a mock flight API/i);
    expect(modal.textContent).toMatch(/No real identity provider, gateway or API is called/);
    expect(modal.textContent).toMatch(/model, not live traffic/);
    expect(screen.queryByTestId("banner")).toBeNull();
    expect(document.querySelector(".banner")).toBeNull();
  });

  it("Got it closes it and a remount in the same session does not bring it back", async () => {
    stubFetch({ "GET api/info": INFO, "GET api/diagram": DIAGRAM });
    const first = render(<App />);
    await userEvent.click(await screen.findByTestId("mode-modal-ok"));
    expect(screen.queryByTestId("mode-modal")).toBeNull();
    first.unmount();
    render(<App />);
    await screen.findByTestId("mode-select");
    expect(screen.queryByTestId("mode-modal")).toBeNull();
  });

  it("Real mode from /api/info shows REAL and names what is still modelled", async () => {
    stubFetch({ "GET api/info": { ...INFO, source: "real", mode: "real", realAvailable: true }, "GET api/diagram": DIAGRAM });
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("mode-modal")).toHaveAttribute("data-mode", "real"));
    const modal = screen.getByTestId("mode-modal");
    expect(modal.textContent).toMatch(/REAL/);
    expect(modal.textContent).toMatch(/owner-configured on the server/);
    expect(modal.textContent).toMatch(/still the modelled sequence with its example wire data/);
    expect(modal.textContent).toMatch(/model, not live traffic/);
  });

  it("Real-on-load race: holds /api/info, shows MOCK (unknown line), then REAL once it answers, even though MOCK was dismissed", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    stubFetch({
      "GET api/info": async () => { await gate; return { ...INFO, source: "real", mode: "real", realAvailable: true }; },
      "GET api/diagram": DIAGRAM,
    });
    render(<App />);
    const mock = await screen.findByTestId("mode-modal");
    expect(mock).toHaveAttribute("data-mode", "mock");
    await userEvent.click(screen.getByTestId("mode-modal-ok"));
    expect(screen.queryByTestId("mode-modal")).toBeNull();
    release();
    await waitFor(() => expect(screen.getByTestId("mode-modal")).toHaveAttribute("data-mode", "real"));
  });

  it("while /api/info has not answered, or failed, the modal says MOCK with the unknown line (simulated, or a hosted simulation)", async () => {
    stubFetch({ "GET api/diagram": DIAGRAM }); // api/info answers 404: the load failed
    render(<App />);
    await screen.findByRole("alert");
    const modal = screen.getByTestId("mode-modal");
    expect(modal).toHaveAttribute("data-mode", "mock");
    expect(modal.textContent).toMatch(/Simulated, or a hosted simulation/);
    expect(modal.textContent).toMatch(/mock approval service and a mock flight API/);
    expect(modal.textContent).toMatch(/model, not live traffic/);
  });

  it("each state has its own non-empty line, and every one says the lifelines are a model", () => {
    for (const k of ["mock", "real", "unknown"]) { expect(MODE_LINES[k].length).toBeGreaterThan(40); expect(MODE_LINES[k]).toMatch(/model, not live traffic/); }
  });
});

describe("Mock/Real toggle (rule 19)", () => {
  it("calls POST /api/mode with exactly { source } and reloads the data after the switch", async () => {
    let source = "mock";
    const calls = stubFetch({
      "GET api/info": () => ({ mode: source, source, simulated: true, realAvailable: true, version: "0.1.0" }),
      "GET api/diagram": DIAGRAM,
      "POST api/mode": (b) => {
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
    await waitFor(() => expect(calls.some((c) => c.path === "api/mode" && c.method === "POST")).toBe(true));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("a 409 from POST /api/mode (Real lost its configuration between load and switch) surfaces the server's detail and the badge stays Mock", async () => {
    stubFetch({
      "GET api/info": { ...INFO, realAvailable: true },
      "GET api/diagram": DIAGRAM,
      "POST api/mode": { status: 409, body: { error: "real_not_configured", detail: "Real mode needs REAL_CIBA_ENV_ID (owner-run). Mock keeps working." } },
    });
    render(<App />);
    const toggle = await screen.findByTestId("mode-select");
    await waitFor(() => expect(toggle).toHaveValue("mock"));
    await userEvent.selectOptions(toggle, "real");
    await waitFor(() => expect(screen.getByText(/REAL_CIBA_ENV_ID/)).toBeTruthy());
    expect(screen.getByTestId("mode-badge").textContent).toBe("Mock");
  });

  it("when realAvailable is false the Real option is disabled, carries the how-to tooltip, and switching never reaches the server", async () => {
    const calls = stubFetch({ "GET api/info": INFO, "GET api/diagram": DIAGRAM });
    render(<App />);
    const toggle = await screen.findByTestId("mode-select");
    const real = toggle.querySelector('option[value="real"]');
    await waitFor(() => expect(real).toBeDisabled());
    expect(real.title).toMatch(/REAL_CIBA_ENV_ID/);
    await userEvent.selectOptions(toggle, "real");
    expect(calls.some((c) => c.path === "api/mode")).toBe(false);
  });
});
