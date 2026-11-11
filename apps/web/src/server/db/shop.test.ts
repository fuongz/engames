import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameManifest, ShopItem } from "@web-games/core";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { claimAllowance } from "./allowance";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";
import { type BuyInput, buyItem, listShop } from "./shop";
import { depositTickets, getTicketBalance } from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, like tickets.test.ts.
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
  for (let i = 1; i <= 3; i++) sqlite.run(`insert into user (id, name, email) values ('u${i}', 'P${i}', 'p${i}@x.vn')`);
  db = drizzle(sqlite, { schema }) as unknown as Db;
}

beforeEach(freshDb);

/** A Vietnam wall-clock time as unix ms (UTC+7). */
const vn = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => Date.UTC(y, mo - 1, d, h - 7, mi, s, ms);
const NOW = vn(2026, 11, 11, 10);

const name = { vi: "Túi xu", en: "Coin bag" };
const SHOP: ShopItem[] = [
  { id: "bag", name, kind: "coins", amount: 500, price: 300 },
  { id: "chest", name, kind: "coins", amount: 2000, price: 100, dailyLimit: 2 },
];

const earn = (amount: number, userId = "u1", now = NOW) =>
  depositTickets(db, { userId, slug: "xu-vu-tru", tickets: true, amount, now });

const buy = (itemId: string, over: Partial<BuyInput> = {}) =>
  buyItem(db, { userId: "u1", slug: "xu-vu-tru", itemId, now: NOW, shop: SHOP, ...over });

const ledger = () =>
  sqlite.query("select l.user_id, g.slug, l.delta, l.reason from ticket_ledger l join game g on g.id = l.game_id order by l.id").all();
const pending = () =>
  sqlite
    .query(
      "select p.user_id, g.slug, p.kind, p.amount, p.source, p.claimed_at, l.delta from pending_grant p join game g on g.id = p.game_id left join ticket_ledger l on l.id = p.ledger_id order by p.id",
    )
    .all();

/** The wallet must equal its ledger, and earned_total only the earn rows. */
const consistent = (userId = "u1") => {
  const { sum, earned } = sqlite
    .query(
      "select coalesce(sum(delta), 0) sum, coalesce(sum(case when reason = 'earn' then delta end), 0) earned from ticket_ledger where user_id = ?",
    )
    .get(userId) as { sum: number; earned: number };
  const wallet = sqlite.query("select balance, earned_total from ticket_wallet where user_id = ?").get(userId) as {
    balance: number;
    earned_total: number;
  } | null;
  expect(wallet?.balance ?? 0).toBe(sum);
  expect(wallet?.earned_total ?? 0).toBe(earned);
  expect(sum).toBeGreaterThanOrEqual(0);
};

describe("buyItem", () => {
  it("spends tickets, logs the spend and leaves a pending grant", async () => {
    await earn(1000);
    expect(await buy("bag")).toEqual({ ok: true, balance: 700 });
    expect(ledger()).toEqual([
      { user_id: "u1", slug: "xu-vu-tru", delta: 1000, reason: "earn" },
      { user_id: "u1", slug: "xu-vu-tru", delta: -300, reason: "shop:xu-vu-tru:bag" },
    ]);
    expect(pending()).toEqual([
      { user_id: "u1", slug: "xu-vu-tru", kind: "coins", amount: 500, source: "shop:bag", claimed_at: null, delta: -300 },
    ]);
    // Spending never lowers what was earned
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 700, earnedTotal: 1000 });
    consistent();
  });

  it("refuses when the balance is short, and writes nothing", async () => {
    expect(await buy("bag")).toEqual({ ok: false, reason: "insufficient" }); // no wallet yet
    await earn(299);
    expect(await buy("bag")).toEqual({ ok: false, reason: "insufficient" });
    await earn(1);
    expect(await buy("bag")).toEqual({ ok: true, balance: 0 });
    expect(await buy("bag")).toEqual({ ok: false, reason: "insufficient" });
    expect(pending()).toHaveLength(1);
    consistent();
  });

  it("refuses an unknown item or a game without a shop, and writes nothing", async () => {
    await earn(1000);
    expect(await buy("nope")).toEqual({ ok: false, reason: "unknown-item" });
    expect(await buy("bag", { slug: "other", shop: undefined })).toEqual({ ok: false, reason: "unknown-item" });
    expect(sqlite.query("select count(*) n from game where slug = 'other'").get()).toEqual({ n: 0 });
    expect(pending()).toEqual([]);
    expect((await getTicketBalance(db, "u1")).balance).toBe(1000);
  });

  it("keeps to the daily limit, per player, per Vietnam day", async () => {
    await earn(1000);
    await earn(1000, "u2");
    expect(await buy("chest")).toMatchObject({ ok: true });
    expect(await buy("chest")).toMatchObject({ ok: true });
    expect(await buy("chest")).toEqual({ ok: false, reason: "daily-limit" });
    // The last millisecond of the day is still today
    expect(await buy("chest", { now: vn(2026, 11, 11, 23, 59, 59, 999) })).toEqual({ ok: false, reason: "daily-limit" });
    // Another player has their own limit; an unlimited item is not affected
    expect(await buy("chest", { userId: "u2" })).toMatchObject({ ok: true });
    expect(await buy("bag")).toMatchObject({ ok: true });
    // 00:00 +07:00: a new day
    expect(await buy("chest", { now: vn(2026, 11, 12) })).toEqual({ ok: true, balance: 1000 - 100 * 3 - 300 });
    consistent();
    consistent("u2");
  });

  it("concurrent buys never overdraw the wallet", async () => {
    await earn(1000);
    const results = await Promise.all(Array.from({ length: 6 }, () => buy("bag")));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.reason === "insufficient")).toHaveLength(3);
    expect((await getTicketBalance(db, "u1")).balance).toBe(100);
    expect(pending()).toHaveLength(3);
    consistent();
  });

  it("concurrent buys never pass the daily limit, and the losers get their tickets back", async () => {
    await earn(5000);
    // All six pass the pre-check and debit; the ledger guard lets two through
    const results = await Promise.all(Array.from({ length: 6 }, () => buy("chest")));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok && r.reason === "daily-limit")).toHaveLength(4);
    expect((await getTicketBalance(db, "u1")).balance).toBe(4800);
    expect(ledger().filter((r) => (r as { reason: string }).reason !== "earn")).toHaveLength(2);
    expect(pending()).toHaveLength(2);
    consistent();
  });

  it("a spend never counts toward the daily earn cap", async () => {
    for (let i = 0; i < 10; i++) await earn(5000); // today's 50,000
    expect(await buy("bag")).toEqual({ ok: true, balance: 49_700 });
    // A spend's negative delta must not reopen the cap
    expect(await earn(10)).toEqual({ balance: 49_700, accepted: 0, clamped: "daily" });
    consistent();
  });

  it("the game picks the purchase up on its next claim, once", async () => {
    await earn(1000);
    await buy("bag");
    await buy("chest");
    const allowance = { kind: "coins", welcome: 100, daily: 50 };
    const claim = () => claimAllowance(db, { userId: "u1", slug: "xu-vu-tru", allowance, now: NOW + 1 });
    expect((await claim()).grants).toEqual([
      { kind: "coins", amount: 100, type: "welcome" },
      { kind: "coins", amount: 500, type: "shop", itemId: "bag" },
      { kind: "coins", amount: 2000, type: "shop", itemId: "chest" },
    ]);
    expect((await claim()).grants).toEqual([]);
    expect(pending().every((p) => (p as { claimed_at: number }).claimed_at === NOW + 1)).toBe(true);
  });

  it("a deleted player's purchases go with them", async () => {
    await earn(1000);
    await buy("bag");
    sqlite.run("delete from user where id = 'u1'");
    expect(pending()).toEqual([]);
    expect(ledger()).toEqual([]);
  });
});

describe("listShop", () => {
  const game = (slug: string, shop?: ShopItem[]) =>
    ({ slug, title: { vi: slug, en: slug }, shop }) as unknown as GameManifest;
  const catalogue = [game("xu-vu-tru", SHOP), game("caro"), game("xep-tang", [])];

  it("lists games with a shop and today's remaining limits", async () => {
    await earn(1000);
    await buy("chest");
    const list = await listShop(db, { userId: "u1", now: NOW, catalogue });
    expect(list.map((g) => g.slug)).toEqual(["xu-vu-tru"]);
    expect(list[0].items.map((i) => [i.id, i.remaining])).toEqual([
      ["bag", null],
      ["chest", 1],
    ]);
    // Tomorrow, or another player, or signed out: the full limit
    expect((await listShop(db, { userId: "u1", now: vn(2026, 11, 12), catalogue }))[0].items[1].remaining).toBe(2);
    expect((await listShop(db, { userId: "u2", now: NOW, catalogue }))[0].items[1].remaining).toBe(2);
    expect((await listShop(db, { userId: null, now: NOW, catalogue }))[0].items[1].remaining).toBe(2);
  });
});
