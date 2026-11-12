import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  CHECKIN_MILESTONES,
  CHECKIN_REASON,
  CYCLE_LENGTH,
  type CheckinMilestone,
  addDays,
  cycleAmount,
  cycleIndex,
  milestoneAt,
  milestoneReason,
  nextDailyAt,
  vnDay,
  weekOf,
} from "#/lib/checkin";
import { PORTAL_SLUG, gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { dailyCheckin, ticketLedger, ticketWallet, user } from "./schema";

// SERVER-ONLY implementation behind server/checkin.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in checkin.test.ts).
// See docs/standards/checkin.md.

/** One cell of the 7-day calendar. */
export interface CheckinDay {
  /** 1 … 7: the cell's place in the cycle. */
  day: number;
  /** Tickets it pays. */
  amount: number;
  /** Day 7: the gold chest. */
  isChest: boolean;
  /** Already checked in (this cycle). */
  claimed: boolean;
}

export interface NextMilestone extends CheckinMilestone {
  /** Check-ins still needed from the current streak (0 when today's claim reaches it). */
  daysLeft: number;
}

export interface CheckinState {
  /** Today (Vietnam day) already has a check-in. */
  todayClaimed: boolean;
  /**
   * The live streak: today's streak day when `todayClaimed`; otherwise the run
   * today's check-in would continue (0 when it is broken or never started).
   */
  streakDay: number;
  /** 0 … 6: today's cell in `next7` (6 = the chest). */
  cycleIndex: number;
  /** The current 7-day cycle, cell by cell. */
  next7: CheckinDay[];
  /** What today's check-in pays (or paid). */
  todayAmount: number;
  /** No shield used yet in this Vietnam week (Monday 00:00 Asia/Ho_Chi_Minh). */
  shieldAvailableThisWeek: boolean;
  /** The day ("YYYY-MM-DD") this week's shield covered, when it was used. */
  shieldUsedOn?: string;
  /**
   * Not claimed yet today and yesterday was missed, but the shield will cover it:
   * the missed day ("YYYY-MM-DD"). Unset when nothing is at stake.
   */
  shieldWillCover?: string;
  /** The first milestone this player has never reached, or null when all are done. */
  nextMilestone: NextMilestone | null;
  /** Every day ever checked in (shielded days excluded). */
  totalCheckinDays: number;
  /** The next Vietnam midnight, unix ms: when the next check-in opens. */
  nextResetAt: number;
}

export interface CheckinClaim {
  /** This call checked in and paid. False when today was already claimed (or a racing call won). */
  claimed: boolean;
  /** Cycle tickets this call paid (0 when `claimed` is false). */
  amount: number;
  /** The milestone bonus this call paid, if it reached one for the first time ever. */
  milestone: CheckinMilestone | null;
  /** The missed day this call's shield covered, if it used one. */
  shieldUsed: string | null;
  /** The wallet balance after the claim. */
  balance: number;
  state: CheckinState;
}

interface Row {
  day: string;
  kind: "claim" | "shield";
  streakDay: number;
}

interface Totals {
  claims: number;
  /** Milestone days already paid. */
  paid: Set<number>;
}

/** The streak a check-in today would have, and the missed day a shield must cover for it. */
interface Plan {
  streakDay: number;
  shieldDay: string | null;
  /** The streak day the shield row holds (the run it keeps alive). */
  shieldStreak: number;
}

/**
 * The rows that decide today: today, yesterday, the day before, and every day
 * of yesterday's Vietnam week (its shield). Yesterday's Monday is at most 7 days
 * before today, so 8 days back covers all of it.
 */
async function readWindow(db: Db, userId: string, today: string): Promise<Map<string, Row>> {
  const rows = await db
    .select({ day: dailyCheckin.day, kind: dailyCheckin.kind, streakDay: dailyCheckin.streakDay })
    .from(dailyCheckin)
    .where(
      and(eq(dailyCheckin.userId, userId), gte(dailyCheckin.day, addDays(today, -8)), lte(dailyCheckin.day, today)),
    );
  return new Map(rows.map((r) => [r.day, { ...r, kind: r.kind === "shield" ? "shield" : "claim" }]));
}

/** Days ever checked in, and the milestone bonuses already paid (one statement). */
async function readTotals(db: Db, userId: string): Promise<Totals> {
  const prefix = milestoneReason(0).slice(0, -1); // "checkin:milestone:"
  const [row] = await db
    .select({
      claims: sql<number>`(select count(*) from ${dailyCheckin} where ${dailyCheckin.userId} = ${userId} and ${dailyCheckin.kind} = 'claim')`,
      paid: sql<
        string | null
      >`(select group_concat(${ticketLedger.reason}) from ${ticketLedger} where ${ticketLedger.userId} = ${userId} and ${ticketLedger.reason} like ${`${prefix}%`})`,
    })
    .from(user)
    .where(eq(user.id, userId));
  const paid = new Set(
    (row?.paid ?? "")
      .split(",")
      .filter((r) => r.startsWith(prefix))
      .map((r) => Number(r.slice(prefix.length))),
  );
  return { claims: Number(row?.claims ?? 0), paid };
}

/** The shield row in the Vietnam week holding `day`, if any. */
function shieldIn(rows: Map<string, Row>, day: string): Row | undefined {
  const { from, to } = weekOf(day);
  for (const r of rows.values()) if (r.kind === "shield" && r.day >= from && r.day <= to) return r;
  return undefined;
}

/**
 * The streak rules (docs/standards/checkin.md §3):
 * - yesterday has a row (a claim, or a shield): today continues it;
 * - only yesterday is missed, the day before was a real claim, and yesterday's
 *   Vietnam week has no shield row yet: the shield covers yesterday, today
 *   continues the run;
 * - anything else (2+ missed days, or the week's shield already used): day 1.
 */
function plan(rows: Map<string, Row>, today: string): Plan {
  const yesterday = addDays(today, -1);
  const y = rows.get(yesterday);
  if (y) return { streakDay: y.streakDay + 1, shieldDay: null, shieldStreak: 0 };
  const before = rows.get(addDays(today, -2));
  if (before?.kind === "claim" && !shieldIn(rows, yesterday))
    return { streakDay: before.streakDay + 1, shieldDay: yesterday, shieldStreak: before.streakDay };
  return { streakDay: 1, shieldDay: null, shieldStreak: 0 };
}

function stateFrom(rows: Map<string, Row>, totals: Totals, now: number): CheckinState {
  const today = vnDay(now);
  const mine = rows.get(today);
  const p = mine ? null : plan(rows, today);
  // Today's streak day: claimed, or what a claim now would be
  const todayDay = mine ? mine.streakDay : (p?.streakDay ?? 1);
  const streakDay = mine ? mine.streakDay : todayDay - 1;
  const index = cycleIndex(todayDay);
  const first = todayDay - index;
  const next7: CheckinDay[] = Array.from({ length: CYCLE_LENGTH }, (_, i) => ({
    day: i + 1,
    amount: cycleAmount(first + i),
    isChest: i === CYCLE_LENGTH - 1,
    claimed: i < index || (i === index && mine !== undefined),
  }));
  const shield = shieldIn(rows, today);
  const next = CHECKIN_MILESTONES.find((m) => !totals.paid.has(m.days));
  return {
    todayClaimed: mine !== undefined,
    streakDay,
    cycleIndex: index,
    next7,
    todayAmount: cycleAmount(todayDay),
    shieldAvailableThisWeek: shield === undefined,
    ...(shield ? { shieldUsedOn: shield.day } : {}),
    ...(p?.shieldDay ? { shieldWillCover: p.shieldDay } : {}),
    nextMilestone: next ? { ...next, daysLeft: Math.max(0, next.days - streakDay) } : null,
    totalCheckinDays: totals.claims,
    nextResetAt: nextDailyAt(now),
  };
}

/** The player's check-in calendar, streak and shield, as of `now` (unix ms). */
export async function readCheckin(db: Db, userId: string, now: number): Promise<CheckinState> {
  const [rows, totals] = await Promise.all([readWindow(db, userId, vnDay(now)), readTotals(db, userId)]);
  return stateFrom(rows, totals, now);
}

async function balanceOf(db: Db, userId: string): Promise<number> {
  const [w] = await db.select({ balance: ticketWallet.balance }).from(ticketWallet).where(eq(ticketWallet.userId, userId));
  return w?.balance ?? 0;
}

/** Insert one ledger row; when `once`, only if this player has never had a row with that reason. */
async function payLedger(db: Db, userId: string, gameId: number, delta: number, reason: string, now: number, once: boolean) {
  const [row] = await db
    .insert(ticketLedger)
    .select(
      db
        .select({
          // Every column, in order; NULL lets SQLite number the row
          id: sql<number>`null`.as("id"),
          userId: sql<string>`${userId}`.as("user_id"),
          gameId: sql<number>`${gameId}`.as("game_id"),
          delta: sql<number>`${delta}`.as("delta"),
          reason: sql<string>`${reason}`.as("reason"),
          createdAt: sql<number>`${now}`.as("created_at"),
        })
        .from(sql`(select 1)`)
        .where(
          once
            ? sql`not exists (select 1 from ${ticketLedger} where ${ticketLedger.userId} = ${userId} and ${ticketLedger.reason} = ${reason})`
            : sql`1`,
        ),
    )
    .returning({ delta: ticketLedger.delta });
  return row?.delta ?? 0;
}

/**
 * Check the player in for today (Vietnam day of `now`, unix ms) and pay the
 * cycle's tickets, plus a milestone bonus the first time ever the streak reaches
 * 7, 30 or 100. Returns what THIS call paid; a second call the same day pays
 * nothing and returns `claimed: false` with the current state.
 *
 * Race safety without transactions (D1), the allowance's pattern:
 * - TODAY is one `INSERT … ON CONFLICT DO NOTHING … RETURNING` on the primary key
 *   (user, day): of any number of racing claims exactly one row lands, and only
 *   the call that sees it returned pays. Racing claims all read the same past
 *   rows, so they agree on the streak day; the loser just pays nothing.
 * - The SHIELD is an `INSERT … SELECT … WHERE NOT EXISTS (a shield in that
 *   week)`, so a week can never hold two, and its key (user, missed day) turns a
 *   racing duplicate into a no-op. When the insert returns nothing the row is
 *   read again: a racer's shield for the same day continues the streak, anything
 *   else resets it.
 * - A MILESTONE bonus is an `INSERT … SELECT … WHERE NOT EXISTS (a ledger row
 *   with that reason)`: paid once per player, ever, even after a reset.
 *
 * Payment, then wallet (like depositTickets): the ledger rows are the record,
 * and the wallet upsert ADDS their total to `balance` only. `earned_total`, the
 * daily earn cap and the weekly board read `reason = 'earn'` rows, so a
 * check-in counts toward none of them. If the Worker dies after today's row
 * but before the ledger, that day is lost unpaid (checkin.md §4 finds it); it
 * can never be paid twice.
 */
export async function claimCheckin(db: Db, userId: string, now: number): Promise<CheckinClaim> {
  const today = vnDay(now);
  const [rows, totals] = await Promise.all([readWindow(db, userId, today), readTotals(db, userId)]);
  const unpaid = async (): Promise<CheckinClaim> => ({
    claimed: false,
    amount: 0,
    milestone: null,
    shieldUsed: null,
    balance: await balanceOf(db, userId),
    state: stateFrom(rows, totals, now),
  });
  if (rows.has(today)) return unpaid();

  let { streakDay, shieldDay, shieldStreak } = plan(rows, today);
  if (shieldDay) {
    const { from, to } = weekOf(shieldDay);
    const [landed] = await db
      .insert(dailyCheckin)
      .select(
        db
          .select({
            userId: sql<string>`${userId}`.as("user_id"),
            day: sql<string>`${shieldDay}`.as("day"),
            kind: sql<string>`'shield'`.as("kind"),
            streakDay: sql<number>`${shieldStreak}`.as("streak_day"),
            amount: sql<number>`0`.as("amount"),
            createdAt: sql<number>`${now}`.as("created_at"),
          })
          .from(sql`(select 1)`)
          .where(
            sql`not exists (select 1 from ${dailyCheckin} where ${dailyCheckin.userId} = ${userId} and ${dailyCheckin.kind} = 'shield' and ${dailyCheckin.day} between ${from} and ${to})`,
          ),
      )
      .onConflictDoNothing()
      .returning({ day: dailyCheckin.day });
    if (!landed) {
      // A racing claim may have written the same shield: then the streak still holds
      const [again] = await db
        .select({ kind: dailyCheckin.kind, streakDay: dailyCheckin.streakDay })
        .from(dailyCheckin)
        .where(and(eq(dailyCheckin.userId, userId), eq(dailyCheckin.day, shieldDay)));
      if (again?.kind === "shield") rows.set(shieldDay, { day: shieldDay, kind: "shield", streakDay: again.streakDay });
      else {
        streakDay = 1;
        shieldDay = null;
      }
    } else rows.set(shieldDay, { day: shieldDay, kind: "shield", streakDay: shieldStreak });
  }

  const amount = cycleAmount(streakDay);
  const [mine] = await db
    .insert(dailyCheckin)
    .values({ userId, day: today, kind: "claim", streakDay, amount, createdAt: now })
    .onConflictDoNothing()
    .returning({ streakDay: dailyCheckin.streakDay });
  if (!mine) {
    // A racing claim landed today's row first: it pays, this call does not
    const fresh = await readWindow(db, userId, today);
    return { ...(await unpaid()), state: stateFrom(fresh, await readTotals(db, userId), now) };
  }
  rows.set(today, { day: today, kind: "claim", streakDay });
  totals.claims += 1;

  const gameId = await gameIdOf(db, PORTAL_SLUG);
  let paid = await payLedger(db, userId, gameId, amount, CHECKIN_REASON, now, false);
  const reached = milestoneAt(streakDay);
  let milestone: CheckinMilestone | null = null;
  if (reached && !totals.paid.has(reached.days)) {
    const bonus = await payLedger(db, userId, gameId, reached.bonus, milestoneReason(reached.days), now, true);
    if (bonus > 0) {
      milestone = reached;
      paid += bonus;
    }
    totals.paid.add(reached.days);
  }

  // The wallet: add to the balance only, never to earned_total
  const [wallet] = await db
    .insert(ticketWallet)
    .values({ userId, balance: paid, earnedTotal: 0, updatedAt: now })
    .onConflictDoUpdate({
      target: ticketWallet.userId,
      set: { balance: sql`${ticketWallet.balance} + excluded.balance`, updatedAt: sql`excluded.updated_at` },
    })
    .returning({ balance: ticketWallet.balance });

  return {
    claimed: true,
    amount,
    milestone,
    shieldUsed: shieldDay,
    balance: wallet?.balance ?? paid,
    state: stateFrom(rows, totals, now),
  };
}
