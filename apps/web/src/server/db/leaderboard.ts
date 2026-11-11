import { and, asc, count, desc, eq, gt, gte, lt, max, sql, sum } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { vnWeekStart } from "./allowance";
import { gameIdOf } from "./games";
import type * as schema from "./schema";
import { score, ticketLedger, user } from "./schema";

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
    })
    .from(score)
    .leftJoin(user, eq(score.userId, user.id))
    .where(eq(score.gameId, gameId))
    // Ties go to whoever got there first
    .orderBy(desc(score.score), score.createdAt, score.id)
    .limit(limit);
  return rows.map(({ userId, createdAt, ...r }) => ({
    ...r,
    createdAt: Math.floor(createdAt.getTime() / 1000),
    signedIn: userId !== null,
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
   * The top players by tickets earned in this game this week. Same shape as the
   * all-time board: `id` is the row's place (1, 2, …), `score` the tickets,
   * `createdAt` (unix seconds) the player's last earning this week.
   */
  entries: LeaderboardEntry[];
  /**
   * The signed-in player's place and tickets this week, and `id` of their row in
   * `entries` (null when they are below the top). Null when signed out or when
   * they have earned nothing in this game this week.
   */
  me: { rank: number; score: number; id: number | null } | null;
  /** When this week's board resets: next Monday 00:00 Asia/Ho_Chi_Minh, unix ms. */
  resetsAt: number;
}

const WEEK = 7 * 24 * 3_600_000;

/**
 * Tickets EARNED in game `slug` since Monday 00:00 (Vietnam), per player: the sum
 * of `ticket_ledger` rows with `reason = 'earn'`. Spends (`shop:…`), Lucky Jar
 * wins (`jackpot`) and hand adjustments never count. Ties go to whoever got
 * there first (the earlier last earning). `me.rank` is 1 + the players strictly ahead, like `saveScore`.
 */
export async function weeklyTicketBoard(
  db: Db,
  input: { slug: string; limit: number; userId: string | null; now: number },
): Promise<WeeklyBoard> {
  const { slug, limit, userId, now } = input;
  const gameId = await gameIdOf(db, slug);
  const weekStart = vnWeekStart(now);
  const week = db
    .select({
      userId: ticketLedger.userId,
      total: sql<number>`${sum(ticketLedger.delta)}`.as("total"),
      last: max(ticketLedger.createdAt).as("last"),
    })
    .from(ticketLedger)
    .where(
      and(
        eq(ticketLedger.gameId, gameId),
        eq(ticketLedger.reason, "earn"),
        gte(ticketLedger.createdAt, weekStart),
        lt(ticketLedger.createdAt, weekStart + WEEK),
      ),
    )
    .groupBy(ticketLedger.userId)
    .as("week");

  const rows = await db
    .select({ userId: week.userId, total: week.total, last: week.last, name: user.name, image: user.image })
    .from(week)
    .innerJoin(user, eq(user.id, week.userId))
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
