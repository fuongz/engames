import { describe, expect, it } from "vitest";
import { BEAST_MAX, FIGHTERS, FINISH_WINDOW, FLOOR_Y, type FighterId, INTRO_FRAMES, moveSpec, ROUND_FRAMES } from "./config";
import { createBrain, cpuInput } from "./cpu";
import { BTN, type GameState, type Input, createGame, fingerprint, scoreOf, update } from "./logic";

type Ctrl = (s: GameState, frame: number) => Input;
const idle: Ctrl = () => 0;

function run(s: GameState, frames: number, p1: Ctrl = idle, p2: Ctrl = idle) {
  for (let i = 0; i < frames && s.phase !== "over"; i++) update(s, [p1(s, i), p2(s, i)]);
}

/** A fight that has started, with the fighters `gap` apart in mid-stage. */
function fight(gap = 70, a: FighterId = "ho", b: FighterId = "ho") {
  const s = createGame(a, b, 1);
  run(s, INTRO_FRAMES + 1);
  s.fighters[0].x = 480 - gap / 2;
  s.fighters[1].x = 480 + gap / 2;
  s.events.length = 0;
  return s;
}

/** Press a button on one frame, then let go. */
const tap = (bits: Input, at = 0, hold: Input = 0): Ctrl => (_s, f) => (f === at ? bits | hold : hold);
/** Press the steps of a motion, one per frame, then `button`. */
const sequence = (...steps: Input[]): Ctrl => (_s, f) => steps[f] ?? 0;

describe("hits and blocks", () => {
  it("a jab hits a standing opponent and stuns them", () => {
    const s = fight();
    const hp = s.fighters[1].hp;
    run(s, 8, tap(BTN.P));
    expect(s.fighters[1].hp).toBeLessThan(hp);
    expect(s.events.some((e) => e.type === "hit")).toBe(true);
  });

  it("holding back blocks a mid; a low needs a crouch; an overhead beats a crouch", () => {
    // Defender (side 1) faces left, so "back" is →
    const mid = fight();
    run(mid, 14, tap(BTN.K), () => BTN.R);
    expect(mid.fighters[1].hp).toBe(mid.fighters[1].maxHp);
    expect(mid.events.some((e) => e.type === "block")).toBe(true);

    const lowVsStand = fight();
    run(lowVsStand, 16, tap(BTN.K, 0, BTN.D), () => BTN.R);
    expect(lowVsStand.fighters[1].hp).toBeLessThan(lowVsStand.fighters[1].maxHp);

    const lowVsCrouch = fight();
    run(lowVsCrouch, 16, tap(BTN.K, 0, BTN.D), () => BTN.R | BTN.D);
    expect(lowVsCrouch.fighters[1].hp).toBe(lowVsCrouch.fighters[1].maxHp);

    // A jumping kick lands on a crouch-blocker
    const air = fight(140);
    // Kick on the way down, when the feet reach a crouching head
    run(air, 70, (_s, f) => (f < 2 ? BTN.U | BTN.R : f === 30 ? BTN.K : 0), () => BTN.R | BTN.D);
    expect(air.fighters[1].hp).toBeLessThan(air.fighters[1].maxHp);
  });

  it("a jab chains into another, and each extra hit in a combo deals less", () => {
    const s = fight();
    const hits: number[] = [];
    run(s, 40, (_s, f) => (f % 6 === 0 ? BTN.P : 0));
    for (const e of s.events) if (e.type === "hit") hits.push(e.damage);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[1]).toBeLessThan(hits[0]);
  });
});

describe("input buffer", () => {
  it("a press during hitstop still chains (the moment players press it)", () => {
    const s = fight();
    let pressedInHitstop = false;
    run(s, 40, (st, f) => {
      if (f === 0) return BTN.P;
      // One tap of Punch while the first jab's impact has the game frozen
      if (!pressedInHitstop && st.hitstop > 0) {
        pressedInHitstop = true;
        return BTN.P;
      }
      return 0;
    });
    expect(pressedInHitstop).toBe(true);
    expect(s.events.filter((e) => e.type === "hit").length).toBeGreaterThanOrEqual(2);
  });

  it("a press a few frames before recovery ends comes out as soon as the fighter is free", () => {
    const s = fight(300);
    const kick = moveSpec("ho", "kick");
    const total = kick.startup + kick.active + kick.recovery;
    // Whiffed kick, then Punch tapped 5 frames before the kick has recovered
    run(s, total + 6, (_s, f) => (f === 0 ? BTN.K : f === total - 5 ? BTN.P : 0));
    expect(s.fighters[0].move).toBe("jab");
  });

  it("an old press does not fire later", () => {
    const s = fight(300);
    const kick = moveSpec("ho", "kick");
    const total = kick.startup + kick.active + kick.recovery;
    run(s, total + 6, (_s, f) => (f === 0 ? BTN.K : f === 2 ? BTN.P : 0));
    expect(s.fighters[0].state).not.toBe("attack");
  });
});

describe("specials", () => {
  const startedMove = (s: GameState) => s.events.find((e) => e.type === "special");

  it("↓→ + P, →↓→ + P and ↓← + K start the three specials (facing right)", () => {
    const qcf = fight(300);
    run(qcf, 6, sequence(BTN.D, BTN.D | BTN.R, BTN.R, BTN.R | BTN.P));
    expect(startedMove(qcf)).toMatchObject({ move: "rush" });

    const dp = fight(300);
    run(dp, 6, sequence(BTN.R, BTN.D, BTN.D | BTN.R, BTN.D | BTN.R | BTN.P));
    expect(startedMove(dp)).toMatchObject({ move: "rising" });

    const qcb = fight(300);
    run(qcb, 6, sequence(BTN.D, BTN.D | BTN.L, BTN.L | BTN.K));
    expect(startedMove(qcb)).toMatchObject({ move: "third" });
  });

  it("the Special button picks a special by direction (the touch controls)", () => {
    for (const [hold, move] of [[0, "rush"], [BTN.R, "rising"], [BTN.L, "third"]] as const) {
      const s = fight(300);
      run(s, 3, tap(BTN.S, 0, hold));
      expect(startedMove(s)).toMatchObject({ move });
    }
  });

  it("the wolf's howl travels and hits from range", () => {
    const s = fight(400, "soi", "ho");
    run(s, 90, tap(BTN.S));
    expect(s.events.some((e) => e.type === "projectile")).toBe(true);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
  });

  it("a rising special is invulnerable at the start", () => {
    const s = fight(60);
    // Side 1 jabs on frame 0; side 0 answers with its rising special on the same frame
    run(s, 12, tap(BTN.S, 0, BTN.R), tap(BTN.P));
    expect(s.fighters[0].hp).toBe(s.fighters[0].maxHp);
  });
});

describe("beast form", () => {
  it("a full meter transforms, hits harder, and wears off", () => {
    const normal = fight();
    run(normal, 8, tap(BTN.P));
    const base = normal.fighters[1].maxHp - normal.fighters[1].hp;

    const beast = fight();
    beast.fighters[0].beast = BEAST_MAX;
    run(beast, 50, tap(BTN.B));
    expect(beast.fighters[0].beastLeft).toBeGreaterThan(0);
    beast.fighters[0].x = beast.fighters[1].x - 70;
    const before = beast.fighters[1].hp;
    run(beast, 8, tap(BTN.P));
    expect(before - beast.fighters[1].hp).toBeGreaterThan(base);
    run(beast, 700);
    expect(beast.fighters[0].beastLeft).toBe(0);
  });

  it("the Beast button in beast form throws the frenzy", () => {
    const s = fight(90);
    s.fighters[0].beastLeft = 300;
    run(s, 2, tap(BTN.B));
    expect(s.events.find((e) => e.type === "special")).toMatchObject({ move: "frenzy" });
  });
});

describe("rounds", () => {
  it("a K.O. starts the next round; two wins open the finisher window, ↓↓ + Beast performs it", () => {
    const s = fight();
    s.fighters[1].hp = 1;
    run(s, 10, tap(BTN.P));
    expect(s.phase).toBe("ko");
    run(s, 400);
    expect(s.round).toBe(2);
    expect(s.fighters[0].wins).toBe(1);

    run(s, INTRO_FRAMES + 2);
    s.fighters[0].x = 440;
    s.fighters[1].x = 510;
    s.fighters[1].hp = 1;
    run(s, 10, tap(BTN.P));
    expect(s.phase).toBe("finish");
    expect(s.matchWinner).toBe(0);
    while (s.hitstop > 0) update(s, [0, 0]);
    run(s, 20, (_s, f) => (f === 2 || f === 6 ? BTN.D : f === 10 ? BTN.B : 0));
    expect(s.phase).toBe("finisher");
    run(s, 200);
    expect(s.phase).toBe("over");
    expect(s.stats[0].finisher).toBe(true);
    expect(scoreOf(s, 0)).toBeGreaterThan(scoreOf(s, 1));
  });

  it("without the input, the finisher window closes on its own", () => {
    const s = fight();
    s.fighters[0].wins = 1;
    s.fighters[1].hp = 1;
    run(s, 10, tap(BTN.P));
    expect(s.phase).toBe("finish");
    run(s, FINISH_WINDOW + 40);
    expect(s.phase).toBe("over");
    expect(s.stats[0].finisher).toBe(false);
  });

  it("time up gives the round to whoever has more health left", () => {
    const s = fight(300);
    s.fighters[0].hp -= 100;
    run(s, ROUND_FRAMES + 2);
    expect(s.fighters[1].wins).toBe(1);
  });
});

describe("CPU", () => {
  function cpuMatch(a: FighterId, b: FighterId, da: 0 | 1 | 2, db: 0 | 1 | 2, seed: number) {
    const s = createGame(a, b, seed);
    const ba = createBrain(da, seed * 7 + 1);
    const bb = createBrain(db, seed * 13 + 5);
    let frames = 0;
    while (s.phase !== "over" && frames < 60 * 60 * 6) {
      update(s, [cpuInput(s, 0, ba), cpuInput(s, 1, bb)]);
      frames++;
    }
    return { s, frames };
  }

  it("a CPU fight replays exactly from the same seeds", () => {
    expect(fingerprint(cpuMatch("ho", "gau", 1, 1, 3).s)).toBe(fingerprint(cpuMatch("ho", "gau", 1, 1, 3).s));
  });

  it("every matchup finishes, and no fighter dominates (CPU vs CPU on Hard)", () => {
    const wins: Record<string, number> = {};
    let total = 0;
    for (const a of FIGHTERS)
      for (const b of FIGHTERS) {
        if (a === b) continue;
        for (let seed = 1; seed <= 6; seed++) {
          const { s, frames } = cpuMatch(a, b, 2, 2, seed);
          expect(s.phase, `${a} vs ${b} seed ${seed} after ${frames} frames`).toBe("over");
          const w = s.matchWinner === 0 ? a : b;
          wins[w] = (wins[w] ?? 0) + 1;
          total++;
        }
      }
    for (const f of FIGHTERS) {
      const share = (wins[f] ?? 0) / (total / 1.5);
      expect(share, `${f} won ${wins[f] ?? 0} of ${total / 1.5} fights: ${JSON.stringify(wins)}`).toBeGreaterThan(0.2);
      expect(share).toBeLessThan(0.8);
    }
  });

  it("Hard beats Easy most of the time", () => {
    let hard = 0;
    for (let seed = 1; seed <= 8; seed++) if (cpuMatch("ho", "ho", 2, 0, seed).s.matchWinner === 0) hard++;
    expect(hard).toBeGreaterThanOrEqual(6);
  });
});

describe("frame data", () => {
  it("every move has a hitbox or a projectile, and starts on the floor", () => {
    for (const f of FIGHTERS)
      for (const m of ["jab", "kick", "lowJab", "sweep", "airPunch", "airKick", "rush", "rising", "third", "frenzy"] as const) {
        const spec = moveSpec(f, m);
        expect(spec.box.w > 0 || spec.projectile !== undefined, `${f} ${m}`).toBe(true);
      }
    expect(createGame("ho", "soi").fighters.every((f) => f.y === FLOOR_Y)).toBe(true);
  });
});
