import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";
import {
  DAILY_EARN_CAP,
  type DepositInput,
  depositTickets,
  getTicketBalance,
  MAX_DEPOSIT,
} from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, like coupons.test.ts.
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
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  for (let i = 1; i <= 3; i++)
    sqlite.run(
      `insert into user (id, name, email) values ('u${i}', 'P${i}', 'p${i}@x.vn')`,
    );
  db = drizzle(sqlite, { schema }) as unknown as Db;
}

beforeEach(freshDb);

/** A Vietnam wall-clock time as unix ms (UTC+7). */
const vn = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  Date.UTC(y, mo - 1, d, h - 7, mi);
const NOW = vn(2026, 11, 11, 10);

const deposit = (amount: number, over: Partial<DepositInput> = {}) =>
  depositTickets(db, {
    userId: "u1",
    slug: "xu-vu-tru",
    tickets: true,
    amount,
    now: NOW,
    ...over,
  });

const ledger = () =>
  sqlite
    .query(
      "select l.user_id, g.slug, l.delta, l.reason from ticket_ledger l join game g on g.id = l.game_id order by l.id",
    )
    .all();

/** The wallet must always equal its ledger. */
const consistent = (userId = "u1") => {
  const sum = (
    sqlite
      .query("select coalesce(sum(delta), 0) n from ticket_ledger where user_id = ?")
      .get(userId) as { n: number }
  ).n;
  const wallet = sqlite
    .query("select balance, earned_total from ticket_wallet where user_id = ?")
    .get(userId) as { balance: number; earned_total: number } | null;
  expect(wallet?.balance ?? 0).toBe(sum);
  expect(wallet?.earned_total ?? 0).toBe(sum);
};

describe("tickets", () => {
  it("a new player has an empty wallet", async () => {
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 0, earnedTotal: 0 });
  });

  it("deposits add up in one wallet shared by every ticket game", async () => {
    expect(await deposit(120)).toEqual({ balance: 120, accepted: 120, clamped: null });
    expect(await deposit(30, { slug: "xep-tang" })).toEqual({ balance: 150, accepted: 30, clamped: null });
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 150, earnedTotal: 150 });
    expect(await getTicketBalance(db, "u2")).toEqual({ balance: 0, earnedTotal: 0 });
    expect(ledger()).toEqual([
      { user_id: "u1", slug: "xu-vu-tru", delta: 120, reason: "earn" },
      { user_id: "u1", slug: "xep-tang", delta: 30, reason: "earn" },
    ]);
    consistent();
  });

  it("refuses an amount that is not a positive integer", async () => {
    for (const bad of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      await expect(deposit(bad)).rejects.toThrow("bad-amount");
    expect(ledger()).toEqual([]);
  });

  it("clamps one deposit to MAX_DEPOSIT and says so", async () => {
    expect(await deposit(MAX_DEPOSIT)).toEqual({ balance: 5000, accepted: 5000, clamped: null });
    expect(await deposit(MAX_DEPOSIT + 1)).toEqual({ balance: 10000, accepted: 5000, clamped: "deposit" });
    expect(await deposit(1_000_000)).toMatchObject({ accepted: 5000, clamped: "deposit" });
    consistent();
  });

  it("clamps to what remains of the daily cap, per game, per Vietnam day", async () => {
    for (let i = 0; i < 9; i++) await deposit(5000); // 45,000
    expect(await deposit(4000)).toEqual({ balance: 49_000, accepted: 4000, clamped: null });
    // 1,000 left today in this game
    expect(await deposit(3000)).toEqual({ balance: 50_000, accepted: 1000, clamped: "daily" });
    expect(await deposit(10)).toEqual({ balance: 50_000, accepted: 0, clamped: "daily" });
    // Another game has its own cap
    expect(await deposit(10, { slug: "xep-tang" })).toMatchObject({ accepted: 10, clamped: null });
    // Another player too
    expect(await deposit(10, { userId: "u2" })).toEqual({ balance: 10, accepted: 10, clamped: null });
    // 23:59 is still today; 00:00 +07:00 is a new day
    expect(await deposit(10, { now: vn(2026, 11, 11, 23, 59) })).toMatchObject({ accepted: 0 });
    expect(await deposit(10, { now: vn(2026, 11, 12) })).toMatchObject({ accepted: 10, clamped: null });
    expect(DAILY_EARN_CAP).toBe(50_000);
    consistent();
  });

  it("only 'earn' rows use up the daily cap and earned_total", async () => {
    // A jackpot win, an adjustment and a refund, all today in this game
    for (const [delta, reason] of [[40_000, "jackpot"], [9_000, "adjust"], [600, "refund:1"]] as const) {
      sqlite.run(
        `insert into ticket_ledger (user_id, game_id, delta, reason, created_at) select 'u1', id, ${delta}, '${reason}', ${NOW} from game where slug = 'xu-vu-tru'`,
      );
    }
    for (let i = 0; i < 10; i++) expect(await deposit(5000)).toMatchObject({ accepted: 5000, clamped: null });
    expect(await deposit(1)).toMatchObject({ accepted: 0, clamped: "daily" });
    expect((await getTicketBalance(db, "u1")).earnedTotal).toBe(DAILY_EARN_CAP);
  });

  it("concurrent deposits never pass the daily cap and never lose a ticket", async () => {
    await deposit(5000);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => deposit(5000)),
    );
    const accepted = results.reduce((n, r) => n + r.accepted, 0);
    expect(accepted).toBe(45_000);
    expect(results.filter((r) => r.clamped === "daily")).toHaveLength(3);
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 50_000, earnedTotal: 50_000 });
    consistent();
  });

  it("refuses a game without tickets (unknown or not arcade) and writes nothing", async () => {
    await expect(deposit(10, { slug: "nope", tickets: undefined })).rejects.toThrow("no-tickets");
    await expect(deposit(10, { slug: "caro", tickets: false })).rejects.toThrow("no-tickets");
    expect(ledger()).toEqual([]);
    expect(sqlite.query("select count(*) n from game where slug = 'nope'").get()).toEqual({ n: 0 });
  });

  it("a deleted player's wallet and ledger go with them", async () => {
    await deposit(10);
    sqlite.run("delete from user where id = 'u1'");
    expect(ledger()).toEqual([]);
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 0, earnedTotal: 0 });
  });
});
