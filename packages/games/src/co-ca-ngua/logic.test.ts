import { mulberry32, nextRandom } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { TRACK, capturesAt, destination, distinctOptions, isBonusRoll, legalMoves, loopIndex, rotate, squareOf } from "./board";
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

/** Yellow's (corner 2) progress that stands on red's (corner 0) progress `pos`. */
const yellowOn = (pos: number) => (loopIndex(0, pos) - 26 + 52) % 52;

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
  });
});

describe("the rules of a move", () => {
  const red = (tokens: number[], yellow: number[] = [BASE, BASE, BASE, BASE]) => [
    { corner: 0, tokens },
    { corner: 2, tokens: yellow },
  ];

  it("counts doubles and 1-6 as bonus rolls", () => {
    for (const d of [[1, 1], [3, 3], [6, 6], [1, 6], [6, 1]]) expect(isBonusRoll(d)).toBe(true);
    for (const d of [[6, 2], [2, 3], [5, 1], [0, 0]]) expect(isBonusRoll(d)).toBe(false);
  });

  it("brings a horse out only on a bonus roll, onto a start square its own horses don't hold", () => {
    expect(destination(red([BASE, BASE, BASE, BASE]), 0, 0, [3, 3])).toBe(0);
    expect(destination(red([BASE, BASE, BASE, BASE]), 0, 0, [1, 6])).toBe(0);
    // A six alone isn't enough
    expect(destination(red([BASE, BASE, BASE, BASE]), 0, 0, [6, 2])).toBeNull();
    expect(destination(red([0, BASE, BASE, BASE]), 0, 1, [2, 2])).toBeNull();
    // A rival on the start square is knocked off
    const players = red([BASE, BASE, BASE, BASE], [yellowOn(0), BASE, BASE, BASE]);
    expect(destination(players, 0, 0, [5, 5])).toBe(0);
    expect(capturesAt(players, 0, 0)).toEqual([{ player: 1, token: 0 }]);
  });

  it("moves one horse the total of both dice", () => {
    expect(destination(red([10, BASE, BASE, BASE]), 0, 0, [2, 3])).toBe(15);
    expect(legalMoves(red([10, 20, BASE, BASE]), 0, [2, 3])).toEqual([{ token: 0 }, { token: 1 }]);
    // On a bonus roll a horse in base may come out, or another walk the total
    expect(legalMoves(red([10, BASE, BASE, BASE]), 0, [4, 4])).toEqual([0, 1, 2, 3].map((token) => ({ token })));
    expect(distinctOptions([10, BASE, BASE, BASE], legalMoves(red([10, BASE, BASE, BASE]), 0, [4, 4]))).toEqual([{ token: 0 }, { token: 1 }]);
  });

  it("never jumps a horse: a rival ahead stops it short, landing on it captures", () => {
    const players = red([10, BASE, BASE, BASE], [yellowOn(14), BASE, BASE, BASE]);
    expect(destination(players, 0, 0, [1, 2])).toBe(13);
    expect(destination(players, 0, 0, [2, 2])).toBe(14);
    expect(capturesAt(players, 0, 14)).toEqual([{ player: 1, token: 0 }]);
    expect(destination(players, 0, 0, [2, 3])).toBeNull();
    expect(destination(players, 0, 0, [6, 6])).toBeNull();
  });

  it("doesn't jump or land on its own horses either", () => {
    const players = red([10, 14, BASE, BASE]);
    expect(destination(players, 0, 0, [1, 2])).toBe(13);
    expect(destination(players, 0, 0, [2, 2])).toBeNull();
    expect(destination(players, 0, 0, [3, 3])).toBeNull();
    // Up the home column too
    expect(destination(red([LAST_TRACK + 1, LAST_TRACK + 3, BASE, BASE]), 0, 0, [2, 3])).toBeNull();
  });

  it("has no safe squares on the loop, and reaches home with the number or more", () => {
    // Red on its own start square can be hit
    const players = red([0, BASE, BASE, BASE], [yellowOn(0) - 4, BASE, BASE, BASE]);
    expect(destination(players, 1, 0, [1, 3])).toBe(yellowOn(0));
    expect(capturesAt(players, 1, yellowOn(0))).toEqual([{ player: 0, token: 0 }]);
    // One square short is never stuck: two dice make at least 2
    expect(destination(red([HOME - 1, BASE, BASE, BASE]), 0, 0, [1, 1])).toBe(HOME);
    expect(destination(red([HOME - 3, BASE, BASE, BASE]), 0, 0, [6, 5])).toBe(HOME);
    expect(destination(red([HOME, BASE, BASE, BASE]), 0, 0, [1, 1])).toBeNull();
    // Home isn't a square: everyone fits
    expect(destination(red([HOME - 2, HOME, HOME, HOME]), 0, 0, [1, 1])).toBe(HOME);
  });
});

describe("a turn", () => {
  it("lets only the player whose turn it is roll; a bonus roll brings a horse out and rolls again", () => {
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
    // Any of the four can come out
    expect(m.moves).toHaveLength(4);
    stepMatch(m, 0.01, [{ kind: "move", token: 2 }, null]);
    expect(m.phase).toBe("moving");
    expect(m.players[0].tokens).toEqual([BASE, BASE, 0, BASE]);
    expect(until(m, "roll")).toBe(true);
    // Same player again
    expect(m.turn).toBe(0);
    expect(m.bonus).toBe(1);
  });

  it("lets a bonus roll walk a horse already out instead", () => {
    const m = offline(["An", "Bình"], 2);
    m.turn = 0;
    m.players[0].tokens = [10, BASE, BASE, BASE];
    m.seed = seedFor(1, 6);
    stepMatch(m, 0.05, [{ kind: "roll" }, null]);
    expect(until(m, "move")).toBe(true);
    stepMatch(m, 0.01, [{ kind: "move", token: 0 }, null]);
    expect(m.players[0].tokens).toEqual([17, BASE, BASE, BASE]);
    expect(until(m, "roll")).toBe(true);
    expect(m.turn).toBe(0);
  });

  it("plays the only sensible move on its own, then hands over", () => {
    const m = offline(["An", "Bình"], 2);
    m.turn = 0;
    m.players[0].tokens = [10, BASE, BASE, BASE];
    m.seed = seedFor(3, 5);
    stepMatch(m, 0.05, [{ kind: "roll" }, null]);
    expect(until(m, "move")).toBe(true);
    expect(m.moves).toEqual([{ token: 0 }]);
    expect(until(m, "roll")).toBe(true);
    expect(m.players[0].tokens[0]).toBe(18);
    expect(m.turn).toBe(1);
  });

  it("passes the turn when nothing can move, and loses it on a third bonus roll", () => {
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
    k.bonus = 2;
    k.players[0].tokens = [5, BASE, BASE, BASE];
    k.seed = seedFor(2, 2);
    stepMatch(k, 0.05, [{ kind: "roll" }, null]);
    expect(until(k, "pass")).toBe(true);
    expect(k.passReason).toBe("three");
    expect(k.players[0].tokens[0]).toBe(5);
    expect(until(k, "roll")).toBe(true);
    expect(k.turn).toBe(1);
  });

  it("still rolls again after a bonus roll that couldn't be played", () => {
    const m = offline(["An", "Bình"], 2);
    const red = m.players.findIndex((p) => p.corner === 0);
    m.turn = red;
    // Red's horse on its start square, a yellow one right in front: 1-1 can neither walk nor bring one out
    m.players[red].tokens = [0, BASE, BASE, BASE];
    m.players[1 - red].tokens = [yellowOn(1), BASE, BASE, BASE];
    m.seed = seedFor(1, 1);
    const inputs = red === 0 ? [{ kind: "roll" } as Input, null] : [null, { kind: "roll" } as Input];
    stepMatch(m, 0.05, inputs);
    expect(until(m, "pass")).toBe(true);
    expect(m.passReason).toBe("none");
    expect(until(m, "roll")).toBe(true);
    expect(m.turn).toBe(red);
  });

  it("refuses an illegal move and sends a captured horse home", () => {
    const m = offline(["An", "Bình"], 2);
    // Red (corner 0) at 20; yellow (corner 2) four squares behind it on the loop
    m.players[0].tokens = [20, BASE, BASE, BASE];
    m.players[1].tokens = [yellowOn(16), 30, BASE, BASE];
    m.turn = 1;
    m.phase = "move";
    m.dice = [1, 3];
    m.moves = legalMoves(m.players, 1, m.dice);
    // A horse in base can't come out on 1-3
    stepMatch(m, 0.01, [null, { kind: "move", token: 3 }]);
    expect(m.phase).toBe("move");
    stepMatch(m, 0.01, [null, { kind: "move", token: 0 }]);
    expect(m.phase).toBe("moving");
    expect(m.players[0].tokens[0]).toBe(BASE);
    expect(m.anim?.captured).toEqual([{ player: 0, token: 0, from: 20 }]);
    expect(m.players[1].captures).toBe(1);
    // That was the whole roll
    expect(until(m, "roll")).toBe(true);
    expect(m.turn).toBe(0);
  });

  it("ranks finishers and ends once every person is done", () => {
    const m = offline(["An"], 3);
    const me = m.players.findIndex((p) => p.seat === 0);
    m.players[me].tokens = [HOME, HOME, HOME, HOME - 2];
    m.turn = me;
    m.phase = "move";
    m.dice = [2, 5];
    m.moves = legalMoves(m.players, me, m.dice);
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
    // Red's horse at 20 can hit yellow 3 squares ahead with 1-2; the other just walks on
    const players = [
      { corner: 0, tokens: [20, 5, BASE, BASE] },
      { corner: 2, tokens: [yellowOn(23), BASE, BASE, BASE] },
    ];
    const dice = [1, 2];
    const moves = legalMoves(players, 0, dice);
    for (const level of ["normal", "hard"] as Difficulty[]) expect(chooseMove(players, 0, dice, moves, level, mulberry32(1))).toEqual({ token: 0 });
  });

  function play(seed: number, levels: Difficulty[]) {
    const m = createMatch(seed, { humans: [], total: levels.length, level: "easy", turnSeconds: 0, botLevels: levels });
    for (let n = 0; m.phase !== "over" && n < 50000; n++) {
      stepMatch(m, 2, []);
      m.events.length = 0;
    }
    return m;
  }

  it("ranks the levels: Hard and Normal beat Easy clearly more often than not", () => {
    // Measured over 1000 games: Hard ~76%, Normal ~70% against Easy; Hard ~55% against Normal.
    // One decision a roll (the total on one horse) leaves less room for skill than two dice spent apart

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
    expect(wins.hard / N).toBeGreaterThan(0.65);
    expect(wins.normal / N).toBeGreaterThan(0.62);
  });

  it("thinks fast enough for a phone (well under 100 ms a decision)", () => {
    const players = [0, 1, 2, 3].map((corner) => ({ corner, tokens: [corner * 7, corner * 9 + 3, BASE, 40 - corner] }));
    const t = performance.now();
    for (let i = 0; i < 100; i++) {
      const dice = [1 + (i % 6), 6];
      const moves = legalMoves(players, i % 4, dice);
      if (moves.length) chooseMove(players, i % 4, dice, moves, "hard", mulberry32(i));
    }
    // 100 decisions
    expect(performance.now() - t).toBeLessThan(400);
  });
});

describe("online adapter", () => {
  it("accepts only a roll or a real token", () => {
    expect(parseAction([{ type: "roll" }])).toEqual({ kind: "roll" });
    expect(parseAction([{ type: "move", token: 2 }])).toEqual({ kind: "move", token: 2 });
    // An old client's die is ignored: the horse takes the whole roll
    expect(parseAction([{ type: "move", die: 1, token: 2 }])).toEqual({ kind: "move", token: 2 });
    expect(parseAction([{ type: "move" }])).toBeNull();
    expect(parseAction([{ type: "move", token: 4 }])).toBeNull();
    expect(parseAction([{ type: "move", token: "1" }])).toBeNull();
    expect(parseAction([{ type: "move", token: 1.5 }])).toBeNull();
    expect(parseAction([null, "roll", { type: "nuke" }, { type: "move", token: 0 }])).toEqual({ kind: "move", token: 0 });
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
