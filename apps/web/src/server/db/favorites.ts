import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./leaderboard";
import { favorite } from "./schema";

// SERVER-ONLY implementation behind server/favorites.ts.

/** A player's favourite games, most recently added first. */
export async function favoritesOf(db: Db, userId: string): Promise<string[]> {
  const rows = await db.select({ slug: favorite.gameSlug }).from(favorite).where(eq(favorite.userId, userId)).orderBy(desc(favorite.createdAt), desc(favorite.gameSlug));
  return rows.map((r) => r.slug);
}

export async function setFavorite(db: Db, userId: string, gameSlug: string, on: boolean) {
  if (on) await db.insert(favorite).values({ userId, gameSlug }).onConflictDoNothing();
  else await db.delete(favorite).where(and(eq(favorite.userId, userId), eq(favorite.gameSlug, gameSlug)));
}
