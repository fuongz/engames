import { describe, expect, it } from "bun:test";
import { catalogs } from "./index";

/** Every string leaf of a catalog, keyed by path, so the two can be compared. */
function leaves(value: unknown, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === "string") out.set(path, value);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) for (const [p, s] of leaves(v, `${path}.${k}`)) out.set(p, s);
  }
  return out;
}

describe("catalogs", () => {
  it("English mirrors every Vietnamese entry, with the same placeholders and markup", () => {
    const vi = leaves(catalogs.vi);
    const en = leaves(catalogs.en);
    expect([...en.keys()].sort()).toEqual([...vi.keys()].sort());
    const tokens = (s: string) => [...s.matchAll(/\{\w+\}|\[\[[^\]]+\]\]/g)].map((m) => m[0]).sort();
    for (const [path, text] of vi) {
      const other = en.get(path) ?? "";
      expect(other.trim().length, path).toBeGreaterThan(0);
      expect(tokens(other), path).toEqual(tokens(text));
    }
  });
});
