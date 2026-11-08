import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove, evaluate } from "./ai";
import { AWAY_SECONDS, type Difficulty } from "./config";
import {
  BLACK,
  type Game,
  QUEEN,
  START_FEN,
  WHITE,
  createMatch,
  fromFen,
  insufficient,
  legalMoves,
  mFrom,
  mPromo,
  mTo,
  matchScore,
  newGame,
  perft,
  playMove,
  posKey,
  replay,
  san,
  setAway,
  sqName,
  sqOf,
  stepMatch,
  takeBack,
  targetsFrom,
  toFen,
} from "./logic";
import { coVuaOnline, parseAction, snapshotOf } from "./online";

const fenGame = (fen: string): Game => {
  const pos = fromFen(fen);
  return { pos, history: [], san: [], keys: [posKey(pos)], last: null, result: null };
};
/** Play "e2e4 e7e5 ..." (a fifth letter promotes: q r b n). */
const play = (g: Game, moves: string) => {
  for (const m of moves.split(" ").filter(Boolean)) {
    const promo = m[4] ? " pnbrqk".indexOf(m[4]) : QUEEN;
    expect(playMove(g, sqOf(m.slice(0, 2)), sqOf(m.slice(2, 4)), promo), m).toBe(true);
  }
  return g;
};
const uci = (m: number) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? " pnbrqk"[mPromo(m)] : "");
const moveList = (fen: string) => legalMoves(fromFen(fen)).map(uci).sort();

describe("move generation (perft)", () => {
  it("counts the start position: 20, 400, 8902, 197281", () => {
    const p = fromFen(START_FEN);
    expect([1, 2, 3, 4].map((d) => perft(p, d))).toEqual([20, 400, 8902, 197281]);
  });

  it("counts Kiwipete (castling, en passant, promotions, pins): 48, 2039, 97862", () => {
    const p = fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([48, 2039, 97862]);
  });

  it("counts the other standard positions", () => {
    expect([1, 2, 3, 4].map((d) => perft(fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), d))).toEqual([14, 191, 2812, 43238]);
    expect([1, 2, 3].map((d) => perft(fromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), d))).toEqual([6, 264, 9467]);
    expect([1, 2, 3].map((d) => perft(fromFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), d))).toEqual([44, 1486, 62379]);
  });

  it("leaves the position as it found it", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    const p = fromFen(fen);
    perft(p, 3);
    expect(toFen(p)).toBe(fen);
  });
});

describe("special moves", () => {
  it("castles both sides only with rights, empty squares and no check on the way", () => {
    expect(moveList("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")).toEqual(expect.arrayContaining(["e1g1", "e1c1"]));
    // Through check (f1 attacked), out of check, into check
    expect(moveList("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1")).not.toContain("e1g1");
    expect(moveList("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1").filter((m) => m === "e1g1" || m === "e1c1")).toEqual([]);
    expect(moveList("4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1")).not.toContain("e1g1");
    // b1 attacked does not stop O-O-O, d1 attacked does
    expect(moveList("4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1")).toContain("e1c1");
    expect(moveList("4k3/8/8/8/8/8/3r4/R3K2R w KQ - 0 1")).not.toContain("e1c1");
    // A piece in the way
    expect(moveList("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1")).not.toContain("e1c1");
  });

  it("moves the rook when castling and loses rights when king or rook move or the rook is taken", () => {
    const g = fenGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    play(g, "e1g1");
    expect(toFen(g.pos).split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
    expect(g.san[0]).toBe("O-O");
    play(g, "a8a1");
    // Black's rook took the a1 rook: White has no rights left, Black only O-O
    expect(toFen(g.pos).split(" ")[2]).toBe("k");
    const h = fenGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    play(h, "h1h2 e8d8 h2h1 d8e8");
    expect(toFen(h.pos).split(" ")[2]).toBe("Q");
  });

  it("captures en passant only right after the double step, and never into check", () => {
    const g = newGame();
    play(g, "e2e4 a7a6 e4e5 d7d5");
    expect(targetsFrom(g.pos, sqOf("e5"))).toContain(sqOf("d6"));
    play(g, "e5d6");
    expect(g.pos.b[sqOf("d5")]).toBe(0);
    expect(g.san[4]).toBe("exd6");
    const late = newGame();
    play(late, "e2e4 a7a6 e4e5 d7d5 h2h3 h7h6");
    expect(targetsFrom(late.pos, sqOf("e5"))).not.toContain(sqOf("d6"));
    // Both pawns leave the rank: the rook would see the king
    expect(moveList("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1")).not.toContain("e5d6");
  });

  it("promotes to any of the four pieces, with notation", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
    expect(moveList(fen).filter((m) => m.startsWith("a7a8"))).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
    const g = fenGame(fen);
    play(g, "a7a8n");
    expect(g.pos.b[sqOf("a8")]).toBe(2);
    expect(g.san[0]).toBe("a8=N");
  });
});

describe("notation", () => {
  it("disambiguates and marks check and mate", () => {
    const p = fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
    const legal = legalMoves(p);
    const nd2 = legal
      .filter((m) => sqName(mTo(m)) === "d2")
      .map((m) => san(p, m, legal))
      .filter((s) => s.startsWith("N"));
    expect(nd2.sort()).toEqual(["Nbd2", "Nfd2"]);
    const g = newGame();
    play(g, "f2f3 e7e5 g2g4 d8h4");
    expect(g.san).toEqual(["f3", "e5", "g4", "Qh4#"]);
  });
});

describe("the end of a game", () => {
  it("ends on checkmate and accepts no more moves", () => {
    const g = newGame();
    play(g, "f2f3 e7e5 g2g4 d8h4");
    expect(g.result).toEqual({ winner: BLACK, reason: "mate" });
    expect(playMove(g, sqOf("a2"), sqOf("a3"))).toBe(false);
  });

  it("draws on stalemate", () => {
    const g = fenGame("7k/8/6Q1/8/8/8/8/K7 w - - 0 1");
    play(g, "g6f7");
    expect(g.result).toEqual({ winner: 0, reason: "stalemate" });
  });

  it("draws on the third repetition", () => {
    const g = newGame();
    play(g, "g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1");
    expect(g.result).toBeNull();
    play(g, "f6g8");
    expect(g.result).toEqual({ winner: 0, reason: "repetition" });
  });

  it("draws after fifty moves with no capture or pawn move", () => {
    const g = fenGame("4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80");
    play(g, "a1a2");
    expect(g.result).toEqual({ winner: 0, reason: "fifty" });
    // A pawn move resets the count
    const h = fenGame("4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80");
    play(h, "e2e3");
    expect(h.result).toBeNull();
  });

  it("draws when neither side can mate", () => {
    const b = (fen: string) => fromFen(fen).b;
    expect(insufficient(b("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toBe(true);
    expect(insufficient(b("4k3/8/8/8/8/8/8/2B1K3 w - - 0 1"))).toBe(true);
    expect(insufficient(b("4k3/8/8/8/8/8/8/1N2K3 w - - 0 1"))).toBe(true);
    // Bishops all on light squares (c8, f1) can't mate; on both colours they can
    expect(insufficient(b("2b1k3/8/8/8/8/8/8/4KB2 w - - 0 1"))).toBe(true);
    expect(insufficient(b("1b2k3/8/8/8/8/8/8/4KB2 w - - 0 1"))).toBe(false);
    expect(insufficient(b("4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1"))).toBe(false);
    expect(insufficient(b("4k3/8/8/8/8/8/P7/4K3 w - - 0 1"))).toBe(false);
    const g = fenGame("4k3/8/8/8/8/8/3r4/2B1K3 w - - 0 1");
    play(g, "e1d2");
    expect(g.result).toEqual({ winner: 0, reason: "material" });
  });

  it("takes moves back by replaying", () => {
    const g = newGame();
    play(g, "e2e4 e7e5 g1f3");
    const back = takeBack(g, 2);
    expect(back.san).toEqual(["e4"]);
    expect(back.pos.turn).toBe(BLACK);
    expect(toFen(replay(g.history).pos)).toBe(toFen(g.pos));
  });
});

describe("the computer", () => {
  const levels: Difficulty[] = ["easy", "normal", "hard"];
  const pick = (fen: string, level: Difficulty, seed = 1) => uci(chooseMove(fenGame(fen), level, mulberry32(seed)));

  it("plays a legal move from the start on every level", () => {
    for (const level of levels) for (let s = 0; s < 5; s++) expect(moveList(START_FEN)).toContain(pick(START_FEN, level, s));
  });

  it("mates in one (Normal and Hard)", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 4";
    for (const level of ["normal", "hard"] as Difficulty[]) expect(pick(fen, level)).toBe("h5f7");
  });

  it("finds a mate in two on Hard", () => {
    // 1. Kc7 Ka7 2. Ra1#
    const g = fenGame("k7/8/2K5/8/8/8/8/1R6 w - - 0 1");
    for (let i = 0; i < 3 && !g.result; i++) {
      const m = chooseMove(g, "hard", mulberry32(i));
      playMove(g, mFrom(m), mTo(m));
    }
    expect(g.result).toEqual({ winner: WHITE, reason: "mate" });
  });

  it("takes a free queen and keeps its own (Normal and Hard)", () => {
    for (const level of ["normal", "hard"] as Difficulty[]) {
      expect(pick("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1", level)).toBe("d2d5");
      // The queen is attacked by a pawn: it should step away, not sit there
      const fen = "4k3/8/8/8/2p5/1Q6/8/4K3 w - - 0 1";
      expect(pick(fen, level).startsWith("b3")).toBe(true);
    }
  });

  it("scores material for the side to move", () => {
    expect(evaluate(fromFen("4k3/8/8/8/8/8/8/3QK3 w - - 0 1"))).toBeGreaterThan(800);
    expect(evaluate(fromFen("4k3/8/8/8/8/8/8/3QK3 b - - 0 1"))).toBeLessThan(-800);
  });

  it("thinks fast enough for a phone on Hard", () => {
    for (const fen of [
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
      "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R2QKB1R w KQ - 0 8",
      START_FEN,
    ]) {
      const t = performance.now();
      chooseMove(fenGame(fen), "hard", mulberry32(9));
      expect(performance.now() - t).toBeLessThan(400);
    }
  });

  /** A game between two levels from a random opening; +1 White wins, -1 Black, 0 draw (material decides at the cap). */
  function duel(white: Difficulty, black: Difficulty, seed: number, ms?: number): number {
    const rand = mulberry32(seed);
    const g = newGame();
    for (let i = 0; i < 2; i++) {
      const legal = legalMoves(g.pos);
      const m = legal[Math.floor(rand() * legal.length)];
      playMove(g, mFrom(m), mTo(m));
    }
    while (!g.result && g.history.length < 160) {
      const level = g.pos.turn === WHITE ? white : black;
      const m = chooseMove(g, level, rand, level === "hard" && ms ? { ms } : {});
      playMove(g, mFrom(m), mTo(m), mPromo(m) || QUEEN);
    }
    if (g.result) return g.result.winner;
    const lead = evaluate(g.pos) * g.pos.turn;
    return lead > 150 ? 1 : lead < -150 ? -1 : 0;
  }

  it("ranks the levels: Normal beats Easy, Hard beats Normal", { timeout: 60_000 }, () => {
    let normal = 0;
    let hard = 0;
    for (let i = 0; i < 2; i++) {
      normal += duel("normal", "easy", i) - duel("easy", "normal", i + 10);
      hard += duel("hard", "normal", i + 20, 60) - duel("normal", "hard", i + 30, 60);
    }
    expect(normal).toBeGreaterThanOrEqual(3);
    expect(hard).toBeGreaterThanOrEqual(2);
  });
});

describe("an online match", () => {
  const tick = 1 / coVuaOnline.tickRate;
  const mv = (from: string, to: string) => ({ type: "move" as const, from: sqOf(from), to: sqOf(to) });

  it("plays only the mover's legal moves", () => {
    const m = createMatch(["An", "Bình"]);
    stepMatch(m, tick, [null, mv("e7", "e5")]);
    expect(m.game.san).toEqual([]);
    stepMatch(m, tick, [mv("e2", "e5"), null]);
    expect(m.game.san).toEqual([]);
    stepMatch(m, tick, [mv("e2", "e4"), null]);
    stepMatch(m, tick, [null, mv("e7", "e5")]);
    expect(m.game.san).toEqual(["e4", "e5"]);
    expect(m.events.filter((e) => e.type === "move")).toHaveLength(2);
  });

  it("ends on checkmate with a score for the winner only", () => {
    const m = createMatch(["An", "Bình"]);
    for (const [seat, a, b] of [
      [0, "f2", "f3"],
      [1, "e7", "e5"],
      [0, "g2", "g4"],
      [1, "d8", "h4"],
    ] as const) {
      const inputs: (ReturnType<typeof mv> | null)[] = [null, null];
      inputs[seat] = mv(a, b);
      stepMatch(m, tick, inputs);
    }
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(1);
    expect(m.reason).toBe("mate");
    expect(matchScore(m, 1)).toBeGreaterThan(1000);
    expect(matchScore(m, 0)).toBe(0);
  });

  it("offers, declines by moving, and agrees a draw", () => {
    const m = createMatch(["An", "Bình"]);
    stepMatch(m, tick, [{ type: "draw" }, null]);
    expect(m.offer).toBe(0);
    // Can't accept your own offer, and can't offer twice in a row
    stepMatch(m, tick, [{ type: "accept" }, null]);
    expect(m.phase).toBe("play");
    stepMatch(m, tick, [mv("e2", "e4"), null]);
    stepMatch(m, tick, [null, mv("e7", "e5")]);
    expect(m.offer).toBeNull();
    stepMatch(m, tick, [{ type: "draw" }, null]);
    expect(m.offer).toBe(0);
    stepMatch(m, tick, [null, { type: "decline" }]);
    expect(m.offer).toBeNull();
    stepMatch(m, tick, [null, { type: "draw" }]);
    stepMatch(m, tick, [{ type: "accept" }, null]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBeNull();
    expect(m.reason).toBe("agreement");
    expect(matchScore(m, 0)).toBe(0);
  });

  it("lets either player resign", () => {
    const m = createMatch(["An", "Bình"]);
    stepMatch(m, tick, [null, { type: "resign" }]);
    expect(m.winner).toBe(0);
    expect(m.reason).toBe("resign");
    expect(matchScore(m, 0)).toBe(1000);
  });

  it("forfeits a player away for a minute, not one who comes back", () => {
    const m = createMatch(["An", "Bình"]);
    setAway(m, 1, true);
    for (let t = 0; t < (AWAY_SECONDS - 1) * coVuaOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("play");
    setAway(m, 1, false);
    setAway(m, 1, true);
    for (let t = 0; t < (AWAY_SECONDS + 1) * coVuaOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
    expect(m.reason).toBe("forfeit");
  });
});

describe("online adapter", () => {
  it("accepts only well-formed actions", () => {
    expect(parseAction([{ type: "move", from: 12, to: 28 }])).toEqual({ type: "move", from: 12, to: 28 });
    expect(parseAction([{ type: "move", from: 52, to: 60, promo: 2 }])).toEqual({ type: "move", from: 52, to: 60, promo: 2 });
    expect(parseAction([{ type: "move", from: 52, to: 60, promo: 6 }])).toBeNull();
    expect(parseAction([{ type: "move", from: 64, to: 1 }])).toBeNull();
    expect(parseAction([{ type: "move", from: "12", to: 28 }])).toBeNull();
    expect(parseAction([{ type: "move", from: 1.5, to: 28 }])).toBeNull();
    expect(parseAction([{ type: "move", from: 3, to: 3 }])).toBeNull();
    expect(parseAction([null, "x", 7, { type: "nuke" }, { type: "resign", extra: 1 }])).toEqual({ type: "resign" });
    expect(parseAction([{ type: "draw" }])).toEqual({ type: "draw" });
    expect(coVuaOnline.parseInput({ move: { x: 0, y: 0 }, actions: [] })).toBeNull();
  });

  it("runs a whole match with all-null inputs to an end (a player away) with a result per seat", () => {
    const sim = coVuaOnline.create(5, [{ name: "An" }, { name: "Bình" }], {});
    sim.setAutopilot(1, true);
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < coVuaOnline.tickRate * 120) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("over")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(results.map((r) => r.outcome)).toEqual(["win", "loss"]);
    expect(results[0].score).toBeGreaterThan(0);
    for (const r of results) expect(r.detail.length).toBeLessThanOrEqual(40);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });

  it("plays moves through the adapter and keeps snapshots small and JSON-safe", () => {
    const sim = coVuaOnline.create(1, [{ name: "An" }, { name: "Bình" }], {});
    const parse = (a: unknown) => coVuaOnline.parseInput({ move: { x: 0, y: 0 }, actions: [a] });
    sim.step([parse({ type: "move", from: sqOf("e2"), to: sqOf("e4") }), null]);
    sim.step([null, parse({ type: "move", from: sqOf("e7"), to: sqOf("e5") })]);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    expect(snap.game.san).toEqual(["e4", "e5"]);
    expect(snap.game.history).toEqual([]);
    expect(JSON.stringify(snap).length).toBeLessThan(1500);
    const draw = coVuaOnline.create(1, [{ name: "An" }, { name: "Bình" }], {});
    draw.step([parse({ type: "draw" }), null]);
    draw.step([null, parse({ type: "accept" })]);
    expect(draw.over).toBe(true);
    expect(draw.results().map((r) => [r.outcome, r.score])).toEqual([
      ["draw", 0],
      ["draw", 0],
    ]);
    expect(snapshotOf(createMatch(["a", "b"])).events).toEqual([]);
  });
});
