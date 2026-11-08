import { mulberry32, nextRandom } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { SAFE, TRACK, capturesAt, distinctMoves, legalMoves, legalTokens, loopIndex, rotate, squareOf, target } from "./board";
import { BASE, type Difficulty, HOME, LAST_TRACK, MAX_TIMEOUTS, TURN_SECONDS } from "./config";
import { type Input, type Match, clockLeft, createMatch, setAway, stepMatch } from "./logic";
import { coCaNguaOnline, parseAction, playersOf } from "./online";

/** A seed whose next roll is the dice `a` and `b`. */
function seedFor(a: number, b: number) {
  for (let s = 1; ; s++) {
    const st = { seed: s };
    if (1 + Math.floor(nextRandom(st) * 6) === a && 1 + Math.floor(nextRandom(st) * 6) === b) return s;
  }
}

/** Step until the phase changes (or `max` seconds pass). */
function until(m: Match, phase: Match["phase"], inputs: (Input | null)[] = [], max = 60) {
  for (let t = 0; t < max * 20 && m.phase !== phase; t++) stepMatch(m, 0.05, inputs);
  return m.phase === phase;
}

const offline = (humans: string[], total: number, level: Difficulty = "normal") =>
  createMatch(1, { humans, total, level, turnSeconds: 0 });

describe("the board", () => {
  it("has a 52-square loop of distinct squares, each next to the one before", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([x, y]) => `${x},${y}`)).size).toBe(52);
    for (let i = 0; i < 52; i++) {
      const [ax, ay] = TRACK[i];
      const [bx, by] = TRACK[(i + 1) % 52];
      // Neighbours, or the one diagonal step round each inner corner of the cross
      expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1);
    }
  });

  it("gives each colour its start a quarter turn on, and a home column into the middle", () => {
    for (let c = 0; c < 4; c++) {
      expect(squareOf(c, 0)).toEqual(rotate([6, 13], c));
      expect(squareOf(c, LAST_TRACK + 5)).toEqual(rotate([7, 9], c));
      expect(squareOf(c, HOME)).toBeNull();
      expect(squareOf(c, BASE)).toBeNull();
      // Its last loop square sits right below its home column
      expect(squareOf(c, LAST_TRACK)).toEqual(rotate([7, 14], c));
    }
    expect([...SAFE].map((i) => TRACK[i])).toContainEqual([2, 8]);
  });

  it("needs a six to leave base and the exact number to reach home", () => {
    expect(target(BASE, 5)).toBeNull();
    expect(target(BASE, 6)).toBe(0);
    expect(target(HOME - 3, 3)).toBe(HOME);
    expect(target(HOME - 3, 4)).toBeNull();
    expect(target(HOME, 1)).toBeNull();
    expect(legalTokens([BASE, BASE, 10, HOME], 4)).toEqual([2]);
    expect(distinctMoves([BASE, BASE, 10, 10], [0, 1, 2, 3])).toEqual([0, 2]);
  });

  it("captures on plain squares, never on safe ones", () => {
    // Red (corner 0) at progress 10; green (corner 1) lands on the same square from its side
    const greenPos = (loopIndex(0, 10) - 13 + 52) % 52;
    const players = [
      { corner: 0, tokens: [10, BASE, BASE, BASE] },
      { corner: 1, tokens: [greenPos - 3, BASE, BASE, BASE] },
    ];
    expect(capturesAt(players, 1, greenPos)).toEqual([{ player: 0, token: 0 }]);
    // Red on its start square is safe from everyone
    const onStart = [
      { corner: 0, tokens: [0, BASE, BASE, BASE] },
      { corner: 3, tokens: [(52 - 39) % 52, BASE, BASE, BASE] },
    ];
    expect(loopIndex(3, 13)).toBe(loopIndex(0, 0));
    expect(capturesAt(onStart, 1, 13)).toEqual([]);
    // A star square
    const star = (8 - 13 + 52) % 52;
    expect(capturesAt([{ corner: 0, tokens: [8, BASE, BASE, BASE] }, players[1]], 1, star)).toEqual([]);
  });
});

describe("using the two dice", () => {
  it("lists a move per die, and makes you use both when you can", () => {
    // 6 brings a horse out; the 2 can then move it, so every legal first move keeps the 2 playable
    expect(legalMoves([BASE, BASE, BASE, BASE], [6, 2], [false, false])).toEqual([0, 1, 2, 3].map((token) => ({ die: 0, token })));
    // A horse 3 from home with 2 and 3: no order plays both, so either die alone is allowed
    expect(legalMoves([HOME - 3, HOME, HOME, HOME], [2, 3], [false, false])).toEqual([{ die: 0, token: 0 }, { die: 1, token: 0 }]);
    // Horses at 10 and 54 with 4 and 2: the 4 can only go to the horse at 10; the 2 to either
    const m = legalMoves([10, HOME - 2, HOME, HOME], [4, 2], [false, false]);
    expect(m).toContainEqual({ die: 0, token: 0 });
    expect(m).toContainEqual({ die: 1, token: 1 });
    // Spending the 2 on the horse at 10 would still leave the 4 playable, so it's allowed too
    expect(m).toContainEqual({ die: 1, token: 0 });
    // Only the free die counts once one is spent
    expect(legalMoves([10, BASE, BASE, BASE], [4, 6], [true, false])).toEqual([0, 1, 2, 3].map((token) => ({ die: 1, token })));
  });

  it("forbids a first move that throws the other die away when both can be played", () => {
    // One horse out at 52 (4 from home), the rest in base, dice 4 and 6:
    // spending the 4 first sends it home and the 6 then brings a horse out — fine;
    // spending the 6 first brings one out and the 4 moves either — fine too
    expect(legalMoves([HOME - 4, BASE, BASE, BASE], [4, 6], [false, false])).toHaveLength(4);
    // A horse at 53 (3 from home) and dice 3 and 5: the 5 can't be used at all, the 3 must
    expect(legalMoves([HOME - 3, HOME, HOME, HOME], [3, 5], [false, false])).toEqual([{ die: 0, token: 0 }]);
  });
});

describe("a turn", () => {
  it("lets only the player whose turn it is roll, and doubles roll again", () => {
    const m = offline(["An", "Bình"], 2);
    m.turn = 0;
    m.seed = seedFor(6, 6);
    const roll: Input = { kind: "roll" };
    stepMatch(m, 0.05, [null, roll]);
    expect(m.phase).toBe("roll");
    stepMatch(m, 0.05, [roll, null]);
    expect(m.phase).toBe("rolling");
    expect(m.dice).toEqual([6, 6]);
    expect(until(m, "move")).toBe(true);
    // Either six brings a horse out
    expect(m.moves).toHaveLength(8);
    stepMatch(m, 0.01, [{ kind: "move", die: 1, token: 2 }, null]);
    expect(m.phase).toBe("moving");
    expect(m.used).toEqual([false, true]);
    expect(until(m, "move")).toBe(true);
    // The other six: bring out another or move the first on
    stepMatch(m, 0.01, [{ kind: "move", die: 1, token: 0 }, null]);
    expect(m.phase).toBe("move");
    stepMatch(m, 0.01, [{ kind: "move", die: 0, token: 2 }, null]);
    expect(m.players[0].tokens[2]).toBe(6);
    expect(until(m, "roll")).toBe(true);
    // Doubles: same player again
    expect(m.turn).toBe(0);
    expect(m.doubles).toBe(1);
  });

  it("plays a die on its own when it is the only sensible move, and loses an unplayable one", () => {
    const m = offline(["An", "Bình"], 2);
    m.turn = 0;
    m.players[0].tokens = [HOME - 3, HOME, HOME, BASE];
    m.seed = seedFor(3, 5);
    stepMatch(m, 0.05, [{ kind: "roll" }, null]);
    expect(until(m, "move")).toBe(true);
    expect(m.moves).toEqual([{ die: 0, token: 0 }]);
    const lost: number[] = [];
    for (let i = 0; i < 200 && m.turn === 0; i++) {
      stepMatch(m, 0.05, [null, null]);
      for (const e of m.events.splice(0)) if (e.type === "lost") lost.push(e.value);
    }
    expect(m.players[0].tokens[0]).toBe(HOME);
    expect(lost).toEqual([5]);
    expect(m.turn).toBe(1);
  });

  it("passes the turn when nothing can move, and loses it on three doubles", () => {
    const m = offline(["An", "Bình"], 2);
    m.turn = 0;
    m.seed = seedFor(3, 4);
    stepMatch(m, 0.05, [{ kind: "roll" }, null]);
    expect(until(m, "pass")).toBe(true);
    expect(m.passReason).toBe("none");
    expect(until(m, "roll")).toBe(true);
    expect(m.turn).toBe(1);

    const k = offline(["An", "Bình"], 2);
    k.turn = 0;
    k.doubles = 2;
    k.players[0].tokens = [5, BASE, BASE, BASE];
    k.seed = seedFor(2, 2);
    stepMatch(k, 0.05, [{ kind: "roll" }, null]);
    expect(until(k, "pass")).toBe(true);
    expect(k.passReason).toBe("three");
    expect(k.players[0].tokens[0]).toBe(5);
    expect(until(k, "roll")).toBe(true);
    expect(k.turn).toBe(1);
  });

  it("refuses an illegal move and sends a captured horse home", () => {
    const m = offline(["An", "Bình"], 2);
    // Red (corner 0) at 20; yellow (corner 2) four squares behind it on the loop
    const behind = (loopIndex(0, 20) - 26 - 4 + 52) % 52;
    m.players[0].tokens = [20, BASE, BASE, BASE];
    m.players[1].tokens = [behind, 30, BASE, BASE];
    m.turn = 1;
    m.phase = "move";
    m.dice = [4, 1];
    m.used = [false, false];
    m.moves = legalMoves(m.players[1].tokens, m.dice, m.used);
    stepMatch(m, 0.01, [null, { kind: "move", die: 0, token: 3 }]);
    expect(m.phase).toBe("move");
    stepMatch(m, 0.01, [null, { kind: "move", die: 0, token: 0 }]);
    expect(m.phase).toBe("moving");
    expect(m.players[0].tokens[0]).toBe(BASE);
    expect(m.anim?.captured).toEqual([{ player: 0, token: 0, from: 20 }]);
    expect(m.players[1].captures).toBe(1);
    // The 1 is still to play
    expect(until(m, "move")).toBe(true);
    expect(m.moves.every((x) => x.die === 1)).toBe(true);
  });

  it("ranks finishers and ends once every person is done", () => {
    const m = offline(["An"], 3);
    const me = m.players.findIndex((p) => p.seat === 0);
    m.players[me].tokens = [HOME, HOME, HOME, HOME - 2];
    m.turn = me;
    m.phase = "move";
    m.dice = [2, 5];
    m.used = [false, false];
    m.moves = legalMoves(m.players[me].tokens, m.dice, m.used);
    expect(until(m, "over")).toBe(true);
    expect(m.players[me].place).toBe(1);
    expect(m.players.map((p) => p.place).sort()).toEqual([1, 2, 3]);
  });
});

describe("the clock and the computer standing in", () => {
  it("rolls for a slow player online, and takes over after too many timeouts", () => {
    const m = createMatch(4, { humans: ["An", "Bình"], total: 2, level: "normal", turnSeconds: TURN_SECONDS });
    m.turn = 0;
    expect(clockLeft(m)).toBe(TURN_SECONDS);
    for (let i = 0; i < MAX_TIMEOUTS; i++) {
      // Wait out An's turn; Bình's turns are played by stepping too
      m.turn = 0;
      m.phase = "roll";
      m.t = 0;
      stepMatch(m, TURN_SECONDS + 0.1, [null, null]);
      expect(m.phase).toBe("rolling");
    }
    expect(m.players[0].idle).toBe(true);
    expect(clockLeft({ ...m, phase: "roll", turn: 0 })).toBeNull();
    // Any tap hands the seat back
    stepMatch(m, 0.01, [{ kind: "roll" }, null]);
    expect(m.players[0].idle).toBe(false);
  });

  it("plays a dropped player's seat until they return", () => {
    const m = createMatch(5, { humans: ["An", "Bình"], total: 2, level: "normal", turnSeconds: TURN_SECONDS });
    setAway(m, 1, true);
    m.turn = m.players.findIndex((p) => p.seat === 1);
    m.phase = "roll";
    m.t = 0;
    stepMatch(m, 1, [null, null]);
    expect(m.phase).toBe("rolling");
    setAway(m, 1, false);
    expect(m.players.find((p) => p.seat === 1)?.away).toBe(false);
  });
});

describe("the computer", () => {
  it("takes a capture when it has one (Normal and Hard)", () => {
    // Red token 0 can hit yellow 3 squares ahead with the 3; anything else just walks on
    const ahead = (loopIndex(0, 23) - 26 + 52) % 52;
    const players = [
      { corner: 0, tokens: [20, 5, BASE, BASE] },
      { corner: 2, tokens: [ahead, BASE, BASE, BASE] },
    ];
    // The 1 is already spent: the 3 should take the capture
    const dice = [3, 1];
    const used = [false, true];
    const moves = legalMoves(players[0].tokens, dice, used);
    for (const level of ["normal", "hard"] as Difficulty[]) expect(chooseMove(players, 0, dice, used, moves, level, mulberry32(1))).toEqual({ die: 0, token: 0 });
  });

  function play(seed: number, levels: Difficulty[]) {
    const m = createMatch(seed, { humans: [], total: levels.length, level: "easy", turnSeconds: 0, botLevels: levels });
    for (let n = 0; m.phase !== "over" && n < 50000; n++) {
      stepMatch(m, 2, []);
      m.events.length = 0;
    }
    return m;
  }

  it("ranks the levels: Hard and Normal beat Easy far more often than not", () => {
    // Measured over 600 games: Hard ~93%, Normal ~86% against Easy; Hard ~68% against Normal
    const N = 120;
    const wins = { hard: 0, normal: 0 };
    for (const level of ["hard", "normal"] as const) {
      for (let i = 0; i < N; i++) {
        // Each side gets both corners
        const m = play(i + 1, i % 2 ? [level, "easy"] : ["easy", level]);
        expect(m.phase).toBe("over");
        if (m.players.find((p) => p.level === level)?.place === 1) wins[level]++;
      }
    }
    expect(wins.hard / N).toBeGreaterThan(0.75);
    expect(wins.normal / N).toBeGreaterThan(0.75);
  });

  it("thinks fast enough for a phone (well under 100 ms a decision)", () => {
    const players = [0, 1, 2, 3].map((corner) => ({ corner, tokens: [corner * 7, corner * 9 + 3, BASE, 40 - corner] }));
    const t = performance.now();
    for (let i = 0; i < 100; i++) {
      const dice = [1 + (i % 6), 6];
      const moves = legalMoves(players[i % 4].tokens, dice, [false, false]);
      if (moves.length) chooseMove(players, i % 4, dice, [false, false], moves, "hard", mulberry32(i));
    }
    // 100 decisions
    expect(performance.now() - t).toBeLessThan(400);
  });
});

describe("online adapter", () => {
  it("accepts only a roll or a real token", () => {
    expect(parseAction([{ type: "roll" }])).toEqual({ kind: "roll" });
    expect(parseAction([{ type: "move", die: 1, token: 2 }])).toEqual({ kind: "move", die: 1, token: 2 });
    expect(parseAction([{ type: "move", token: 2 }])).toBeNull();
    expect(parseAction([{ type: "move", die: 2, token: 2 }])).toBeNull();
    expect(parseAction([{ type: "move", die: "0", token: 2 }])).toBeNull();
    expect(parseAction([{ type: "move", die: 0, token: 4 }])).toBeNull();
    expect(parseAction([{ type: "move", die: 0, token: "1" }])).toBeNull();
    expect(parseAction([{ type: "move", die: 0, token: 1.5 }])).toBeNull();
    expect(parseAction([null, "roll", { type: "nuke" }, { type: "move", die: 0, token: 0 }])).toEqual({ kind: "move", die: 0, token: 0 });
    expect(coCaNguaOnline.parseInput({ move: { x: 0, y: 0 }, actions: [] })).toBeNull();
  });

  it("seats the people and fills the table with the computer", () => {
    expect(playersOf({ players: "3" })).toBe(3);
    expect(playersOf({})).toBe(4);
    const sim = coCaNguaOnline.create(3, [{ name: "An" }, { name: "Bình" }], { players: "4" });
    const snap = sim.snapshot() as Match;
    expect(snap.players).toHaveLength(4);
    expect(snap.players.filter((p) => p.seat !== null).map((p) => p.name)).toEqual(["An", "Bình"]);
    // Two friends sit opposite each other
    const corners = snap.players.filter((p) => p.seat !== null).map((p) => p.corner);
    expect(Math.abs(corners[0] - corners[1])).toBe(2);
    // More people than the setting: everyone still gets a seat
    expect((coCaNguaOnline.create(3, [{ name: "A" }, { name: "B" }, { name: "C" }], { players: "2" }).snapshot() as Match).players).toHaveLength(3);
  });

  it("runs a whole match to an end with a result per seat", () => {
    const sim = coCaNguaOnline.create(5, [{ name: "An" }, { name: "Bình" }], { players: "3" });
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < 400000) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("over")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(results.filter((r) => r.outcome === "win").length).toBeLessThanOrEqual(1);
    for (const r of results) expect(r.detail.length).toBeLessThanOrEqual(40);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });
});
