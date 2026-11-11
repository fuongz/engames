import type { AllowanceGrant, GameManifest } from "@web-games/core";
import { and, eq, lt, sql } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { allowanceGrant } from "./schema";

// SERVER-ONLY implementation behind server/allowance.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in allowance.test.ts).
// See docs/standards/allowance.md.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Asia/Ho_Chi_Minh is UTC+7 all year (no daylight saving). */
const VN_OFFSET = 7 * HOUR;

/** The `day` of a welcome row: one per player per game, ever. */
export const WELCOME_DAY = "first";

/** Unix ms of the Vietnam midnight that starts the Vietnam day holding `now`. */
export function vnDayStart(now: number): number {
  return Math.floor((now + VN_OFFSET) / DAY) * DAY - VN_OFFSET;
}

/** The Vietnam date holding `now`, "YYYY-MM-DD". */
export function vnDay(now: number): string {
  return new Date(now + VN_OFFSET).toISOString().slice(0, 10);
}

/** The next Vietnam midnight after `now`, unix ms: when the next daily is due. */
export function nextDailyAt(now: number): number {
  return vnDayStart(now) + DAY;
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
 * - After that, one DAILY per Vietnam day (00:00 Asia/Ho_Chi_Minh).
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
 * Throws `no-allowance` (writing nothing, not even a `game` row) when the game has
 * no allowance: the boundary validates first, this is the second fence.
 */
export async function claimAllowance(
  db: Db,
  input: ClaimInput,
): Promise<AllowanceGrant[]> {
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

  if (allowance.daily > 0) {
    const today = vnDay(now);
    const daily = await db
      .insert(allowanceGrant)
      .select(
        db
          .select({
            userId: sql<string>`${userId}`.as("user_id"),
            gameId: sql<number>`${gameId}`.as("game_id"),
            type: sql<string>`'daily'`.as("type"),
            day: sql<string>`${today}`.as("day"),
            kind: sql<string>`${allowance.kind}`.as("kind"),
            amount: sql<number>`${allowance.daily}`.as("amount"),
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
    if (daily[0])
      grants.push({ kind: allowance.kind, amount: daily[0].amount, type: "daily" });
  }

  return grants;
}
