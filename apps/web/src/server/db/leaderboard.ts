import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";
import { score, user } from "./schema";

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
    .where(eq(score.gameSlug, gameSlug))
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
  let id: number;
  let best = input.score;
  let improved = true;

  if (input.userId) {
    // Keep only the best run per player. In SQLite's upsert every right-hand
    // expression sees the OLD row, so the CASEs compare against the stored best.
    const [row] = await db
      .insert(score)
      .values(input)
      .onConflictDoUpdate({
        target: [score.gameSlug, score.userId],
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
    const [row] = await db.insert(score).values(input).returning({ id: score.id });
    id = row.id;
  }

  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(score)
    .where(and(eq(score.gameSlug, input.gameSlug), gt(score.score, best)));
  return { id, best, improved, rank: ahead + 1 };
}
