import { describe, expect, it } from "vitest";
import { createKnifeEffects } from "./effects";
import { createRun } from "./logic";

/** Canvas API probe, not a browser: catches invalid coordinates and unbounded decorative work. */
function probe() {
  let operations = 0;
  let strokes = 0;
  const values: Record<string, unknown> = { globalAlpha: 1 };
  const context = new Proxy(values, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        if (key !== "save" && key !== "restore") operations++;
        if (key === "stroke") strokes++;
        for (const v of args)
          if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
        if (key === "createLinearGradient") return { addColorStop() {} };
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, operations: () => operations, strokes: () => strokes };
}

describe("Storm Dragon visual budget", () => {
  it("keeps rapid-shot effects bounded and expires every transient effect", () => {
    const effects = createKnifeEffects();
    const run = createRun(1, 2);
    for (let i = 0; i < 1000; i++) {
      const seat = i % 2;
      effects.event({ type: "throw", seat, skin: "dragon" }, run, false);
      effects.event(
        {
          type: "hit",
          seat,
          skin: "dragon",
          angle: Math.PI / 2 - run.angle,
          stage: 1,
        },
        run,
        false,
      );
    }
    const busy = probe();
    effects.draw(busy.context, {}, false);
    expect(busy.operations()).toBeGreaterThan(0);
    // Thousands of input events cannot turn into thousands of live wakes or seals.
    expect(busy.operations()).toBeLessThan(4000);
    effects.update(1);
    const idle = probe();
    effects.draw(idle.context, {}, false);
    expect(idle.operations()).toBe(0);
    expect(effects.hasFlight()).toBe(false);
  });
  it("reduced motion keeps fading hit marks without lightning or rings", () => {
    const effects = createKnifeEffects();
    const run = createRun(1);
    effects.event({ type: "throw", seat: 0, skin: "dragon" }, run, true);
    effects.event(
      { type: "hit", seat: 0, skin: "dragon", angle: 0 },
      run,
      true,
    );
    const p = probe();
    effects.draw(p.context, {}, true);
    expect(p.strokes()).toBe(0);
    expect(p.operations()).toBeGreaterThan(0);
  });
});
