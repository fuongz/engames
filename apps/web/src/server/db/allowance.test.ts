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
const DAILY = { kind: "coins", amount: 50, type: "daily" } as const;

const claim = (now: number, over: Partial<ClaimInput> = {}) =>
  claimAllowance(db, {
    userId: "u1",
    slug: "xu-vu-tru",
    allowance: COINS,
    now,
    ...over,
  });

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
    expect(await claim(vn(2026, 11, 12, 8))).toEqual([DAILY]);
    expect(await claim(vn(2026, 11, 12, 20))).toEqual([]);
    expect(await claim(vn(2026, 11, 13, 0, 1))).toEqual([DAILY]);
    // A skipped day is not paid back
    expect(await claim(vn(2026, 11, 16, 9))).toEqual([DAILY]);
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
    expect(await claim(vn(2026, 11, 12))).toEqual([DAILY]);
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
    expect(next.flat()).toEqual([DAILY]);
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
      { kind: "gems", amount: 5, type: "daily" as const },
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
