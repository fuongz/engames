import { describe, expect, it } from "vitest";
import { BASE, GROW, GROW_STREAK, MIN_OVERLAP, PERFECT_TOL, SPAN, SPEED_MAX, SPEED_START, speedFor } from "./config";
import { type Box, type Run, createRun, drop, hueFor, moverBox, start, tick, top } from "./logic";

const playing = (seed = 1) => {
  const r = createRun(seed);
  start(r);
  return r;
};

/** Put the sliding slab at an offset from the slab below, on its current axis. */
const at = (r: Run, offset: number) => {
  const t = top(r);
  r.mover.pos = (r.mover.axis === "x" ? t.x : t.z) + offset;
};

const area = (b: Box) => b.w * b.d;

describe("a run", () => {
  it("waits for the first tap, then starts on the x axis over the pedestal", () => {
    const r = createRun(7);
    expect(r.phase).toBe("ready");
    expect(drop(r)).toBeNull();
    const before = r.mover.pos;
    tick(r, 0.5);
    expect(r.mover.pos).toBe(before);
    start(r);
    expect(r.phase).toBe("play");
    expect(r.mover.axis).toBe("x");
    expect(Math.abs(r.mover.pos)).toBeCloseTo(SPAN);
    expect(r.stack).toEqual([{ x: 0, z: 0, w: BASE, d: BASE }]);
  });

  it("is deterministic for a seed", () => {
    const play = (seed: number) => {
      const r = playing(seed);
      const out: unknown[] = [];
      for (let i = 0; i < 30 && r.phase === "play"; i++) {
        for (let k = 0; k < 37 + i; k++) tick(r, 1 / 60);
        out.push(drop(r));
      }
      return { out, r };
    };
    expect(play(42)).toEqual(play(42));
    expect(play(42).r.hue0).not.toBe(play(43).r.hue0);
  });

  it("alternates axes and enters from an end of the new axis", () => {
    const r = playing(3);
    for (let i = 0; i < 6; i++) {
      const axis = r.mover.axis;
      at(r, 0.1);
      drop(r);
      expect(r.mover.axis).toBe(axis === "x" ? "z" : "x");
      const t = top(r);
      const c = r.mover.axis === "x" ? t.x : t.z;
      expect(Math.abs(r.mover.pos - c)).toBeCloseTo(SPAN);
      // Heading towards the tower
      expect(Math.sign(c - r.mover.pos)).toBe(r.mover.dir);
    }
  });

  it("bounces between the two ends and never strays past them", () => {
    const r = playing(5);
    let turns = 0;
    let dir = r.mover.dir;
    for (let i = 0; i < 60 * 10; i++) {
      tick(r, 1 / 60);
      expect(Math.abs(r.mover.pos)).toBeLessThanOrEqual(SPAN + 1e-9);
      if (r.mover.dir !== dir) turns++;
      dir = r.mover.dir;
    }
    expect(turns).toBeGreaterThan(3);
    // Even a huge step stays in range
    tick(r, 7.3);
    expect(Math.abs(r.mover.pos)).toBeLessThanOrEqual(SPAN + 1e-9);
  });
});

describe("slicing", () => {
  it("cuts the overhang on the x axis, keeping the overlap", () => {
    const r = playing();
    at(r, 0.3);
    const d = drop(r);
    expect(d?.kind).toBe("place");
    if (d?.kind !== "place") return;
    expect(d.perfect).toBe(false);
    expect(d.box.w).toBeCloseTo(0.7);
    expect(d.box.x).toBeCloseTo(0.15);
    expect(d.box.d).toBe(BASE);
    expect(d.box.z).toBe(0);
    // The sliced piece spans from the pedestal's edge (0.5) to the slab's edge (0.8)
    expect(d.cut?.w).toBeCloseTo(0.3);
    expect(d.cut?.x).toBeCloseTo(0.65);
    expect(d.cut?.d).toBe(BASE);
    // Nothing is lost or made up
    expect(area(d.box) + area(d.cut as Box)).toBeCloseTo(BASE * BASE);
    expect(top(r)).toEqual(d.box);
    expect(r.score).toBe(1);
  });

  it("cuts on the z axis from the negative side too", () => {
    const r = playing();
    at(r, 0.2); // x: 0.8 wide, centred at 0.1
    drop(r);
    expect(r.mover.axis).toBe("z");
    at(r, -0.25);
    const d = drop(r);
    if (d?.kind !== "place") throw new Error("expected a place");
    expect(d.box.d).toBeCloseTo(0.75);
    expect(d.box.z).toBeCloseTo(-0.125);
    expect(d.box.w).toBeCloseTo(0.8);
    expect(d.box.x).toBeCloseTo(0.1);
    expect(d.cut?.d).toBeCloseTo(0.25);
    expect(d.cut?.z).toBeCloseTo(-0.625);
    expect(d.cut?.x).toBeCloseTo(0.1);
    // The kept part sits inside the slab below, the cut wholly outside it
    const below = r.stack[r.stack.length - 2];
    expect(d.box.z - d.box.d / 2).toBeCloseTo(below.z - below.d / 2);
    expect((d.cut?.z ?? 0) + (d.cut?.d ?? 0) / 2).toBeCloseTo(below.z - below.d / 2);
  });

  it("follows a shrinking tower: the next slab has the new size", () => {
    const r = playing();
    at(r, 0.4);
    drop(r);
    expect(moverBox(r).w).toBeCloseTo(0.6);
    expect(moverBox(r).x).toBeCloseTo(0.2);
  });

  it("a complete miss ends the run and the slab falls whole", () => {
    const r = playing();
    at(r, 0.4);
    drop(r);
    at(r, -1.01);
    const d = drop(r);
    expect(d?.kind).toBe("miss");
    expect(d?.box.d).toBe(BASE);
    expect(r.phase).toBe("over");
    expect(r.score).toBe(1);
    expect(r.stack).toHaveLength(2);
    expect(drop(r)).toBeNull();
  });

  it("a hairline overlap counts as a miss", () => {
    const r = playing();
    at(r, BASE - MIN_OVERLAP / 2);
    expect(drop(r)?.kind).toBe("miss");
  });
});

describe("perfect drops", () => {
  it("snap exactly within the tolerance, on either side", () => {
    for (const off of [PERFECT_TOL * 0.99, -PERFECT_TOL * 0.99, 0]) {
      const r = playing();
      at(r, off);
      const d = drop(r);
      if (d?.kind !== "place") throw new Error("expected a place");
      expect(d.perfect).toBe(true);
      expect(d.cut).toBeNull();
      expect(d.box).toEqual({ x: 0, z: 0, w: BASE, d: BASE });
    }
    const r = playing();
    at(r, PERFECT_TOL * 1.2);
    const d = drop(r);
    expect(d?.kind === "place" && d.perfect).toBe(false);
  });

  it("count a streak that a normal drop resets", () => {
    const r = playing();
    for (let i = 1; i <= 4; i++) {
      at(r, 0.01);
      const d = drop(r);
      expect(d?.kind === "place" && d.streak).toBe(i);
    }
    at(r, 0.2);
    drop(r);
    expect(r.streak).toBe(0);
    expect(r.bestStreak).toBe(4);
    expect(r.perfects).toBe(4);
  });

  it(`grow the slab back after ${GROW_STREAK} in a row, capped at the first slab's size`, () => {
    const r = playing();
    at(r, 0.3); // x: 0.7
    drop(r);
    at(r, 0.2); // z: 0.8
    drop(r);
    const widths: number[] = [];
    const grew: boolean[] = [];
    for (let i = 0; i < 16; i++) {
      at(r, 0);
      const d = drop(r);
      if (d?.kind !== "place") throw new Error("expected a place");
      widths.push(d.box.w);
      grew.push(d.grew);
    }
    // Perfect #1 and #2 keep the size; from #3 on, each grows along its own axis
    expect(grew.slice(0, GROW_STREAK - 1).every((g) => !g)).toBe(true);
    expect(grew[GROW_STREAK - 1]).toBe(true);
    const last = top(r);
    expect(last.w).toBe(BASE);
    expect(last.d).toBe(BASE);
    expect(Math.max(...widths)).toBeLessThanOrEqual(BASE);
    // Growth stops reporting once the cap is reached
    expect(grew.at(-1)).toBe(false);
    // And it grows by GROW per step on its axis (x perfects are every other drop here)
    expect(widths[GROW_STREAK - 1] - widths[0]).toBeCloseTo(GROW);
  });
});

describe("pace and colour", () => {
  it("speeds up gently with height, then levels off", () => {
    expect(speedFor(0)).toBe(SPEED_START);
    for (let n = 1; n < 200; n++) expect(speedFor(n)).toBeGreaterThanOrEqual(speedFor(n - 1));
    expect(speedFor(10) - speedFor(0)).toBeLessThan(0.5);
    expect(speedFor(1000)).toBe(SPEED_MAX);
    // The slab really moves faster up high
    const r = playing();
    const low = r.mover.pos;
    tick(r, 0.1);
    const lowStep = Math.abs(r.mover.pos - low);
    r.score = 60;
    const high = r.mover.pos;
    tick(r, 0.1);
    expect(Math.abs(r.mover.pos - high)).toBeGreaterThan(lowStep);
  });

  it("walks the hue around the wheel", () => {
    const r = createRun(9);
    for (let n = 0; n < 300; n++) {
      const h = hueFor(r, n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
    expect(hueFor(r, 1)).not.toBe(hueFor(r, 0));
  });

  it("a run is plain JSON", () => {
    const r = playing(11);
    at(r, 0.1);
    drop(r);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
