import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./leaderboard";
import { gameSave } from "./schema";

// SERVER-ONLY implementation behind server/saves.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in saves.test.ts).

/** The game's save as JSON text (the server only stores it) and its version. */
export interface StoredSave {
  json: string;
  version: number;
}

export type WriteResult =
  | { ok: true; version: number }
  | { ok: false; conflict: StoredSave };

export async function readSave(
  db: Db,
  userId: string,
  gameSlug: string,
): Promise<StoredSave | null> {
  const [row] = await db
    .select({ json: gameSave.data, version: gameSave.version })
    .from(gameSave)
    .where(and(eq(gameSave.userId, userId), eq(gameSave.gameSlug, gameSlug)))
    .limit(1);
  return row ?? null;
}

/**
 * Store `data` only if the slot still holds version `expected` (0: no save yet),
 * so a second device working from an older copy gets a conflict instead of
 * silently overwriting the newer one.
 */
export async function writeSave(
  db: Db,
  input: { userId: string; gameSlug: string; json: string; expected: number },
): Promise<WriteResult> {
  const { json } = input;
  const where = and(
    eq(gameSave.userId, input.userId),
    eq(gameSave.gameSlug, input.gameSlug),
  );
  if (input.expected === 0) {
    const made = await db
      .insert(gameSave)
      .values({
        userId: input.userId,
        gameSlug: input.gameSlug,
        data: json,
        version: 1,
      })
      .onConflictDoNothing()
      .returning({ version: gameSave.version });
    if (made.length) return { ok: true, version: 1 };
  } else {
    const next = input.expected + 1;
    const updated = await db
      .update(gameSave)
      .set({ data: json, version: next, updatedAt: sql`(unixepoch())` })
      .where(and(where, eq(gameSave.version, input.expected)))
      .returning({ version: gameSave.version });
    if (updated.length) return { ok: true, version: next };
  }
  return {
    ok: false,
    conflict: (await readSave(db, input.userId, input.gameSlug)) ?? {
      json: "null",
      version: 0,
    },
  };
}
