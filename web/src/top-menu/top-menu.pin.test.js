// The vendored shared/top-menu files (TopMenu.jsx, top-menu.css) match their pin file byte for byte, and the pins equal the
// canonical hashes. They come from curtismu7/AI-DEMO-Standalone shared/top-menu: change them there, re-pin, re-vendor; never
// edit them here. ReleaseNotes.jsx rides along (TopMenu.jsx imports it); the pin covers TopMenu.jsx + top-menu.css only (rule 22).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const CANON = { "TopMenu.jsx": "de5eae292af976ac084a3e381b61a81b7f8ca1505c683ee0a14fcdd24917ef7f", "top-menu.css": "ebddfcadc0e17bfebc981317a2720ddfe319818e7af1e268dae77826c5940651" };

describe("vendored top-menu", () => {
  it("matches top-menu.sha256 and the canonical hashes", () => {
    const dir = path.join(process.cwd(), "src", "top-menu");
    const pins = fs.readFileSync(path.join(dir, "top-menu.sha256"), "utf8").trim().split("\n").map((l) => l.split(/\s+/));
    expect(pins.map(([, f]) => f).sort()).toEqual(["TopMenu.jsx", "top-menu.css"]);
    for (const [hash, file] of pins) {
      const actual = createHash("sha256").update(fs.readFileSync(path.join(dir, file))).digest("hex");
      expect(actual, file).toBe(hash);
      expect(actual, `${file} vs canonical`).toBe(CANON[file]);
    }
    // TopMenu.jsx imports ReleaseNotes.jsx: the whole canonical directory is vendored.
    expect(fs.existsSync(path.join(dir, "ReleaseNotes.jsx"))).toBe(true);
  });
});
