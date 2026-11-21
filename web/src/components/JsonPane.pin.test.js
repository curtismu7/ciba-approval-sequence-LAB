// The vendored shared/json files (JsonPane.jsx, JsonPane.css) match their pin files byte for byte, and the pins equal the
// canonical hashes. They come from curtismu7/AI-DEMO-Standalone shared/json: change them there, re-pin, re-vendor; never
// edit them here. JsonPane is THE standard JSON pane (rule 24) and carries the rule 24b JWT decoding.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const CANON = { "JsonPane.jsx": "23b77832335718e30b6f62322f520ac6ada3d84be703316fa805b72bede4b48b", "JsonPane.css": "1e794d9470cf3b42d82b99927fcdcc41e5f61024afac92c926cae7afb66a8fbc" };

describe("vendored JsonPane", () => {
  it("matches JsonPane.sha256 and JsonPane.css.sha256, and the canonical hashes", () => {
    const dir = path.join(process.cwd(), "src", "components");
    for (const [file, pinFile] of [["JsonPane.jsx", "JsonPane.sha256"], ["JsonPane.css", "JsonPane.css.sha256"]]) {
      const [hash, name] = fs.readFileSync(path.join(dir, pinFile), "utf8").trim().split(/\s+/);
      expect(name, pinFile).toBe(file);
      const actual = createHash("sha256").update(fs.readFileSync(path.join(dir, file))).digest("hex");
      expect(actual, file).toBe(hash);
      expect(actual, `${file} vs canonical`).toBe(CANON[file]);
    }
  });
});
