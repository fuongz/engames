import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  type ClaimInput,
  claimAllowance,
  nextDailyAt,
  vnDay,
  vnWeekStart,
} from "./allowance";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";

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
const vn = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  Date.UTC(y, mo - 1, d, h - 7, mi, s, ms);

const COINS = { kind: "coins", welcome: 100, daily: 50 };
const WELCOME = { kind: "coins", amount: 100, type: "welcome" } as const;
const daily = (streakDay: number, amount = 50) =>
  ({ kind: "coins", amount, type: "daily", streakDay }) as const;

/** The whole answer: grants, next daily and streak. */
const claimFull = (now: number, over: Partial<ClaimInput> = {}) =>
  claimAllowance(db, {
    userId: "u1",
    slug: "xu-vu-tru",
    allowance: COINS,
    now,
    ...over,
  });
/** Just the grants. */
const claim = async (now: number, over: Partial<ClaimInput> = {}) =>
  (await claimFull(now, over)).grants;

const rows = () =>
  sqlite
    .query(
      "select a.user_id, g.slug, a.type, a.day, a.kind, a.amount from allowance_grant a join game g on g.id = a.game_id order by a.type desc, a.day",
    )
    .all();

describe("Vietnam days", () => {
  it("vnDay and nextDailyAt follow Asia/Ho_Chi_Minh, not UTC", () => {
    // 23:30 UTC on the 10th is 06:30 on the 11th in Vietnam
    expect(vnDay(Date.UTC(2026, 10, 10, 23, 30))).toBe("2026-11-11");
    // 16:59:59.999 UTC is still the 11th in Vietnam; 17:00 UTC is the 12th
    expect(vnDay(vn(2026, 11, 11, 23, 59, 59, 999))).toBe("2026-11-11");
    expect(vnDay(vn(2026, 11, 12))).toBe("2026-11-12");
    expect(nextDailyAt(vn(2026, 11, 11, 10))).toBe(vn(2026, 11, 12));
    expect(nextDailyAt(vn(2026, 11, 11, 23, 59, 59, 999))).toBe(vn(2026, 11, 12));
    // Exactly at midnight the next daily is a full day away
    expect(nextDailyAt(vn(2026, 11, 12))).toBe(vn(2026, 11, 13));
    expect(new Date(nextDailyAt(vn(2026, 11, 11, 10))).toISOString()).toBe(
      "2026-11-11T17:00:00.000Z",
    );
  });
});

describe("Vietnam weeks", () => {
  it("vnWeekStart is Monday 00:00 +07:00", () => {
    // Wednesday 11 November 2026
    expect(vnWeekStart(vn(2026, 11, 11, 10))).toBe(vn(2026, 11, 9));
    // Monday 00:00 sharp starts the week; Sunday 23:59:59.999 is the week before
    expect(vnWeekStart(vn(2026, 11, 9))).toBe(vn(2026, 11, 9));
    expect(vnWeekStart(vn(2026, 11, 15, 23, 59, 59, 999))).toBe(vn(2026, 11, 9));
    expect(vnWeekStart(vn(2026, 11, 16))).toBe(vn(2026, 11, 16));
    // 18:00 UTC on Sunday is already 01:00 Monday in Vietnam
    expect(vnWeekStart(Date.UTC(2026, 10, 15, 18))).toBe(vn(2026, 11, 16));
  });
});

describe("claimAllowance", () => {
  it("the first claim grants the welcome only", async () => {
    expect(await claim(vn(2026, 11, 11, 10))).toEqual([WELCOME]);
    expect(rows()).toEqual([
      { user_id: "u1", slug: "xu-vu-tru", type: "welcome", day: "first", kind: "coins", amount: 100 },
    ]);
  });

  it("a second claim the same Vietnam day grants nothing", async () => {
    await claim(vn(2026, 11, 11, 10));
    expect(await claim(vn(2026, 11, 11, 10, 5))).toEqual([]);
    expect(await claim(vn(2026, 11, 11, 23, 59, 59, 999))).toEqual([]);
    expect(rows()).toHaveLength(1);
  });

  it("the next Vietnam day grants the daily, once", async () => {
    await claim(vn(2026, 11, 11, 10));
    expect(await claim(vn(2026, 11, 12, 8))).toEqual([daily(1)]);
    expect(await claim(vn(2026, 11, 12, 20))).toEqual([]);
    expect(await claim(vn(2026, 11, 13, 0, 1))).toEqual([daily(2)]);
    // A skipped day is not paid back
    expect(await claim(vn(2026, 11, 16, 9))).toEqual([daily(1)]);
    expect(rows()).toMatchObject([
      { type: "welcome", day: "first" },
      { type: "daily", day: "2026-11-12", amount: 50 },
      { type: "daily", day: "2026-11-13" },
      { type: "daily", day: "2026-11-16" },
    ]);
  });

  it("the day turns at 00:00 +07:00, not at UTC midnight", async () => {
    await claim(vn(2026, 11, 11, 23, 59)); // welcome late on the 11th
    // 23:59:59.999 on the 11th: still the welcome day
    expect(await claim(vn(2026, 11, 11, 23, 59, 59, 999))).toEqual([]);
    // 00:00:00.000 on the 12th (17:00 UTC on the 11th): a new day
    expect(await claim(vn(2026, 11, 12))).toEqual([daily(1)]);
    expect(rows()[1]).toMatchObject({ day: "2026-11-12" });
    // UTC midnight (07:00 in Vietnam) changes nothing
    expect(await claim(Date.UTC(2026, 10, 12, 0, 0))).toEqual([]);
  });

  it("concurrent claims never grant twice", async () => {
    const first = await Promise.all(
      Array.from({ length: 8 }, () => claim(vn(2026, 11, 11, 10))),
    );
    expect(first.flat()).toEqual([WELCOME]);
    const next = await Promise.all(
      Array.from({ length: 8 }, () => claim(vn(2026, 11, 12, 10))),
    );
    expect(next.flat()).toEqual([daily(1)]);
    expect(rows()).toHaveLength(2);
  });

  it("keeps players and games apart", async () => {
    await claim(vn(2026, 11, 11, 10));
    expect(await claim(vn(2026, 11, 11, 10), { userId: "u2" })).toEqual([WELCOME]);
    expect(await claim(vn(2026, 11, 11, 10), { slug: "xep-tang" })).toEqual([WELCOME]);
    expect(rows()).toHaveLength(3);
  });

  it("refuses an unknown game (no allowance) and writes nothing, not even a game row", async () => {
    await expect(claim(vn(2026, 11, 11, 10), { slug: "nope", allowance: undefined })).rejects.toThrow(
      "no-allowance",
    );
    expect(rows()).toEqual([]);
    expect(sqlite.query("select count(*) n from game where slug = 'nope'").get()).toEqual({ n: 0 });
  });

  it("a zero welcome still starts the dailies", async () => {
    const free = { kind: "gems", welcome: 0, daily: 5 };
    expect(await claim(vn(2026, 11, 11, 10), { allowance: free })).toEqual([]);
    expect(await claim(vn(2026, 11, 12, 10), { allowance: free })).toEqual([
      { kind: "gems", amount: 5, type: "daily" as const, streakDay: 1 },
    ]);
  });

  it("the table refuses a malformed day", () => {
    sqlite.run("insert into game (slug) values ('g')");
    const put = (type: string, day: string) =>
      sqlite.run(
        `insert into allowance_grant (user_id, game_id, type, day, kind, amount, granted_at) values ('u1', 1, '${type}', '${day}', 'coins', 1, 0)`,
      );
    expect(() => put("welcome", "2026-11-11")).toThrow();
    expect(() => put("daily", "first")).toThrow();
    expect(() => put("daily", "11/11/2026")).toThrow();
    expect(() => put("bonus", "first")).toThrow();
    put("daily", "2026-11-11");
  });
});

describe("login streak", () => {
  const STREAK = { kind: "coins", welcome: 100, daily: 50, streak: [50, 60, 70, 80, 90, 100, 150] };
  const streakClaim = (now: number, over: Partial<ClaimInput> = {}) =>
    claimFull(now, { allowance: STREAK, ...over });

  it("consecutive days walk the streak; the welcome day is not a streak day", async () => {
    // The welcome day: no daily, so tomorrow is streak day 1
    expect(await streakClaim(vn(2026, 11, 11, 10))).toEqual({
      grants: [WELCOME],
      nextDailyAt: vn(2026, 11, 12),
      nextDailyAmount: 50,
      streakDay: 0,
    });
    const amounts = [50, 60, 70, 80, 90, 100, 150];
    for (let i = 0; i < amounts.length; i++) {
      const r = await streakClaim(vn(2026, 11, 12 + i, 9));
      expect(r.grants).toEqual([daily(i + 1, amounts[i])]);
      expect(r.streakDay).toBe(i + 1);
      expect(r.nextDailyAmount).toBe(amounts[(i + 1) % amounts.length]);
    }
  });

  it("the cycle restarts after the last entry", async () => {
    await streakClaim(vn(2026, 11, 1, 10));
    const got = [];
    for (let d = 2; d <= 17; d++) got.push(...(await streakClaim(vn(2026, 11, d, 12))).grants);
    expect(got.map((g) => g.amount)).toEqual([
      50, 60, 70, 80, 90, 100, 150, // days 1–7
      50, 60, 70, 80, 90, 100, 150, // days 8–14
      50, 60, // days 15–16
    ]);
    expect(got.map((g) => (g.type === "daily" ? g.streakDay : 0))).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  it("a missed day starts over at day 1", async () => {
    await streakClaim(vn(2026, 11, 11, 10));
    await streakClaim(vn(2026, 11, 12, 10)); // day 1
    await streakClaim(vn(2026, 11, 13, 10)); // day 2
    // The 14th is skipped
    const back = await streakClaim(vn(2026, 11, 15, 10));
    expect(back.grants).toEqual([daily(1, 50)]);
    expect(back.nextDailyAmount).toBe(60);
    expect(rows().map((r) => (r as { amount: number }).amount)).toEqual([100, 50, 60, 50]);
  });

  it("a repeat claim the same day grants nothing but still reports the streak", async () => {
    await streakClaim(vn(2026, 11, 11, 10));
    await streakClaim(vn(2026, 11, 12, 10));
    await streakClaim(vn(2026, 11, 13, 10));
    expect(await streakClaim(vn(2026, 11, 13, 22))).toEqual({
      grants: [],
      nextDailyAt: vn(2026, 11, 14),
      nextDailyAmount: 70,
      streakDay: 2,
    });
  });

  it("days turn at 00:00 +07:00", async () => {
    await streakClaim(vn(2026, 11, 11, 10));
    // The last millisecond of the 12th, then the first of the 13th: two streak days
    expect((await streakClaim(vn(2026, 11, 12, 23, 59, 59, 999))).grants).toEqual([daily(1, 50)]);
    expect((await streakClaim(vn(2026, 11, 13))).grants).toEqual([daily(2, 60)]);
    // UTC midnight (07:00 in Vietnam) is not a new day
    expect((await streakClaim(Date.UTC(2026, 10, 13, 0, 0))).grants).toEqual([]);
    expect((await streakClaim(vn(2026, 11, 14, 23, 59, 59, 999))).grants).toEqual([daily(3, 70)]);
    // Nothing on the 15th (Vietnam): 00:00 on the 16th breaks the run
    expect((await streakClaim(vn(2026, 11, 16))).grants).toEqual([daily(1, 50)]);
  });

  it("concurrent claims pay one streak daily", async () => {
    await streakClaim(vn(2026, 11, 11, 10));
    await streakClaim(vn(2026, 11, 12, 10));
    const racing = await Promise.all(Array.from({ length: 8 }, () => streakClaim(vn(2026, 11, 13, 10))));
    expect(racing.flatMap((r) => r.grants)).toEqual([daily(2, 60)]);
    for (const r of racing) expect(r).toMatchObject({ streakDay: 2, nextDailyAmount: 70 });
  });

  it("without a streak the daily is flat", async () => {
    await claimFull(vn(2026, 11, 11, 10));
    for (let d = 12; d <= 20; d++) {
      const r = await claimFull(vn(2026, 11, d, 10));
      expect(r.grants).toEqual([daily(d - 11)]);
      expect(r.nextDailyAmount).toBe(50);
    }
  });
});

describe("pending grants (Prize Counter purchases)", () => {
  const pend = (gameSlug: string, amount: number, userId = "u1") => {
    sqlite.run(`insert or ignore into game (slug) values ('${gameSlug}')`);
    sqlite.run(
      `insert into pending_grant (user_id, game_id, kind, amount, source, created_at)
       select '${userId}', id, 'coins', ${amount}, 'shop:pack', 0 from game where slug = '${gameSlug}'`,
    );
  };
  const unclaimed = () =>
    (sqlite.query("select count(*) n from pending_grant where claimed_at is null").get() as { n: number }).n;
  const shopGrant = (amount: number) => ({ kind: "coins", amount, type: "shop", itemId: "pack" }) as const;

  it("come back with the claim, once, even on the welcome day", async () => {
    await claim(vn(2026, 11, 11, 9)); // the welcome first, so the game row exists
    pend("xu-vu-tru", 500);
    pend("xu-vu-tru", 200);
    expect(await claim(vn(2026, 11, 11, 10))).toEqual([shopGrant(500), shopGrant(200)]);
    expect(await claim(vn(2026, 11, 11, 10, 1))).toEqual([]);
    expect(unclaimed()).toBe(0);
    // Stamped with the claim time
    expect(sqlite.query("select distinct claimed_at c from pending_grant").all()).toEqual([
      { c: vn(2026, 11, 11, 10) },
    ]);
  });

  it("arrive beside the daily", async () => {
    await claim(vn(2026, 11, 11, 9));
    pend("xu-vu-tru", 500);
    expect(await claim(vn(2026, 11, 12, 9))).toEqual([daily(1), shopGrant(500)]);
  });

  it("stay with their player and game", async () => {
    pend("xep-tang", 300);
    pend("xu-vu-tru", 400, "u2");
    expect(await claim(vn(2026, 11, 11, 10))).toEqual([WELCOME]);
    expect(unclaimed()).toBe(2);
    expect(await claim(vn(2026, 11, 11, 10), { userId: "u2" })).toEqual([WELCOME, shopGrant(400)]);
  });

  it("concurrent claims deliver each purchase exactly once", async () => {
    await claim(vn(2026, 11, 11, 9));
    for (let i = 1; i <= 5; i++) pend("xu-vu-tru", i * 100);
    const racing = await Promise.all(Array.from({ length: 8 }, () => claim(vn(2026, 11, 11, 10))));
    expect(racing.flat().map((g) => g.amount).sort((a, b) => a - b)).toEqual([100, 200, 300, 400, 500]);
    expect(unclaimed()).toBe(0);
  });
});
