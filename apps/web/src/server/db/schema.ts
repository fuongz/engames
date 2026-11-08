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

// ---------------------------------------------------------------- Play counts

/** How many times each game was started, across every player (shown as "1.2K plays"). */
export const gameStat = sqliteTable("game_stat", {
  gameSlug: text("game_slug").primaryKey(),
  plays: integer("plays").notNull().default(0),
});

// ---------------------------------------------------------------- Online match history

/**
 * A signed-in player's answer to "save my online match history?". No row means
 * they haven't been asked yet; only `enabled` players get their matches kept.
 */
export const historyConsent = sqliteTable("history_consent", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** A finished online match that at least one consenting player took part in. */
export const onlineMatch = sqliteTable(
  "online_match",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameSlug: text("game_slug").notNull(),
    /** "coop" | "versus". */
    mode: text("mode").notNull(),
    roomCode: text("room_code").notNull(),
    /** The room's settings as JSON, e.g. {"bestOf":"5"}. */
    settings: text("settings").notNull().default("{}"),
    /** When the room posted it (ms); with the room code, makes a replayed post a no-op. */
    postedAt: integer("posted_at").notNull(),
    playedAt: integer("played_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("online_match_post_uq").on(t.roomCode, t.postedAt)],
);

/**
 * Everyone in a saved match. `user_id` is set only for players who agreed to keep
 * their history; everyone else (guests too) is just a name, so the match reads
 * right ("won 2–1 against Bình") without saving anything for them.
 */
export const onlineMatchPlayer = sqliteTable(
  "online_match_player",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => onlineMatch.id, { onDelete: "cascade" }),
    seat: integer("seat").notNull(),
    name: text("name").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    score: integer("score").notNull(),
    detail: text("detail"),
    /** "win" | "loss" | "draw", or null when the game doesn't say. */
    outcome: text("outcome"),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.seat] }), index("online_match_player_user_idx").on(t.userId, t.matchId)],
);

// ---------------------------------------------------------------- Favourites

/** A signed-in player's favourite games (the heart on a game page). */
export const favorite = sqliteTable(
  "favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameSlug: text("game_slug").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameSlug] })],
);
