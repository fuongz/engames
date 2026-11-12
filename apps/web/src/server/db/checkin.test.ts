import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { CHECKIN_CYCLE, addDays, cycleAmount, vnDay, weekOf } from "#/lib/checkin";
import { claimCheckin, readCheckin } from "./checkin";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import { weeklyTicketBoard } from "./leaderboard";
import * as schema from "./schema";
import { depositTickets, getTicketBalance } from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, like allowance.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

let sqlite: Database;
let db: Db;

beforeEach(() => {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint"))
      if (stmt.trim()) sqlite.run(stmt);
  sqlite.run("insert into user (id, name, email) values ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn')");
  db = drizzle(sqlite, { schema }) as unknown as Db;
});

/** A Vietnam wall-clock time as unix ms (UTC+7). */
const vn = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => Date.UTC(y, mo - 1, d, h - 7, mi, s, ms);
/** Noon (Vietnam) on 2026-11-09 (a Monday) + `n` days. */
const day = (n: number, h = 12) => vn(2026, 11, 9 + n, h);

const claim = (now: number, userId = "u1") => claimCheckin(db, userId, now);

const rows = () =>
  sqlite.query("select day, kind, streak_day, amount from daily_checkin where user_id = 'u1' order by day").all() as {
    day: string;
    kind: string;
    streak_day: number;
    amount: number;
  }[];

const ledger = () =>
  sqlite.query("select g.slug, l.delta, l.reason from ticket_ledger l join game g on g.id = l.game_id where l.user_id = 'u1' order by l.id").all() as {
    slug: string;
    delta: number;
    reason: string;
  }[];

const wallet = () =>
  sqlite.query("select balance, earned_total from ticket_wallet where user_id = 'u1'").get() as {
    balance: number;
    earned_total: number;
  } | null;

/** Claim on consecutive days `from` … `to` (inclusive). */
async function streak(from: number, to: number) {
  for (let n = from; n <= to; n++) await claim(day(n));
}

describe("lib/checkin clock", () => {
  it("weeks start on Monday in Vietnam", () => {
    expect(weekOf("2026-11-09")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(weekOf("2026-11-15")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(weekOf("2026-11-16").from).toBe("2026-11-16");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("a full week buys the cheapest Prize Counter item (300)", () => {
    expect(CHECKIN_CYCLE.reduce((a, b) => a + b, 0)).toBe(300);
  });
});

describe("claimCheckin", () => {
  it("pays day 1 on the first claim, and nothing on a second claim the same day", async () => {
    const first = await claim(day(0));
    expect(first).toMatchObject({ claimed: true, amount: 20, milestone: null, shieldUsed: null, balance: 20 });
    expect(first.state).toMatchObject({ todayClaimed: true, streakDay: 1, cycleIndex: 0, totalCheckinDays: 1, todayAmount: 20 });
    expect(first.state.next7.map((c) => c.claimed)).toEqual([true, false, false, false, false, false, false]);
    expect(first.state.next7[6]).toMatchObject({ day: 7, amount: 100, isChest: true });

    const again = await claim(day(0, 23));
    expect(again).toMatchObject({ claimed: false, amount: 0, balance: 20 });
    expect(rows()).toEqual([{ day: "2026-11-09", kind: "claim", streak_day: 1, amount: 20 }]);
  });

  it("continues on consecutive days and wraps the cycle at day 8", async () => {
    await streak(0, 6);
    expect(rows().map((r) => r.amount)).toEqual([...CHECKIN_CYCLE]);
    const eighth = await claim(day(7));
    expect(eighth).toMatchObject({ claimed: true, amount: 20 });
    expect(eighth.state).toMatchObject({ streakDay: 8, cycleIndex: 0 });
    expect(eighth.state.next7.filter((c) => c.claimed)).toHaveLength(1);
    expect(rows().at(-1)).toMatchObject({ streak_day: 8, amount: 20 });
  });

  it("covers one missed day with the week's shield and keeps counting", async () => {
    await streak(0, 1); // Mon, Tue
    // Wednesday missed; Thursday's claim uses the shield
    const thu = await claim(day(3));
    expect(thu).toMatchObject({ claimed: true, shieldUsed: "2026-11-11", amount: cycleAmount(3) });
    expect(rows()).toEqual([
      { day: "2026-11-09", kind: "claim", streak_day: 1, amount: 20 },
      { day: "2026-11-10", kind: "claim", streak_day: 2, amount: 25 },
      { day: "2026-11-11", kind: "shield", streak_day: 2, amount: 0 },
      { day: "2026-11-12", kind: "claim", streak_day: 3, amount: 30 },
    ]);
    expect(thu.state).toMatchObject({ streakDay: 3, shieldAvailableThisWeek: false, shieldUsedOn: "2026-11-11", totalCheckinDays: 3 });
  });

  it("before claiming, the state says the shield will cover yesterday", async () => {
    await streak(0, 1);
    const s = await readCheckin(db, "u1", day(3));
    expect(s).toMatchObject({ todayClaimed: false, streakDay: 2, cycleIndex: 2, todayAmount: 30, shieldWillCover: "2026-11-11", shieldAvailableThisWeek: true });
    expect(rows()).toHaveLength(2); // reading writes nothing
  });

  it("a second miss in the same week resets to day 1", async () => {
    await streak(0, 1);
    await claim(day(3)); // shield covers Wed
    await claim(day(4)); // Fri, day 4
    // Saturday missed, shield already used this week
    const sun = await claim(day(6));
    expect(sun).toMatchObject({ claimed: true, amount: 20, shieldUsed: null });
    expect(sun.state).toMatchObject({ streakDay: 1, shieldAvailableThisWeek: false });
    expect(rows().filter((r) => r.kind === "shield")).toHaveLength(1);
  });

  it("a new week brings a new shield", async () => {
    await streak(0, 1);
    await claim(day(3)); // shield used on Wed of week 1
    await streak(4, 7); // Fri … next Mon
    // Next Tuesday missed: a new week, so a new shield
    const wed = await claim(day(9));
    expect(wed.shieldUsed).toBe("2026-11-17");
    // Mon 1, Tue 2, (Wed shielded), Thu 3 … next Mon 7, (Tue shielded), Wed 8
    expect(wed.state.streakDay).toBe(8);
  });

  it("the missed day's week decides: a Sunday miss uses last week's shield", async () => {
    await streak(0, 1);
    await claim(day(3)); // week 1's shield used (Wed)
    await streak(4, 5); // Fri, Sat
    // Sunday (week 1) missed, Monday (week 2) claims: week 1 has no shield left
    const mon = await claim(day(7));
    expect(mon).toMatchObject({ shieldUsed: null, amount: 20 });
    expect(mon.state.streakDay).toBe(1);
  });

  it("a 2-day gap resets, even with the shield unused", async () => {
    await streak(0, 2); // Mon … Wed
    const sat = await claim(day(5)); // Thu and Fri missed
    expect(sat).toMatchObject({ amount: 20, shieldUsed: null });
    expect(sat.state).toMatchObject({ streakDay: 1, shieldAvailableThisWeek: true });
    expect(rows().some((r) => r.kind === "shield")).toBe(false);
  });

  it("pays the 7-day milestone once per player, ever", async () => {
    await streak(0, 5);
    const seventh = await claim(day(6));
    expect(seventh).toMatchObject({ claimed: true, amount: 100, milestone: { days: 7, bonus: 100, badge: "streak-7" } });
    expect(seventh.balance).toBe(300 + 100);
    expect(seventh.state.nextMilestone).toMatchObject({ days: 30, daysLeft: 23 });

    // Break the streak (2-day gap) and reach day 7 again: no second bonus
    await streak(9, 15);
    expect(rows().at(-1)).toMatchObject({ streak_day: 7 });
    expect(ledger().filter((l) => l.reason === "checkin:milestone:7")).toHaveLength(1);
  });

  it("two racing claims pay once", async () => {
    await streak(0, 1);
    const now = day(3); // also races the shield
    const results = await Promise.all([claim(now), claim(now), claim(now)]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect(rows().filter((r) => r.day === "2026-11-12")).toHaveLength(1);
    expect(rows().filter((r) => r.kind === "shield")).toHaveLength(1);
    expect(ledger().filter((l) => l.reason === "checkin")).toHaveLength(3);
    expect(wallet()?.balance).toBe(20 + 25 + 30);
  });

  it("follows the Vietnam midnight, not UTC", async () => {
    await claim(vn(2026, 11, 9, 23, 59, 59, 999));
    // One ms later is the next Vietnam day (16:59:59.999 → 17:00 UTC)
    const next = await claim(vn(2026, 11, 10, 0, 0, 0, 0));
    expect(next).toMatchObject({ claimed: true, amount: 25 });
    expect(rows().map((r) => r.day)).toEqual(["2026-11-09", "2026-11-10"]);
    expect(vnDay(vn(2026, 11, 10))).toBe("2026-11-10");
    expect(next.state.nextResetAt).toBe(vn(2026, 11, 11));
  });

  it("keeps the ledger and the wallet in step, on the portal row, never as earnings", async () => {
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 500, now: day(0, 8) });
    await streak(0, 6);
    const l = ledger();
    expect(l.filter((r) => r.reason.startsWith("checkin")).every((r) => r.slug === "portal")).toBe(true);
    const sum = l.reduce((a, r) => a + r.delta, 0);
    expect(sum).toBe(500 + 300 + 100);
    expect(wallet()).toEqual({ balance: sum, earned_total: 500 });
    expect(await getTicketBalance(db, "u1")).toEqual({ balance: 900, earnedTotal: 500 });
  });

  it("check-in tickets count toward neither the daily earn cap nor the weekly board", async () => {
    await streak(0, 6); // 400 tickets of check-in
    // The game's cap is untouched: a full 5,000 deposit still goes in whole
    const dep = await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 5_000, now: day(6, 13) });
    expect(dep).toMatchObject({ accepted: 5_000, clamped: null });
    const board = await weeklyTicketBoard(db, { slug: "xu-vu-tru", limit: 10, userId: "u1", now: day(6, 14) });
    expect(board.entries.map((e) => e.score)).toEqual([5_000]);
    // The portal row has no board at all
    const portal = await weeklyTicketBoard(db, { slug: "portal", limit: 10, userId: "u1", now: day(6, 14) });
    expect(portal.entries).toEqual([]);
  });

  it("refuses a hand-written row of the wrong shape", () => {
    expect(() =>
      sqlite.run("insert into daily_checkin (user_id, day, kind, streak_day, amount, created_at) values ('u1', '2026-11-09', 'bonus', 1, 0, 0)"),
    ).toThrow();
    expect(() =>
      sqlite.run("insert into daily_checkin (user_id, day, kind, streak_day, amount, created_at) values ('u1', 'today', 'claim', 1, 20, 0)"),
    ).toThrow();
    expect(() =>
      sqlite.run("insert into daily_checkin (user_id, day, kind, streak_day, amount, created_at) values ('u1', '2026-11-09', 'shield', 1, 20, 0)"),
    ).toThrow();
  });
});
