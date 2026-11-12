import { describe, expect, it } from "vitest";
import { COLLISION_ANGLE, FLIGHT_TIME } from "./config";
import { createRun, distance, step, wrap } from "./logic";

describe("Knife Bloom rules", () => {
  it("keeps a knife in flight before awarding a hit and limits rapid taps", () => {
    const s = createRun(4);
    step(s, 1 / 60, [true]);
    expect(s.score).toBe(0);
    expect(s.flights).toHaveLength(1);
    for (let i = 0; i < 1; i++) step(s, 1 / 60, [true]);
    expect(s.flights).toHaveLength(1);
    for (let i = 0; i < 5; i++) step(s, 1 / 60);
    expect(s.score).toBe(10);
    expect(s.hits).toEqual([1, 0]);
  });
  it("accepts rapid throws within 100 ms offline and online", () => {
    for (const dt of [1 / 60, 1 / 30]) {
      const s = createRun(4);
      step(s, dt, [true]);
      // A second tap 100 ms later must launch, rather than disappear into cooldown.
      for (let i = 1; i < Math.round(0.1 / dt); i++) step(s, dt);
      expect(s.hits[0]).toBe(1);
      step(s, dt, [true]);
      expect(s.flights).toHaveLength(1);
      for (let i = 0; i < Math.ceil(FLIGHT_TIME / dt); i++) step(s, dt);
      expect(s.hits[0] + 3 - s.lives).toBe(2);
    }
  });
  it("makes simultaneous partners collide and spends a shared life, not another knife", () => {
    const s = createRun(4, 2);
    step(s, 1 / 60, [true, true]);
    for (let i = 0; i < 15; i++) step(s, 1 / 60);
    expect(s.score).toBe(10);
    expect(s.lives).toBe(2);
    expect(s.remaining).toBe(4);
    expect(s.hits).toEqual([1, 0]);
  });
  it("ends after three collisions and emits the end once", () => {
    const s = createRun(4);
    s.knives = Array.from({ length: 100 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 100,
      seat: -1,
    }));
    let ends = 0;
    for (let i = 0; i < 180; i++)
      ends += step(s, 1 / 60, [true]).filter((e) => e.type === "over").length;
    expect(s.lives).toBe(0);
    expect(s.phase).toBe("over");
    expect(ends).toBe(1);
    expect(s.score).toBe(0);
  });
  it("cosmetic skins cannot change timing, collisions, score or lives", () => {
    const classic = createRun(17, 2);
    const dragon = createRun(17, 2);
    for (let i = 0; i < 900; i++) {
      const taps = [i % 11 === 0, i % 17 === 0];
      step(
        classic,
        1 / 60,
        taps.map((tap) => (tap ? { skin: "classic" } : null)),
      );
      step(
        dragon,
        1 / 60,
        taps.map((tap) => (tap ? { skin: "dragon" } : null)),
      );
      expect([
        classic.score,
        classic.lives,
        classic.remaining,
        classic.stage,
        classic.phase,
      ]).toEqual([
        dragon.score,
        dragon.lives,
        dragon.remaining,
        dragon.stage,
        dragon.phase,
      ]);
    }
  });
  it("expires an idle run rather than keeping a room alive forever", () => {
    const s = createRun(10, 2);
    for (let i = 0; i < 5500; i++) step(s, 1 / 30);
    expect(s.phase).toBe("over");
    expect(s.won).toBe(false);
  });
  it("can clear every stage without unavoidable collisions for several seeds and tick rates", () => {
    for (const dt of [1 / 60, 1 / 30])
      for (const seed of [1, 7, 91]) {
        const s = createRun(seed, 2);
        let throws = 0;
        while (s.phase !== "over") {
          let fire = false;
          if (
            !s.flights.length &&
            s.transition <= 0 &&
            s.cooldowns.every((t) => t <= 0)
          ) {
            const future = structuredClone(s);
            const seat = throws % 2;
            // Forecast the impact using the same fixed simulation, including one new shot.
            step(future, dt, seat === 0 ? [true, false] : [false, true]);
            for (let i = 1; i < Math.ceil(FLIGHT_TIME / dt); i++)
              step(future, dt);
            const arrival = wrap(Math.PI / 2 - future.angle);
            fire = s.knives.every(
              (k) => distance(k.angle, arrival) > COLLISION_ANGLE + 0.05,
            );
          }
          const seat = throws % 2;
          step(s, dt, fire ? (seat === 0 ? [true, false] : [false, true]) : []);
          if (fire) throws++;
        }
        expect(s.won, `seed ${seed}, dt ${dt}, stage ${s.stage}`).toBe(true);
        expect(s.lives).toBe(3);
        expect(s.hits[0]).toBeGreaterThan(0);
        expect(s.hits[1]).toBeGreaterThan(0);
      }
  });
});
