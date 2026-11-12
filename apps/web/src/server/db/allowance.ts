import type { AllowanceClaim, AllowanceGrant, GameManifest } from "@web-games/core";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { nextDailyAt, vnDay, vnDayStart } from "#/lib/checkin";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { allowanceGrant, pendingGrant } from "./schema";

// SERVER-ONLY implementation behind server/allowance.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in allowance.test.ts).
// See docs/standards/allowance.md.

// The Vietnam clock lives in lib/checkin.ts (pure, shared with the check-in and
// the UI); re-exported here so existing importers keep working.
export { nextDailyAt, vnDay, vnDayStart, vnWeekStart } from "#/lib/checkin";

/** The `day` of a welcome row: one per player per game, ever. */
export const WELCOME_DAY = "first";

/** What the daily pays on login-streak day `n` (1-based). */
export function dailyAmount(
  allowance: NonNullable<GameManifest["allowance"]>,
  n: number,
): number {
  const { streak } = allowance;
  if (!streak || streak.length === 0) return allowance.daily;
  return streak[(Math.max(n, 1) - 1) % streak.length] ?? 0;
}

interface Streak {
  /** Today already has a daily row. */
  today: boolean;
  /** Consecutive daily days ending today (when `today`) or yesterday (when not). */
  run: number;
}

/**
 * The login streak, read from the daily rows themselves (no extra table).
 *
 * Gaps-and-islands: number the player's dailies newest first (rn = 1, 2, …).
 * Dates are unique per player and game (the primary key), so the rows of an
 * unbroken run ending today sit exactly `rn − 1` days before today, and those of
 * a run ending yesterday exactly `rn` days before; the first gap pushes every
 * older row further back, so counting the matches counts the run and nothing
 * after it. One indexed read of at most one row per day ever played.
 */
async function readStreak(db: Db, userId: string, gameId: number, today: string): Promise<Streak> {
  const [row] = await db
    .select({
      today: sql<number | null>`sum(day = ${today})`,
      runToday: sql<number | null>`sum(julianday(${today}) - julianday(day) = rn - 1)`,
      runYesterday: sql<number | null>`sum(julianday(${today}) - julianday(day) = rn)`,
    })
    .from(
      sql`(select day, row_number() over (order by day desc) as rn from ${allowanceGrant}
           where user_id = ${userId} and game_id = ${gameId} and type = 'daily' and day <= ${today})`,
    );
  const hasToday = (row?.today ?? 0) > 0;
  return { today: hasToday, run: Number((hasToday ? row?.runToday : row?.runYesterday) ?? 0) };
}

export interface ClaimInput {
  userId: string;
  slug: string;
  /** The game's `manifest.allowance`; undefined for an unknown or non-allowance game. */
  allowance: GameManifest["allowance"];
  /** Unix ms. */
  now: number;
}

/**
 * Grant whatever is due for this player in this game, and return ONLY the grants
 * this call created (an empty list when nothing is due).
 *
 * - The WELCOME is granted on the very first claim, alone. The first DAILY comes
 *   the next Vietnam day. Granting both at once would hand a new player
 *   welcome + daily for the same moment, which reads as one bigger welcome and
 *   makes the daily feel like nothing new; starting the dailies tomorrow gives
 *   the player a reason to come back.
 * - After that, one DAILY per Vietnam day (00:00 Asia/Ho_Chi_Minh). With
 *   `allowance.streak`, the daily on the n-th consecutive Vietnam day with a
 *   daily pays `streak[(n − 1) % streak.length]`: the cycle restarts after the
 *   last entry, a missed day starts over at day 1, and the welcome day is not a
 *   streak day (it has no daily row). See `readStreak`.
 * - Every Prize Counter purchase for this game not delivered yet comes back as a
 *   `shop` grant, and is stamped claimed in the same statement.
 *
 * Race safety without transactions: each grant is ONE `INSERT … ON CONFLICT DO
 * NOTHING … RETURNING`, so of any number of concurrent calls exactly one row
 * lands per primary key (user, game, type, day), and only the call whose insert
 * landed sees it returned. The daily insert is an `INSERT … SELECT … WHERE
 * EXISTS (a welcome granted before today's Vietnam midnight)`, so the "no daily
 * on the welcome day" rule is checked in the same statement that writes the
 * row: a concurrent first claim that loses the welcome race cannot slip a daily
 * in, because the winner's welcome is dated today.
 *
 * The streak amount is read just before that insert. Only TODAY's row can be
 * written concurrently, and its key makes the race a no-op for the loser, so the
 * run before today (what decides the amount) cannot change underneath it.
 *
 * Pending purchases are claimed by ONE `UPDATE … SET claimed_at WHERE claimed_at
 * IS NULL … RETURNING`: a row flips once, so of two racing claims exactly one
 * gets each purchase.
 *
 * Throws `no-allowance` (writing nothing, not even a `game` row) when the game has
 * no allowance: the boundary validates first, this is the second fence.
 */
export async function claimAllowance(
  db: Db,
  input: ClaimInput,
): Promise<AllowanceClaim> {
  const { userId, slug, allowance, now } = input;
  if (!allowance) throw new Error("no-allowance");
  const gameId = await gameIdOf(db, slug);
  const grants: AllowanceGrant[] = [];

  // Written even for a zero welcome: the dailies key off this row
  const [welcome] = await db
    .insert(allowanceGrant)
    .values({
      userId,
      gameId,
      type: "welcome",
      day: WELCOME_DAY,
      kind: allowance.kind,
      amount: allowance.welcome,
      grantedAt: now,
    })
    .onConflictDoNothing()
    .returning({ amount: allowanceGrant.amount });
  if (welcome && welcome.amount > 0)
    grants.push({ kind: allowance.kind, amount: welcome.amount, type: "welcome" });

  const today = vnDay(now);
  let streak: Streak = { today: false, run: 0 };
  if (allowance.daily > 0 || (allowance.streak?.length ?? 0) > 0) {
    streak = await readStreak(db, userId, gameId, today);
    const streakDay = streak.run + 1;
    const amount = dailyAmount(allowance, streakDay);
    const daily = streak.today
      ? [] // already granted today: nothing to write
      : await db
          .insert(allowanceGrant)
          .select(
            db
              .select({
                userId: sql<string>`${userId}`.as("user_id"),
                gameId: sql<number>`${gameId}`.as("game_id"),
                type: sql<string>`'daily'`.as("type"),
                day: sql<string>`${today}`.as("day"),
                kind: sql<string>`${allowance.kind}`.as("kind"),
                amount: sql<number>`${amount}`.as("amount"),
                grantedAt: sql<number>`${now}`.as("granted_at"),
              })
              .from(allowanceGrant)
              // The welcome row itself is the "from": no welcome before today, no daily
              .where(
                and(
                  eq(allowanceGrant.userId, userId),
                  eq(allowanceGrant.gameId, gameId),
                  eq(allowanceGrant.type, "welcome"),
                  lt(allowanceGrant.grantedAt, vnDayStart(now)),
                ),
              ),
          )
          .onConflictDoNothing()
          .returning({ amount: allowanceGrant.amount });
    if (daily[0]) {
      streak = { today: true, run: streakDay };
      if (daily[0].amount > 0)
        grants.push({ kind: allowance.kind, amount: daily[0].amount, type: "daily", streakDay });
    } else if (!streak.today) {
      // The welcome day, or a racing claim just wrote today's row: read it again
      streak = await readStreak(db, userId, gameId, today);
    }
  }

  // Prize Counter purchases: each row flips to claimed exactly once
  const bought = await db
    .update(pendingGrant)
    .set({ claimedAt: now })
    .where(
      and(
        eq(pendingGrant.userId, userId),
        eq(pendingGrant.gameId, gameId),
        isNull(pendingGrant.claimedAt),
      ),
    )
    .returning({
      id: pendingGrant.id,
      kind: pendingGrant.kind,
      amount: pendingGrant.amount,
      source: pendingGrant.source,
    });
  for (const b of bought.sort((a, z) => a.id - z.id))
    grants.push({ kind: b.kind, amount: b.amount, type: "shop", itemId: b.source.replace(/^shop:/, "") });

  return {
    grants,
    nextDailyAt: nextDailyAt(now),
    // Tomorrow continues today's run; without a daily today (the welcome day) it is day 1
    nextDailyAmount: dailyAmount(allowance, streak.today ? streak.run + 1 : 1),
    streakDay: streak.today ? streak.run : 0,
  };
}
