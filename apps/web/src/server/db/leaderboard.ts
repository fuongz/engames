import { and, asc, count, desc, eq, gt, gte, like, lt, or, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { vnWeekStart } from "./allowance";
import { gameIdOf } from "./games";
import type * as schema from "./schema";
import { score, ticketLedger, user } from "./schema";
import { shopReason } from "./shop";

// SERVER-ONLY implementation behind server/leaderboard.ts. Takes the database as
// a parameter (D1 in the Worker, bun:sqlite in leaderboard.test.ts).

export type Db = BaseSQLiteDatabase<"sync" | "async", unknown, typeof schema>;

export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  detail: string | null;
  /** Unix seconds. */
  createdAt: number;
  image: string | null;
  signedIn: boolean;
  /** The player's account (link to /u/<userId>), or null for an anonymous run. */
  userId: string | null;
  /** Their profile is public: only then should the name link to it. False for anonymous runs. */
  profilePublic: boolean;
}

export async function topScores(db: Db, gameSlug: string, limit: number): Promise<LeaderboardEntry[]> {
  const gameId = await gameIdOf(db, gameSlug);
  const rows = await db
    .select({
      id: score.id,
      name: score.name,
      score: score.score,
      detail: score.detail,
      createdAt: score.createdAt,
      image: user.image,
      userId: score.userId,
      profilePublic: user.profilePublic,
    })
    .from(score)
    .leftJoin(user, eq(score.userId, user.id))
    .where(eq(score.gameId, gameId))
    // Ties go to whoever got there first
    .orderBy(desc(score.score), score.createdAt, score.id)
    .limit(limit);
  return rows.map(({ createdAt, profilePublic, ...r }) => ({
    ...r,
    createdAt: Math.floor(createdAt.getTime() / 1000),
    signedIn: r.userId !== null,
    profilePublic: r.userId !== null && profilePublic === true,
  }));
}

export interface SaveInput {
  /** The game, or an online board ("<slug>:<mode>"). */
  gameSlug: string;
  score: number;
  detail: string | null;
  name: string;
  userId: string | null;
}

export interface SaveResult {
  /** Row that now represents this player on the board (their best, if signed in). */
  id: number;
  best: number;
  improved: boolean;
  rank: number;
}

export async function saveScore(db: Db, input: SaveInput): Promise<SaveResult> {
  const { gameSlug, ...fields } = input;
  const gameId = await gameIdOf(db, gameSlug);
  const values = { ...fields, gameId };
  let id: number;
  let best = input.score;
  let improved = true;

  if (input.userId) {
    // Keep only the best run per player. In SQLite's upsert every right-hand
    // expression sees the OLD row, so the CASEs compare against the stored best.
    const [row] = await db
      .insert(score)
      .values(values)
      .onConflictDoUpdate({
        target: [score.gameId, score.userId],
        targetWhere: sql`user_id is not null`,
        set: {
          name: input.name,
          score: sql`max(${score.score}, excluded.score)`,
          detail: sql`case when excluded.score > ${score.score} then excluded.detail else ${score.detail} end`,
          createdAt: sql`case when excluded.score > ${score.score} then unixepoch() else ${score.createdAt} end`,
        },
      })
      .returning({ id: score.id, score: score.score });
    id = row.id;
    best = row.score;
    improved = best === input.score;
  } else {
    const [row] = await db.insert(score).values(values).returning({ id: score.id });
    id = row.id;
  }

  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(score)
    .where(and(eq(score.gameId, gameId), gt(score.score, best)));
  return { id, best, improved, rank: ahead + 1 };
}

// ---------------------------------------------------------------- Weekly ticket board

/** A week of a ticket game's board (docs/standards/tickets.md §5). */
export interface WeeklyBoard {
  /**
   * The top players by net tickets in this game this week (earned, less what
   * they spent on its Prize Counter items). Same shape as the all-time board:
   * `id` is the row's place (1, 2, …), `score` the net tickets, `createdAt`
   * (unix seconds) the player's last earning this week.
   */
  entries: LeaderboardEntry[];
  /**
   * The signed-in player's place and net tickets this week, and `id` of their
   * row in `entries` (null when they are below the top). Null when signed out or
   * when their net this week is 0 (nothing earned, or spent it all).
   */
  me: { rank: number; score: number; id: number | null } | null;
  /** When this week's board resets: next Monday 00:00 Asia/Ho_Chi_Minh, unix ms. */
  resetsAt: number;
}

const WEEK = 7 * 24 * 3_600_000;

/**
 * Net tickets in game `slug` since Monday 00:00 (Vietnam), per player: the sum
 * of its `earn` rows, minus the tickets spent on ITS Prize Counter items
 * (`shop:<slug>:<item>` rows), floored at 0. A player whose spends cover their
 * earnings is off the board until they earn again. Lucky Jar wins (`jackpot`),
 * hand adjustments and refunds never count, and a spend at another game's
 * counter never touches this board. Ties go to whoever got there first (the
 * earlier last earning). `me.rank` is 1 + the players strictly ahead, like
 * `saveScore`.
 */
export async function weeklyTicketBoard(
  db: Db,
  input: { slug: string; limit: number; userId: string | null; now: number },
): Promise<WeeklyBoard> {
  const { slug, limit, userId, now } = input;
  const gameId = await gameIdOf(db, slug);
  const weekStart = vnWeekStart(now);
  const earned = sql`${ticketLedger.reason} = 'earn'`;
  const week = db
    .select({
      userId: ticketLedger.userId,
      // Spends are negative rows; abs() keeps the subtraction right whatever the sign
      total: sql<number>`max(0, sum(case when ${earned} then ${ticketLedger.delta} else -abs(${ticketLedger.delta}) end))`.as(
        "total",
      ),
      last: sql<number | null>`max(case when ${earned} then ${ticketLedger.createdAt} end)`.as("last"),
    })
    .from(ticketLedger)
    .where(
      and(
        eq(ticketLedger.gameId, gameId),
        // Slugs are [a-z0-9-], so the prefix holds no LIKE wildcard
        or(eq(ticketLedger.reason, "earn"), like(ticketLedger.reason, `${shopReason(slug, "")}%`)),
        gte(ticketLedger.createdAt, weekStart),
        lt(ticketLedger.createdAt, weekStart + WEEK),
      ),
    )
    .groupBy(ticketLedger.userId)
    .as("week");

  const rows = await db
    .select({
      userId: week.userId,
      total: week.total,
      last: week.last,
      name: user.name,
      image: user.image,
      profilePublic: user.profilePublic,
    })
    .from(week)
    .innerJoin(user, eq(user.id, week.userId))
    // Net 0 (nothing earned, or all of it spent here) is not a place on the board
    .where(gt(week.total, 0))
    .orderBy(desc(week.total), asc(week.last), asc(week.userId))
    .limit(limit);
  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    id: i + 1,
    name: r.name,
    score: Number(r.total),
    detail: null,
    createdAt: Math.floor(Number(r.last) / 1000),
    image: r.image,
    signedIn: true,
    userId: r.userId,
    profilePublic: r.profilePublic,
  }));

  let me: WeeklyBoard["me"] = null;
  if (userId) {
    const mine = rows.findIndex((r) => r.userId === userId);
    const [own] = await db.select({ total: week.total }).from(week).where(eq(week.userId, userId));
    if (own && Number(own.total) > 0) {
      const [{ ahead }] = await db
        .select({ ahead: count() })
        .from(week)
        .where(gt(week.total, own.total));
      me = { rank: ahead + 1, score: Number(own.total), id: mine >= 0 ? mine + 1 : null };
    }
  }
  return { entries, me, resetsAt: weekStart + WEEK };
}
