import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The runtime schema — the ONE thing you hand-edit. Change it, then:
//   bun run db:generate        # writes SQL into ./drizzle
//   bun run db:migrate:local   # wrangler applies it
//
// ⚠️ Never create, edit or delete a file under `drizzle/`. Those are generated
// migrations with a ledger D1 keeps server-side; hand-editing one that has already
// been applied leaves the ledger and the database describing different things, and
// nothing tells you until a later migration fails on a column that isn't there.

// ---------------------------------------------------------------- Better Auth
// Field names and types mirror Better Auth's core tables (@better-auth/core
// getAuthTables); the drizzle adapter maps them by these JS property names.

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  /** Preferred UI language ("vi" | "en"), a Better Auth additional field. Null until first synced. */
  locale: text("locale"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------- Leaderboard

/**
 * One row per signed-in player per game (their best, upserted), or one row per
 * anonymous submission (name typed at game over, no identity to merge on).
 */
export const score = sqliteTable(
  "score",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameSlug: text("game_slug").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    score: integer("score").notNull(),
    /** Game-specific one-liner, e.g. "Đợt 12" or "3★, 10/10". */
    detail: text("detail"),
    // Unix epoch seconds, so it compares and sorts in SQL.
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("score_game_rank_idx").on(t.gameSlug, t.score),
    // Partial unique index: the upsert target for signed-in players. Anonymous
    // rows (user_id NULL) are never merged.
    uniqueIndex("score_game_user_uq").on(t.gameSlug, t.userId).where(sql`user_id is not null`),
  ],
);

export type ScoreRow = typeof score.$inferSelect;

// ---------------------------------------------------------------- Saved games

/**
 * One save slot per signed-in player per game, for games whose progress lives
 * on the account (`requiresAccount`). `data` is the game's own JSON, checked by
 * its `save.ts` rules before it gets here; `version` is bumped on every write so
 * two devices can't silently overwrite each other.
 */
export const gameSave = sqliteTable(
  "game_save",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameSlug: text("game_slug").notNull(),
    /** Which of the game's `saveSlots` this is (0 for single-save games). */
    slot: integer("slot").notNull().default(0),
    data: text("data").notNull(),
    version: integer("version").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameSlug, t.slot] })],
);

export type GameSaveRow = typeof gameSave.$inferSelect;
