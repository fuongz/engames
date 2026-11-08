import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { DIFFICULTIES, type Difficulty, MAX_TIMEOUTS, QUAN_VALUE, TURN_SECONDS } from "./config";
import {
  type Game,
  type Seat,
  canMove,
  createMatch,
  finalPoints,
  legalMoves,
  matchScore,
  newGame,
  outcomeOf,
  play,
  pointsOf,
  setAway,
  stepMatch,
  stepsTime,
} from "./logic";
import { oAnQuanOnline, parseMove } from "./online";

/** A board from a pit list (pits 0..11) with both quan stones in place unless told otherwise. */
function board(dan: number[], opts: Partial<Game> = {}): Game {
  return { ...newGame(0), dan: dan.slice(), ...opts };
}

/** Every dân and quan is somewhere: on the board or captured. */
function conserved(g: Game) {
  const dan = g.dan.reduce((a, b) => a + b, 0) + g.caps[0] + g.caps[1];
  const quan = Number(g.quan[0]) + Number(g.quan[1]) + g.quans[0] + g.quans[1];
  return { dan, quan };
}

describe("a move", () => {
  it("starts with 5 dân in each of the ten pits and two quan", () => {
    const g = newGame();
    expect(g.dan).toEqual([0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5]);
    expect(legalMoves(g)).toHaveLength(10);
    expect(conserved(g)).toEqual({ dan: 50, quan: 2 });
  });

  it("only lets the side to move take from its own non-empty pits", () => {
    const g = newGame(0);
    expect(canMove(g, { pit: 3, dir: 1 })).toBe(true);
    expect(canMove(g, { pit: 8, dir: 1 })).toBe(false);
    expect(canMove(g, { pit: 0, dir: 1 })).toBe(false);
    expect(canMove(g, { pit: 3, dir: 2 as 1 })).toBe(false);
    g.dan[3] = 0;
    expect(canMove(g, { pit: 3, dir: -1 })).toBe(false);
    expect(play(g, { pit: 3, dir: -1 })).toBeNull();
  });

  it("stops when the next pit is a quan pit with stones in it", () => {
    // Pit 4 holds 1: it lands in 5, and 6 (the right quan) is next
    const g = board([0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0]);
    const steps = play(g, { pit: 4, dir: 1 });
    expect(steps?.at(-1)).toEqual({ k: "stop", why: "quan" });
    expect(g.dan[5]).toBe(1);
    expect(g.turn).toBe(1);
  });

  it("relays: lands before a full dân pit, picks it up and keeps sowing", () => {
    // 1 from pit 2 → pit 3; pit 4 has 2 → take, sow 5 and 6; pit 7 is next with 1 → take, sow into 8; 9 empty, 10 full → capture 10; 11 full → stop
    const g = board([0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 4, 1]);
    const steps = play(g, { pit: 2, dir: 1 }) ?? [];
    expect(steps.filter((s) => s.k === "take").map((s) => (s as { pit: number }).pit)).toEqual([2, 4, 7]);
    expect(steps.find((s) => s.k === "capture")).toEqual({ k: "capture", pit: 10, seat: 0, dan: 4, quan: false });
    expect(g.caps[0]).toBe(4);
    expect(conserved(g).dan).toBe(9);
  });

  it("captures a chain of 'empty, then full' and stops at two empties", () => {
    // 1 → pit 2; 3 empty, 4 full (captured); 5 empty, 6 the quan pit (captured: the quan and 2 dân); 7, 8 empty → stop
    const g = board([0, 1, 0, 0, 3, 0, 2, 0, 0, 0, 0, 1]);
    const steps = play(g, { pit: 1, dir: 1 }) ?? [];
    const caps = steps.filter((s) => s.k === "capture");
    expect(caps.map((s) => (s as { pit: number }).pit)).toEqual([4, 6]);
    expect(g.caps[0]).toBe(5);
    expect(g.quans[0]).toBe(1);
    expect(g.quan).toEqual([true, false]);
    expect(pointsOf(g, 0)).toBe(5 + QUAN_VALUE);
  });

  it("goes round the other way too, and a top-row move sows its own way", () => {
    const g = board([0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0], { turn: 1 });
    // Pit 8 leftwards on the ring (-1): 7, 6 (quan pit gets a dân)
    play(g, { pit: 8, dir: -1 });
    expect(g.dan[7]).toBe(1);
    expect(g.dan[6]).toBe(1);
  });

  it("never captures a young quan when the rule is on", () => {
    // 3 → 4; 5 is empty and 6 is the quan pit with only 3 dân: too young
    const g = board([0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 1], { quanNon: true });
    const steps = play(g, { pit: 3, dir: 1 }) ?? [];
    expect(steps.at(-1)).toEqual({ k: "stop", why: "young" });
    expect(g.quan[1]).toBe(true);
    // The same with 5 dân in it is fair game
    const ripe = board([0, 0, 0, 1, 0, 0, 5, 0, 0, 0, 0, 1], { quanNon: true });
    play(ripe, { pit: 3, dir: 1 });
    expect(ripe.quans[0]).toBe(1);
    expect(ripe.caps[0]).toBe(5);
  });
});

describe("refill and the end", () => {
  it("puts one dân back in each pit of an empty row, from captures", () => {
    // Seat 0 plays its last dân; seat 1's row is empty and it has captured 7
    const g = board([3, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0], { caps: [0, 7] });
    const steps = play(g, { pit: 5, dir: -1 }) ?? [];
    expect(steps.find((s) => s.k === "refill")).toEqual({ k: "refill", seat: 1, own: 5, borrowed: 0 });
    expect(g.dan.slice(7)).toEqual([1, 1, 1, 1, 1]);
    expect(g.caps[1]).toBe(2);
    expect(g.turn).toBe(1);
  });

  it("borrows from the other side when short, and the debt is repaid in the points", () => {
    const g = board([3, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0], { caps: [8, 2] });
    const steps = play(g, { pit: 5, dir: -1 }) ?? [];
    expect(steps.find((s) => s.k === "refill")).toEqual({ k: "refill", seat: 1, own: 2, borrowed: 3 });
    expect(g.debt[1]).toBe(3);
    expect(g.caps[0]).toBe(5);
    // Lending costs nothing: seat 0 still counts the 3 it lent
    expect(pointsOf(g, 0)).toBe(8);
    expect(pointsOf(g, 1)).toBe(-3);
  });

  it("ends when both quan pits are empty: each side keeps its own row", () => {
    // The left quan is gone already. 3 → 4; 5 is empty, so the right quan is captured; 7, 8 empty → stop
    const g = board([0, 0, 4, 1, 0, 0, 0, 0, 0, 0, 2, 0], { quan: [false, true], quans: [1, 0] });
    const steps = play(g, { pit: 3, dir: 1 }) ?? [];
    expect(g.over).toBe(true);
    expect(steps.filter((s) => s.k === "sweep")).toEqual([
      { k: "sweep", seat: 0, dan: 5 },
      { k: "sweep", seat: 1, dan: 2 },
    ]);
    expect(finalPoints(g)).toEqual([2 * QUAN_VALUE + 5, 2]);
    expect(g.winner).toBe(0);
    expect(steps.at(-1)).toEqual({ k: "end", winner: 0 });
  });
});

describe("whole games", () => {
  /** Plays a game out with two computer players; checks the books balance after every move. */
  function playOut(seed: number, a: Difficulty, b: Difficulty, quanNon = false) {
    const rand = mulberry32(seed);
    const g = newGame((seed % 2) as Seat, quanNon);
    let moves = 0;
    while (!g.over && moves < 1000) {
      const m = chooseMove(g, g.turn === 0 ? a : b, rand);
      expect(m).not.toBeNull();
      if (!m) break;
      const steps = play(g, m);
      expect(steps).not.toBeNull();
      expect(stepsTime(steps ?? [])).toBeGreaterThan(0);
      const c = conserved(g);
      expect(c.quan).toBe(2);
      expect(c.dan).toBe(50);
      moves++;
    }
    expect(g.over).toBe(true);
    const [p0, p1] = finalPoints(g);
    expect(p0 + p1).toBeLessThanOrEqual(50 + 2 * QUAN_VALUE);
    return g;
  }

  it("always reaches an end, with every stone accounted for", () => {
    for (let seed = 1; seed <= 40; seed++) playOut(seed, "easy", "easy", seed % 3 === 0);
  });

  it("Hard beats Easy most of the time", () => {
    let wins = 0;
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const hardSeat = (seed % 2) as Seat;
      const g = playOut(seed * 7, hardSeat === 0 ? "hard" : "easy", hardSeat === 0 ? "easy" : "hard");
      if (g.winner === hardSeat) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(N * 0.75);
  });

  it("thinks fast enough on every level", () => {
    const rand = mulberry32(5);
    for (const level of DIFFICULTIES) {
      const g = newGame(0);
      const t0 = performance.now();
      for (let i = 0; i < 6 && !g.over; i++) {
        const m = chooseMove(g, level, rand);
        if (m) play(g, m);
      }
      expect((performance.now() - t0) / 6).toBeLessThan(400);
    }
  });
});

describe("online match", () => {
  const idle = [null, null];

  it("parses only well-formed moves", () => {
    expect(parseMove([{ type: "sow", pit: 3, dir: 1 }])).toEqual({ pit: 3, dir: 1 });
    expect(parseMove([{ type: "sow", pit: 3, dir: 0 }])).toBeNull();
    expect(parseMove([{ type: "sow", pit: 12, dir: 1 }])).toBeNull();
    expect(parseMove([{ type: "sow", pit: 2.5, dir: -1 }])).toBeNull();
    expect(parseMove(["x", null, { type: "nuke" }])).toBeNull();
  });

  it("plays the mover's input, ignores the other seat, and resets the clock", () => {
    const m = createMatch(1, ["An", "Bình"], 1);
    stepMatch(m, 0.1, [null, { pit: 8, dir: 1 }]);
    expect(m.game.plies).toBe(0);
    stepMatch(m, 0.1, [{ pit: 3, dir: 1 }, null]);
    expect(m.game.plies).toBe(1);
    expect(m.game.turn).toBe(1);
    expect(m.clock).toBeGreaterThan(TURN_SECONDS);
    expect(m.events.some((e) => e.type === "move")).toBe(true);
  });

  it("forfeits after three timeouts in a row", () => {
    const m = createMatch(2, ["An", "Bình"], 3);
    let guard = 0;
    while (m.phase !== "over" && guard++ < 100_000) {
      // Seat 1 always answers at once; seat 0 never does
      const mv = m.game.turn === 1 ? chooseMove(m.game, "easy", mulberry32(guard)) : null;
      stepMatch(m, 0.5, [null, mv]);
    }
    expect(m.phase).toBe("over");
    expect(m.forfeit).toBe(true);
    expect(m.winner).toBe(1);
    expect(m.seats[0].timeouts).toBe(MAX_TIMEOUTS);
    expect(outcomeOf(m, 1)).toBe("win");
  });

  it("forfeits a player who stays away", () => {
    const m = createMatch(3, ["An", "Bình"], 1);
    setAway(m, 1, true);
    for (let i = 0; i < 400 && m.phase !== "over"; i++) stepMatch(m, 0.1, idle);
    expect(m.winner).toBe(0);
    expect(m.forfeit).toBe(true);
  });

  it("runs a whole best-of-3 through the room adapter", () => {
    const sim = oAnQuanOnline.create(9, [{ name: "An" }, { name: "Bình" }], { bestOf: "3", quanNon: "forbid" });
    const snap = () => sim.snapshot() as ReturnType<typeof createMatch>;
    expect(snap().quanNon).toBe(true);
    const rand = mulberry32(4);
    let ticks = 0;
    const kinds = new Set<string>();
    while (!sim.over && ticks++ < 200_000) {
      const s = snap();
      const mv = s.phase === "play" ? chooseMove(s.game, "normal", rand) : null;
      sim.step(s.game.turn === 0 ? [mv, null] : [null, mv]);
      for (const e of sim.drainEvents() as { type: string }[]) kinds.add(e.type);
    }
    expect(sim.over).toBe(true);
    expect(kinds).toEqual(new Set(["game", "move", "over"]));
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    const final = snap();
    expect(final.seats.some((x) => x.wins >= 2) || final.winner === null).toBe(true);
    for (const r of results) expect(r.score).toBe(matchScore(final, r.seat));
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});
