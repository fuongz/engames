import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { BASE_CHANCE, DAILY_CONTRIBUTION_CAP, DAILY_ROLLS, jackpotChance } from "#/lib/jackpot";
import { forgetGameIds } from "./games";
import {
  type ContributeInput,
  contribute,
  JACKPOT_REASON,
  jackpotState,
  publicName,
  type RollInput,
  roll,
  secureRandom,
} from "./jackpot";
import { type Db, weeklyTicketBoard } from "./leaderboard";
import * as schema from "./schema";
import { depositTickets, getTicketBalance } from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, like tickets.test.ts.
// 0010 seeds the one pool: 5,000 tickets, seed 5,000, cap 50,000, round 1.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

let sqlite: Database;
let db: Db;

function freshDb() {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  sqlite.run(
    `insert into user (id, name, email) values
      ('u1', 'Lan Nguyễn', 'lan@x.vn'),
      ('u2', 'Bình', 'binh@x.vn'),
      ('u3', 'player3@gmail.com', 'player3@gmail.com')`,
  );
  db = drizzle(sqlite, { schema }) as unknown as Db;
}

beforeEach(freshDb);

/** A Vietnam wall-clock time as unix ms (UTC+7). */
const vn = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 7, mi);
// Wednesday 11 November 2026
const NOW = vn(2026, 11, 11, 10);

const feed = (coins: number, over: Partial<ContributeInput> = {}) =>
  contribute(db, { userId: "u1", slug: "xu-vu-tru", coins, now: NOW, ...over });
const spin = (rand: number, over: Partial<RollInput> = {}) =>
  roll(db, { userId: "u1", slug: "xu-vu-tru", now: NOW, rand: () => rand, ...over });

const pool = () =>
  sqlite.query("select pool, seed, cap, round from jackpot_pool where id = 'arcade'").get() as {
    pool: number;
    seed: number;
    cap: number;
    round: number;
  };
const setPool = (n: number) => sqlite.run(`update jackpot_pool set pool = ${n} where id = 'arcade'`);

describe("the seeded pool", () => {
  it("0010 creates exactly one pool at its seed", () => {
    expect(pool()).toEqual({ pool: 5000, seed: 5000, cap: 50_000, round: 1 });
    expect(sqlite.query("select count(*) n from jackpot_pool").get()).toEqual({ n: 1 });
  });

  it("refuses a hand edit that would put the pool over its cap", () => {
    expect(() => setPool(50_001)).toThrow();
    expect(() => sqlite.run("update jackpot_pool set cap = 5000 where id = 'arcade'")).toThrow();
  });
});

describe("contribute", () => {
  it("adds two tickets per coin to the shared pool", async () => {
    expect(await feed(10)).toEqual({ accepted: 20, pool: 5020 });
    expect(await feed(5, { userId: "u2", slug: "xep-tang" })).toEqual({ accepted: 10, pool: 5030 });
    expect(pool().pool).toBe(5030);
  });

  it("refuses an amount that is not a positive integer", async () => {
    for (const bad of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      await expect(feed(bad)).rejects.toThrow("bad-amount");
    expect(pool().pool).toBe(5000);
  });

  it("clamps to 2,000 tickets per player per game per Vietnam day", async () => {
    expect(await feed(900)).toEqual({ accepted: 1800, pool: 6800 });
    // 200 left today in this game
    expect(await feed(300)).toEqual({ accepted: 200, pool: 7000 });
    expect(await feed(1)).toEqual({ accepted: 0, pool: 7000 });
    // One huge request is clamped too
    expect(await feed(1_000_000, { userId: "u2" })).toMatchObject({ accepted: DAILY_CONTRIBUTION_CAP });
    // Another game has its own cap; so does tomorrow (00:00 +07:00)
    expect(await feed(1, { slug: "xep-tang" })).toMatchObject({ accepted: 2 });
    expect(await feed(1, { now: vn(2026, 11, 11, 23, 59) })).toMatchObject({ accepted: 0 });
    expect(await feed(1, { now: vn(2026, 11, 12) })).toMatchObject({ accepted: 2 });
    expect(
      sqlite.query("select day, tickets from jackpot_contribution where user_id = 'u1' order by day, tickets desc").all(),
    ).toEqual([
      { day: "2026-11-11", tickets: 2000 },
      { day: "2026-11-11", tickets: 2 },
      { day: "2026-11-12", tickets: 2 },
    ]);
  });

  it("concurrent contributions never pass the daily cap and the pool counts each one", async () => {
    await feed(500); // 1,000 tickets
    const results = await Promise.all(Array.from({ length: 12 }, () => feed(100)));
    const accepted = results.reduce((n, r) => n + r.accepted, 0);
    expect(accepted).toBe(1000);
    const row = sqlite.query("select tickets from jackpot_contribution where user_id = 'u1'").get();
    expect(row).toEqual({ tickets: DAILY_CONTRIBUTION_CAP });
    expect(pool().pool).toBe(5000 + DAILY_CONTRIBUTION_CAP);
  });

  it("never pushes the pool above its cap", async () => {
    setPool(49_990);
    expect(await feed(100)).toEqual({ accepted: 200, pool: 50_000 });
    expect(await feed(100, { userId: "u2" })).toEqual({ accepted: 200, pool: 50_000 });
    expect(pool().pool).toBe(50_000);
  });
});

describe("the chance curve", () => {
  it("is ½ % at the seed, 1 at the cap, cubic between", () => {
    expect(jackpotChance(5000, 5000, 50_000)).toBe(BASE_CHANCE);
    expect(jackpotChance(50_000, 5000, 50_000)).toBe(1);
    expect(jackpotChance(60_000, 5000, 50_000)).toBe(1);
    // Halfway: 0.005 + 0.995 / 8
    expect(jackpotChance(27_500, 5000, 50_000)).toBeCloseTo(0.005 + 0.995 * 0.125, 12);
    // Below the seed counts as the seed
    expect(jackpotChance(0, 5000, 50_000)).toBe(BASE_CHANCE);
    // Rises all the way
    let last = 0;
    for (let pool = 5000; pool <= 50_000; pool += 2500) {
      const p = jackpotChance(pool, 5000, 50_000);
      expect(p).toBeGreaterThan(last);
      last = p;
    }
  });

  it("draws from the CSPRNG in [0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const r = secureRandom();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});

describe("roll", () => {
  it("loses when the draw is above the chance and leaves the pool alone", async () => {
    setPool(12_345);
    expect(await spin(0.5)).toEqual({ won: false, pool: 12_345, round: 1 });
    expect(pool()).toMatchObject({ pool: 12_345, round: 1 });
    expect(sqlite.query("select count(*) n from jackpot_win").get()).toEqual({ n: 0 });
  });

  it("at the seed wins only under ½ %", async () => {
    expect(await spin(BASE_CHANCE)).toMatchObject({ won: false });
    expect(await spin(BASE_CHANCE - 1e-9)).toMatchObject({ won: true, amount: 5000 });
  });

  it("always wins at the cap, pays the pool and starts the next round at the seed", async () => {
    setPool(50_000);
    expect(await spin(0.999_999)).toEqual({ won: true, amount: 50_000, pool: 5000, round: 2 });
    expect(pool()).toEqual({ pool: 5000, seed: 5000, cap: 50_000, round: 2 });
    expect(sqlite.query("select round, user_id, amount, won_at from jackpot_win").all()).toEqual([
      { round: 1, user_id: "u1", amount: 50_000, won_at: NOW },
    ]);
  });

  it("credits the shared wallet with a 'jackpot' ledger row that is not earnings", async () => {
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 300, now: NOW });
    setPool(23_410);
    expect(await spin(0)).toMatchObject({ won: true, amount: 23_410 });
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 23_710, earnedTotal: 300 });
    expect(
      sqlite
        .query("select l.delta, l.reason, l.created_at, g.slug from ticket_ledger l join game g on g.id = l.game_id order by l.id")
        .all(),
    ).toEqual([
      { delta: 300, reason: "earn", created_at: NOW, slug: "xu-vu-tru" },
      { delta: 23_410, reason: JACKPOT_REASON, created_at: NOW, slug: "xu-vu-tru" },
    ]);
    // A player with no wallet yet gets one
    setPool(50_000);
    expect(await spin(0, { userId: "u2" })).toMatchObject({ won: true, amount: 50_000 });
    expect(await getTicketBalance(db, "u2")).toEqual({ balance: 50_000, earnedTotal: 0 });
  });

  it("allows 8 rolls per player per Vietnam day, across every game", async () => {
    for (let i = 0; i < DAILY_ROLLS; i++) {
      expect(await spin(0.9, { slug: i % 2 ? "xep-tang" : "xu-vu-tru" })).toEqual({ won: false, pool: 5000, round: 1 });
    }
    // The 9th draws nothing, even at the cap
    setPool(50_000);
    expect(await spin(0)).toEqual({ won: false, pool: 50_000, round: 1, limited: true });
    expect(pool().round).toBe(1);
    // Someone else still can, and so can u1 tomorrow
    expect(await spin(0.9, { userId: "u2" })).toMatchObject({ won: true });
    const tomorrow = await spin(0.9, { now: vn(2026, 11, 12) });
    expect(tomorrow.won).toBe(false);
    expect(tomorrow).not.toHaveProperty("limited");
    expect(sqlite.query("select user_id, day, count from jackpot_roll order by user_id, day").all()).toEqual([
      { user_id: "u1", day: "2026-11-11", count: DAILY_ROLLS },
      { user_id: "u1", day: "2026-11-12", count: 1 },
      { user_id: "u2", day: "2026-11-11", count: 1 },
    ]);
  });

  it("two rolls that both draw a win: only the one that claims the round wins", async () => {
    setPool(50_000);
    // Promise.all interleaves the two at every await: both read round 1 before
    // either claims it, so both send the claim for round 1
    const [a, b] = await Promise.all([spin(0), spin(0, { userId: "u2", slug: "xep-tang" })]);
    expect([a.won, b.won].sort()).toEqual([false, true]);
    const winner = a.won ? a : b;
    const loser = a.won ? b : a;
    expect(winner).toEqual({ won: true, amount: 50_000, pool: 5000, round: 2 });
    expect(loser).toEqual({ won: false, pool: 5000, round: 2 });
    expect(sqlite.query("select count(*) n from jackpot_win").get()).toEqual({ n: 1 });
    expect(sqlite.query("select count(*) n from ticket_ledger where reason = 'jackpot'").get()).toEqual({ n: 1 });
    const balances = sqlite.query("select balance from ticket_wallet order by balance").all();
    expect(balances).toEqual([{ balance: 50_000 }]);
  });

  it("many racing winners still pay out exactly once", async () => {
    setPool(50_000);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => spin(0, { userId: i % 2 ? "u2" : "u1" })),
    );
    expect(results.filter((r) => r.won)).toHaveLength(1);
    expect(pool()).toMatchObject({ pool: 5000, round: 2 });
    expect(sqlite.query("select coalesce(sum(delta), 0) n from ticket_ledger").get()).toEqual({ n: 50_000 });
  });

  it("carries a contribution that lands between the read and the claim into the next round", async () => {
    setPool(30_000);
    // Feed the jar the moment the roll draws (after it read the pool, before it claims)
    const won = await roll(db, {
      userId: "u1",
      slug: "xu-vu-tru",
      now: NOW,
      rand: () => {
        sqlite.run("update jackpot_pool set pool = pool + 40 where id = 'arcade'");
        return 0;
      },
    });
    expect(won).toEqual({ won: true, amount: 30_000, pool: 5040, round: 2 });
  });
});

describe("jackpot tickets are not earnings", () => {
  it("never count toward the weekly board", async () => {
    await depositTickets(db, { userId: "u2", slug: "xu-vu-tru", tickets: true, amount: 900, now: NOW });
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 100, now: NOW });
    setPool(50_000);
    await spin(0);
    const board = await weeklyTicketBoard(db, { slug: "xu-vu-tru", limit: 10, userId: "u1", now: NOW });
    expect(board.entries.map((e) => [e.name, e.score])).toEqual([
      ["Bình", 900],
      ["Lan Nguyễn", 100],
    ]);
    expect(board.me).toEqual({ rank: 2, score: 100, id: 2 });
  });

  it("a winner with no earnings this week is not on the board at all", async () => {
    setPool(50_000);
    await spin(0, { userId: "u2" });
    const board = await weeklyTicketBoard(db, { slug: "xu-vu-tru", limit: 10, userId: "u2", now: NOW });
    expect(board.entries).toEqual([]);
    expect(board.me).toBeNull();
  });

  it("never use up the daily earn cap", async () => {
    setPool(50_000);
    await spin(0); // 50,000 jackpot tickets in xu-vu-tru today
    for (let i = 0; i < 10; i++) {
      expect(
        await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 5000, now: NOW }),
      ).toMatchObject({ accepted: 5000, clamped: null });
    }
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 100_000, earnedTotal: 50_000 });
  });
});

describe("jackpotState", () => {
  it("returns the pool and the latest winners, newest first, with public names only", async () => {
    setPool(50_000);
    await spin(0, { now: vn(2026, 11, 10, 9) });
    setPool(23_410);
    await spin(0, { userId: "u2", slug: "xep-tang", now: vn(2026, 11, 11, 8) });
    setPool(40_000);
    await spin(0, { userId: "u3", now: vn(2026, 11, 11, 9) });
    await feed(10);

    const state = await jackpotState(db, { limit: 20 });
    expect(state).toEqual({
      pool: 5020,
      seed: 5000,
      cap: 50_000,
      round: 4,
      recent: [
        // An account whose name is its email shows no name at all
        { name: "", amount: 40_000, gameSlug: "xu-vu-tru", wonAt: vn(2026, 11, 11, 9) },
        { name: "Bình", amount: 23_410, gameSlug: "xep-tang", wonAt: vn(2026, 11, 11, 8) },
        { name: "Lan", amount: 50_000, gameSlug: "xu-vu-tru", wonAt: vn(2026, 11, 10, 9) },
      ],
    });
    expect(JSON.stringify(state)).not.toContain("@");
    expect((await jackpotState(db, { limit: 2 })).recent).toHaveLength(2);
  });

  it("publicName keeps the first word, at most 12 characters, never an email", () => {
    expect(publicName("Lan Nguyễn")).toBe("Lan");
    expect(publicName("  Bình  ")).toBe("Bình");
    expect(publicName("Supercalifragilistic Smith")).toBe("Supercalifra");
    expect(publicName("Ánh​")).toBe("Ánh");
    expect(publicName("someone@example.com")).toBe("");
    expect(publicName("")).toBe("");
    expect(publicName(null)).toBe("");
  });

  it("a deleted player's wins and rolls go with them", async () => {
    setPool(50_000);
    await spin(0);
    sqlite.run("delete from user where id = 'u1'");
    expect((await jackpotState(db, { limit: 20 })).recent).toEqual([]);
    expect(sqlite.query("select count(*) n from jackpot_roll").get()).toEqual({ n: 0 });
  });
});
