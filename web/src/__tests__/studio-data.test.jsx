// The studio data is diagram-studio/1, vendored byte for byte and never hand-edited (rule 17).
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDiagram, edgeIndex } from "../diagram-data";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../studio-data");

describe("the vendored studio diagram (rule 17)", () => {
  it("matches studio-data.sha256", () => {
    const pins = readFileSync(path.join(dir, "studio-data.sha256"), "utf8").trim().split("\n")
      .map((l) => l.trim()).filter((l) => /^[0-9a-f]{64}\s/.test(l));
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      const [hash, file] = pin.split(/\s+/);
      const actual = createHash("sha256").update(readFileSync(path.join(dir, path.basename(file)))).digest("hex");
      expect(actual, file).toBe(hash);
    }
  });

  it("is diagram-studio/1 data, looked up by name, with steps and edges the walkthrough can walk", () => {
    const d = getDiagram("pfl-ciba");
    expect(d.schema).toBe("diagram-studio/1");
    expect(d.nodes.length).toBeGreaterThanOrEqual(3);
    expect(d.edges.length).toBeGreaterThanOrEqual(3);
    expect(d.steps.length).toBeGreaterThanOrEqual(3);
    for (const s of d.steps) for (const e of s.edges || []) expect(d.edges[e]).toBeTruthy();
    expect(() => edgeIndex(d, "lab", "token")).not.toThrow();
    expect(() => getDiagram("no-such-flow")).toThrow(/unknown diagram/);
  });
});
