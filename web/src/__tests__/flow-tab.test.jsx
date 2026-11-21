// FlowTab tests: the diagram renders the 71 steps the server serves, and the §8f walkthrough
// behaviour the ported components bring (Next from fresh → paused at step 1, Prev disabled at
// step 1, gating by position not paused-state).
import { describe, expect, it, vi, afterEach } from "vitest";
import assert from "node:assert/strict";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlowTab from "../components/FlowTab.jsx";

// Two diagrams now share the page (the studio overview and the 71-message sequence); scope queries to the sequence bar.
const seqBarEl = async () => await screen.findByTestId("diagram-step-bar");
const q = async (fn, ...a) => fn(await seqBarEl(), ...a);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const source = (n) => {
  const lines = ["sequenceDiagram", "autonumber", "participant a as Alice", "participant b as Bob"];
  for (let i = 1; i <= n; i += 1) lines.push(`a->>b: message number ${i} of the walkthrough`);
  return lines.join("\n");
};
const DIAGRAM = (n) => ({ schema: "ciba-approval-sequence/1", source: source(n), participants: { a: "Alice's role", b: "Bob's role" }, bands: 3, messages: n, payloads: [], steps: [] });

const renderDiagram = async (n = 71) => {
  vi.stubGlobal("fetch", vi.fn(async (url) => (url === "api/diagram"
    ? { ok: true, status: 200, json: async () => DIAGRAM(n) }
    : { ok: false, status: 404, json: async () => ({}) })));
  render(<FlowTab />);
  await screen.findByTestId("sequence-flow-canvas");
  return screen.findByTestId("diagram-step-bar");
};

describe("the sequence diagram", () => {
  it("renders the 71 steps and says so in the step bar", async () => {
    await renderDiagram(71);
    const caption = await screen.findByText(/Simulate walks the 71 arrows in order/i);
    expect(caption).toBeTruthy();
    // jsdom cannot measure the canvas (React Flow draws edges only with real layout), so the
    // messages are asserted through the movie reel: one card per message, numbered 1..71.
    await waitFor(() => expect(document.querySelectorAll(".dreel-card").length).toBe(71));
    expect([...document.querySelectorAll(".dreel-n")].map((n) => n.textContent).join(",")).toBe(Array.from({ length: 71 }, (_, i) => String(i + 1)).join(","));
  });

  it("shows a clear error when the diagram cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    render(<FlowTab />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load the diagram/i);
  });
});

describe("§8f walkthrough controls", () => {
  it("Next from a fresh page starts the walkthrough paused at step 1 (Prev disabled there)", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    const step = await within(await seqBarEl()).findByRole("button", { name: "Step →" });
    await user.click(step);
    const caption = await screen.findByText(/Step 1 of 71/);
    expect(caption).toBeTruthy();
    expect(within(await seqBarEl()).getByRole("button", { name: "← Prev" })).toBeDisabled();
  });

  it("Next advances by position, not paused-state: Next twice reaches step 2 while paused", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Step →" }));
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Next →" }));
    expect(await screen.findByText(/Step 2 of 71/)).toBeTruthy();
    expect(within(await seqBarEl()).getByRole("button", { name: "← Prev" })).toBeEnabled();
  });

  it("Prev from step 2 goes back to step 1; Simulate plays and Stop returns to the plain diagram", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Step →" }));
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Next →" }));
    await user.click(within(await seqBarEl()).getByRole("button", { name: "← Prev" }));
    expect(await screen.findByText(/Step 1 of 71/)).toBeTruthy();
    // while a walkthrough is active the Simulate button has swapped for Pause/Resume
    await user.click(within(await seqBarEl()).getByRole("button", { name: "Resume" }));
    expect(within(await seqBarEl()).getByRole("button", { name: "Pause" })).toBeTruthy();
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Stop" }));
    expect(await screen.findByText(/Simulate walks the 71 arrows in order/i)).toBeTruthy();
  });

  it("Step or Next while PLAYING pauses the walkthrough and waits for the next press (owner 2026-11-21)", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    // Start playing.
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Simulate" }));
    expect(within(await seqBarEl()).getByRole("button", { name: "Pause" })).toBeTruthy();
    // Pressing Next mid-play stops auto-advance: the button swaps back to Resume.
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Next →" }));
    expect(within(await seqBarEl()).getByRole("button", { name: "Resume" })).toBeTruthy();
    // Play again, then Step → also pauses instead of racing the timer.
    await user.click(within(await seqBarEl()).getByRole("button", { name: "Resume" }));
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Step →" }));
    expect(within(await seqBarEl()).getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("Reset (the bar's own) clears the walkthrough and re-fits the diagram", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    await user.click(await within(await seqBarEl()).findByRole("button", { name: "Step →" }));
    const reset = await within(await seqBarEl()).findByRole("button", { name: "Reset" });
    await user.click(reset);
    expect(await screen.findByText(/Simulate walks the 71 arrows in order/i)).toBeTruthy();
  });

  it("the speed control is present with its dwell options and is disabled while playing", async () => {
    const user = userEvent.setup();
    await renderDiagram(71);
    const speed = await within(await seqBarEl()).findByRole("combobox", { name: /step time/i });
    expect(speed.options.length).toBeGreaterThanOrEqual(3);
    await user.click(within(await seqBarEl()).getByRole("button", { name: "Simulate" }));
    expect(speed).toBeDisabled();
  });
});

describe("edge-label click-through", () => {
  it("every non-interactive node carries inline pointer-events none (React Flow writes 'all' inline, which beats any stylesheet rule)", async () => {
    // A regression: without the inline style a lifeline sat over the message labels and swallowed their clicks,
    // leaving the movie reel as the only way to open a step's details.
    await renderDiagram(71);
    const inert = await waitFor(() => {
      const nodes = document.querySelectorAll(".react-flow__nodes .react-flow__node");
      assert.ok(nodes.length, "nodes rendered");
      for (const n of nodes) {
        if (/(anchor|lifeline|note|payload|issue|frag|box|band|frame)/.test(n.className)) {
          expect(n.style.pointerEvents, n.dataset.id).toBe("none");
        }
      }
      return true;
    });
    expect(inert).toBe(true);
  });
});
