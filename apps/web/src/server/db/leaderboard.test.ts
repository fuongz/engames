import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { forgetGameIds } from "./games";
import { roll } from "./jackpot";
import { type Db, saveScore, topScores, weeklyTicketBoard } from "./leaderboard";
import * as schema from "./schema";
import { buyItem } from "./shop";
import { depositTickets } from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, so the upsert SQL
// (partial unique index + CASE on the old row) is checked against an engine.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

function freshDb(): Db {
  forgetGameIds();
  const sqlite = new Database(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  sqlite.run(
    "insert into user (id, name, email) values ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn'), ('u3', 'Chi', 'chi@x.vn')",
  );
  raw = sqlite;
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const base = { gameSlug: "tinh-tu", detail: null };
let db: Db;
let raw: Database;
beforeEach(() => {
  db = freshDb();
});

describe("saveScore", () => {
  it("keeps only the best run per signed-in player", async () => {
    const first = await saveScore(db, { ...base, score: 900, name: "An", userId: "u1", detail: "2★" });
    const worse = await saveScore(db, { ...base, score: 400, name: "An", userId: "u1", detail: "1★" });
    expect(worse).toMatchObject({ id: first.id, best: 900, improved: false });
    const better = await saveScore(db, { ...base, score: 1500, name: "An", userId: "u1", detail: "3★" });
    expect(better).toMatchObject({ id: first.id, best: 1500, improved: true });
    const board = await topScores(db, "tinh-tu", 10);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ name: "An", score: 1500, detail: "3★", signedIn: true });
  });

  it("stores every anonymous run separately", async () => {
    await saveScore(db, { ...base, score: 300, name: "Khách", userId: null });
    await saveScore(db, { ...base, score: 300, name: "Khách", userId: null });
    expect(await topScores(db, "tinh-tu", 10)).toHaveLength(2);
  });

  it("ranks by score, ties to the earlier run, per game", async () => {
    await saveScore(db, { ...base, score: 500, name: "Bình", userId: "u2" });
    await saveScore(db, { ...base, score: 800, name: "Khách", userId: null });
    const mine = await saveScore(db, { ...base, score: 500, name: "An", userId: "u1" });
    expect(mine.rank).toBe(2); // only the 800 is strictly ahead
    await saveScore(db, { gameSlug: "chien-thu", detail: null, score: 9999, name: "Khác", userId: null });
    const board = await topScores(db, "tinh-tu", 10);
    expect(board.map((e) => e.name)).toEqual(["Khách", "Bình", "An"]);
  });
});

describe("weeklyTicketBoard", () => {
  /** A Vietnam wall-clock time as unix ms (UTC+7). */
  const vn = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => Date.UTC(y, mo - 1, d, h - 7, mi, s, ms);
  // Wednesday 11 November 2026; the week began Monday the 9th
  const NOW = vn(2026, 11, 11, 10);
  const earn = (userId: string, amount: number, now: number, slug = "xu-vu-tru") =>
    depositTickets(db, { userId, slug, tickets: true, amount, now });
  const board = (userId: string | null, over: { limit?: number; now?: number; slug?: string } = {}) =>
    weeklyTicketBoard(db, { slug: over.slug ?? "xu-vu-tru", limit: over.limit ?? 10, userId, now: over.now ?? NOW });

  it("sums this week's earnings per player, best first, with the player's own rank", async () => {
    await earn("u1", 300, vn(2026, 11, 9, 8));
    await earn("u1", 200, vn(2026, 11, 10, 8));
    await earn("u2", 900, vn(2026, 11, 10, 9));
    await earn("u3", 100, vn(2026, 11, 11, 9));
    const b = await board("u1");
    expect(b.entries.map((e) => [e.id, e.name, e.score])).toEqual([
      [1, "Bình", 900],
      [2, "An", 500],
      [3, "Chi", 100],
    ]);
    expect(b.entries[0]).toMatchObject({ detail: null, signedIn: true, createdAt: vn(2026, 11, 10, 9) / 1000 });
    expect(b.me).toEqual({ rank: 2, score: 500, id: 2 });
    expect(b.resetsAt).toBe(vn(2026, 11, 16));
  });

  it("starts each week at Monday 00:00 +07:00", async () => {
    await earn("u1", 400, vn(2026, 11, 8, 23, 59, 59, 999)); // Sunday: last week
    await earn("u1", 50, vn(2026, 11, 9)); // Monday 00:00: this week
    await earn("u2", 70, Date.UTC(2026, 10, 8, 17, 30)); // 00:30 Monday in Vietnam, still Sunday in UTC
    expect((await board("u1")).entries.map((e) => [e.name, e.score])).toEqual([
      ["Bình", 70],
      ["An", 50],
    ]);
    // Seen from last week, only the Sunday row counts
    const last = await board("u1", { now: vn(2026, 11, 8, 23, 59, 59, 999) });
    expect(last.entries.map((e) => e.score)).toEqual([400]);
    expect(last.resetsAt).toBe(vn(2026, 11, 9));
    // Next Monday the board is empty again
    expect((await board("u1", { now: vn(2026, 11, 16) })).entries).toEqual([]);
  });

  const shop = [{ id: "bag", name: { vi: "Túi", en: "Bag" }, kind: "coins", amount: 1, price: 600 }];
  const buy = (userId: string, now: number, slug = "xu-vu-tru") => buyItem(db, { userId, slug, itemId: "bag", now, shop });

  it("ranks net tickets: this game's Prize Counter spends come off the week's earnings", async () => {
    await earn("u1", 1000, vn(2026, 11, 9, 8));
    await earn("u2", 700, vn(2026, 11, 10, 8));
    expect(await buy("u1", NOW)).toMatchObject({ ok: true });
    const b = await board("u1");
    expect(b.entries.map((e) => [e.name, e.score])).toEqual([
      ["Bình", 700],
      ["An", 400],
    ]);
    // `createdAt` stays the last EARNING, not the later spend
    expect(b.entries[1].createdAt).toBe(vn(2026, 11, 9, 8) / 1000);
    expect(b.me).toEqual({ rank: 2, score: 400, id: 2 });
  });

  it("ignores a spend at another game's counter, and hand adjustments", async () => {
    await earn("u1", 1000, NOW);
    await earn("u1", 10, NOW, "xep-tang");
    expect(await buy("u1", NOW, "xep-tang")).toMatchObject({ ok: true });
    raw.run(
      `insert into ticket_ledger (user_id, game_id, delta, reason, created_at) select 'u1', id, -500, 'adjust', ${NOW} from game where slug = 'xu-vu-tru'`,
    );
    raw.run(
      `insert into ticket_ledger (user_id, game_id, delta, reason, created_at) select 'u1', id, 5000, 'adjust', ${NOW} from game where slug = 'xu-vu-tru'`,
    );
    expect((await board("u1")).me).toEqual({ rank: 1, score: 1000, id: 1 });
    // The spend lands on the other game's board instead (floored there: 10 − 600)
    expect((await board("u1", { slug: "xep-tang" })).me).toBeNull();
  });

  it("floors the week's net at zero: spending more than you earned takes you off the board", async () => {
    await earn("u1", 2000, vn(2026, 11, 5)); // last week: the wallet can pay, the board never sees it
    await earn("u1", 100, vn(2026, 11, 9, 8));
    expect(await buy("u1", NOW)).toMatchObject({ ok: true });
    await earn("u2", 50, NOW);
    const b = await board("u1");
    expect(b.entries.map((e) => [e.name, e.score])).toEqual([["Bình", 50]]);
    expect(b.me).toBeNull();
    // The floor is on the week's total: 100 − 600 + 400 is still below zero…
    await earn("u1", 400, NOW);
    expect((await board("u1")).me).toBeNull();
    // …and 100 − 600 + 400 + 180 is back on the board
    await earn("u1", 180, NOW);
    expect((await board("u1")).me).toEqual({ rank: 1, score: 80, id: 1 });
  });

  it("only subtracts spends made this Vietnam week", async () => {
    await earn("u1", 2000, vn(2026, 11, 8, 12));
    expect(await buy("u1", vn(2026, 11, 8, 23, 59, 59, 999))).toMatchObject({ ok: true }); // Sunday: last week
    await earn("u1", 900, vn(2026, 11, 9));
    expect((await board("u1")).me?.score).toBe(900);
    expect(await buy("u1", vn(2026, 11, 9))).toMatchObject({ ok: true }); // Monday 00:00: this week
    expect((await board("u1")).me?.score).toBe(300);
    // Last week's board took its own Sunday spend: 2000 − 600
    expect((await board("u1", { now: vn(2026, 11, 8, 23, 59, 59, 999) })).me?.score).toBe(1400);
    // Next Monday starts clean
    expect((await board("u1", { now: vn(2026, 11, 16) })).me).toBeNull();
  });

  it("never counts a Lucky Jar win (reason 'jackpot')", async () => {
    await earn("u1", 300, NOW);
    await earn("u2", 200, NOW);
    raw.run("update jackpot_pool set pool = cap where id = 'arcade'");
    expect(await roll(db, { userId: "u2", slug: "xu-vu-tru", now: NOW, rand: () => 0 })).toMatchObject({ won: true, amount: 50_000 });
    const { entries, me } = await board("u2");
    expect(entries.map((e) => [e.name, e.score])).toEqual([
      ["An", 300],
      ["Bình", 200],
    ]);
    expect(me).toEqual({ rank: 2, score: 200, id: 2 });
  });

  it("keeps games apart", async () => {
    await earn("u1", 100, NOW);
    await earn("u2", 999, NOW, "xep-tang");
    expect((await board(null)).entries.map((e) => e.name)).toEqual(["An"]);
    expect((await board(null, { slug: "xep-tang" })).entries.map((e) => e.name)).toEqual(["Bình"]);
  });

  it("ranks a player below the top N, ties to whoever got there first", async () => {
    await earn("u2", 500, vn(2026, 11, 10, 8));
    await earn("u3", 500, vn(2026, 11, 9, 8)); // same total, earlier
    await earn("u1", 100, NOW);
    const b = await board("u1", { limit: 2 });
    expect(b.entries.map((e) => e.name)).toEqual(["Chi", "Bình"]);
    expect(b.me).toEqual({ rank: 3, score: 100, id: null });
    // Tied players share a rank, like the all-time board
    expect((await board("u2", { limit: 2 })).me).toEqual({ rank: 1, score: 500, id: 2 });
  });

  it("has no own rank signed out or before earning", async () => {
    await earn("u2", 10, NOW);
    expect((await board(null)).me).toBeNull();
    expect((await board("u1")).me).toBeNull();
  });
});

describe("profile links on the boards", () => {
  it("all-time rows carry the player's id and whether their profile is public", async () => {
    raw.run("update user set profile_public = 0 where id = 'u2'");
    await saveScore(db, { ...base, score: 900, name: "An", userId: "u1" });
    await saveScore(db, { ...base, score: 800, name: "Bình", userId: "u2" });
    await saveScore(db, { ...base, score: 700, name: "Khách", userId: null });
    const rows = (await topScores(db, "tinh-tu", 10)).map(({ name, userId, profilePublic, signedIn }) => ({
      name,
      userId,
      profilePublic,
      signedIn,
    }));
    expect(rows).toEqual([
      { name: "An", userId: "u1", profilePublic: true, signedIn: true },
      { name: "Bình", userId: "u2", profilePublic: false, signedIn: true },
      { name: "Khách", userId: null, profilePublic: false, signedIn: false },
    ]);
  });

  it("weekly rows carry them too", async () => {
    raw.run("update user set profile_public = 0 where id = 'u1'");
    const now = Date.UTC(2026, 10, 12, 5);
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 300, now });
    await depositTickets(db, { userId: "u2", slug: "xu-vu-tru", tickets: true, amount: 200, now });
    const b = await weeklyTicketBoard(db, { slug: "xu-vu-tru", limit: 10, userId: null, now });
    expect(b.entries.map(({ userId, profilePublic }) => ({ userId, profilePublic }))).toEqual([
      { userId: "u1", profilePublic: false },
      { userId: "u2", profilePublic: true },
    ]);
  });
});
