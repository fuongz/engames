import { and, desc, eq } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { favorite, game } from "./schema";

// SERVER-ONLY implementation behind server/favorites.ts.

/** A player's favourite games, most recently added first. */
export async function favoritesOf(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: game.slug })
    .from(favorite)
    .innerJoin(game, eq(game.id, favorite.gameId))
    .where(eq(favorite.userId, userId))
    .orderBy(desc(favorite.createdAt), desc(game.slug));
  return rows.map((r) => r.slug);
}

export async function setFavorite(db: Db, userId: string, gameSlug: string, on: boolean) {
  const gameId = await gameIdOf(db, gameSlug);
  if (on) await db.insert(favorite).values({ userId, gameId }).onConflictDoNothing();
  else await db.delete(favorite).where(and(eq(favorite.userId, userId), eq(favorite.gameId, gameId)));
}
