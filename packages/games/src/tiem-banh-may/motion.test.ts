import { describe, expect, it } from "vitest";
import { DUR, Motion, easeOut } from "./motion";

describe("easeOut", () => {
  it("runs 0 → 1, never backwards, and front-loads the motion", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    let last = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const v = easeOut(t);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(1);
      last = v;
    }
    // A strong ease-out is most of the way there by a quarter of the time
    expect(easeOut(0.25)).toBeGreaterThan(0.7);
  });
});

describe("Motion", () => {
  it("ages a key from the frame it appears, and forgets it once it is not drawn", () => {
    const m = new Motion(false);
    m.frame(10);
    expect(m.enter("sheet:a", DUR.sheetIn)).toBe(0);
    m.frame(10 + DUR.sheetIn);
    expect(m.enter("sheet:a", DUR.sheetIn)).toBe(1);
    // A frame without it: drawn again, it opens afresh
    m.frame(11);
    m.frame(12);
    expect(m.age("sheet:a")).toBe(0);
  });

  it("nudges a badge when its value changes, but not when first shown", () => {
    const m = new Motion(false);
    m.frame(1);
    expect(m.bump("basket", 0)).toBe(1);
    m.frame(2);
    expect(m.bump("basket", 1)).toBeGreaterThan(1);
    m.frame(2 + DUR.bump);
    expect(m.bump("basket", 1)).toBe(1);
  });

  it("keeps still for reduced motion", () => {
    const m = new Motion(true);
    m.frame(1);
    m.bump("basket", 0);
    m.frame(2);
    expect(m.bump("basket", 3)).toBe(1);
  });
});
