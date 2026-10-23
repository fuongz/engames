import { describe, expect, it } from "vitest";
import { fixedSteps } from "./game";
import { clamp, inRect, mulberry32, nextRandom, smoothstep } from "./math";

describe("math", () => {
  it("replays a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, a);
    expect(xs).toEqual(Array.from({ length: 5 }, b));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("nextRandom matches mulberry32 and survives a JSON round trip", () => {
    const a = mulberry32(7);
    let state = { seed: 7 };
    for (let i = 0; i < 5; i++) {
      expect(nextRandom(state)).toBe(a());
      state = JSON.parse(JSON.stringify(state));
    }
  });

  it("hit-tests edges inclusively", () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(inRect({ x: 10, y: 10 }, r)).toBe(true);
    expect(inRect({ x: 10.1, y: 5 }, r)).toBe(false);
  });

  it("clamps easings", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
  });
});

describe("fixedSteps", () => {
  const step = 1 / 60;

  it("carries the remainder as alpha", () => {
    const r = fixedSteps(0, step * 2.5, step);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5);
  });

  it("runs the same total updates at 60 and 120 Hz", () => {
    const count = (hz: number) => {
      let acc = 0;
      let n = 0;
      for (let i = 0; i < hz; i++) {
        const r = fixedSteps(acc, 1 / hz, step);
        acc = r.acc;
        n += r.steps;
      }
      return n;
    };
    expect(Math.abs(count(60) - count(120))).toBeLessThanOrEqual(1);
  });

  it("drops a long stall instead of spiralling", () => {
    const r = fixedSteps(0, 10, step);
    expect(r.steps).toBe(5);
    expect(r.acc).toBeLessThanOrEqual(step);
  });
});
