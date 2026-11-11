import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The runtime schema — the ONE thing you hand-edit. Change it, then:
//   bun run db:generate        # writes SQL into ./drizzle
//   bun run db:migrate:local   # wrangler applies it
//
// ⚠️ Never create, edit or delete a file under `drizzle/`. Those are generated
// migrations with a ledger D1 keeps server-side; hand-editing one that has already
// been applied leaves the ledger and the database describing different things, and
// nothing tells you until a later migration fails on a column that isn't there.
// The one exception is a NEW, not-yet-applied migration that has to carry data
// across a table rebuild (0007, see docs/standards/database.md).

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

// ---------------------------------------------------------------- Games

/**
 * One row per game slug the database has ever seen, so every other table refers
 * to a game by `game_id` instead of repeating its slug. Rows are never written by
 * hand: `gameIdOf` (db/games.ts) inserts a slug the first time it is used, so a
 * new game needs no migration. Online leaderboards ("<slug>:<mode>",
 * `boardKey`) get their own row too. See docs/standards/database.md.
 */
export const game = sqliteTable("game", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type GameRow = typeof game.$inferSelect;

const gameId = () => integer("game_id").references(() => game.id);

// ---------------------------------------------------------------- Leaderboard

/**
 * One row per signed-in player per game (their best, upserted), or one row per
 * anonymous submission (name typed at game over, no identity to merge on).
 */
export const score = sqliteTable(
  "score",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** The game, or an online board ("<slug>:<mode>"). */
    gameId: gameId().notNull(),
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
    index("score_game_rank_idx").on(t.gameId, t.score),
    // Partial unique index: the upsert target for signed-in players. Anonymous
    // rows (user_id NULL) are never merged.
    uniqueIndex("score_game_user_uq").on(t.gameId, t.userId).where(sql`user_id is not null`),
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
    gameId: gameId().notNull(),
    /** Which of the game's `saveSlots` this is (0 for single-save games). */
    slot: integer("slot").notNull().default(0),
    data: text("data").notNull(),
    version: integer("version").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId, t.slot] })],
);

export type GameSaveRow = typeof gameSave.$inferSelect;

// ---------------------------------------------------------------- Play counts

/** How many times each game was started, across every player (shown as "1.2K plays"). */
export const gameStat = sqliteTable("game_stat", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => game.id),
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
    gameId: gameId().notNull(),
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
    gameId: gameId().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

// ---------------------------------------------------------------- Coupons

/**
 * A code the admin mints by hand in D1 (docs/standards/coupons.md). `game_id`
 * null means any game that accepts coupons; `rewards` is a JSON array of
 * {kind, amount}. Times are unix ms. The CHECKs reject a hand-written row that
 * could never be redeemed (lowercase, spaces or dashes in the code, bad JSON).
 */
export const coupon = sqliteTable(
  "coupon",
  {
    /** Uppercase, no spaces or dashes: what `normalizeCode` turns input into. */
    code: text("code").primaryKey(),
    gameId: gameId(),
    rewards: text("rewards").notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: integer("expires_at"),
    disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
    /** Admin's memo, e.g. "Tết 2027 fanpage giveaway". */
    note: text("note"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  () => [
    check("coupon_code_shape", sql`code = upper(code) and instr(code, ' ') = 0 and instr(code, '-') = 0`),
    check("coupon_rewards_array", sql`json_valid(rewards) and json_type(rewards) = 'array'`),
  ],
);

/**
 * Who redeemed which code, and what they got (the rewards after filtering to the
 * game's kinds). One row per code per player is what makes a code single-use per
 * player. Disable a coupon rather than delete it: these rows reference it.
 */
export const couponRedemption = sqliteTable(
  "coupon_redemption",
  {
    code: text("code")
      .notNull()
      .references(() => coupon.code),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The game it was redeemed in. */
    gameId: gameId().notNull(),
    rewards: text("rewards").notNull(),
    redeemedAt: integer("redeemed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.code, t.userId] }), index("coupon_redemption_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------- Allowance

/**
 * Every allowance payout (docs/standards/allowance.md). The primary key is the
 * guard: a welcome (`day` = "first") can exist once per player per game, and a
 * daily once per Vietnam day (`day` = "YYYY-MM-DD" in Asia/Ho_Chi_Minh). Delete a
 * player's rows to reset them. Times are unix ms.
 */
export const allowanceGrant = sqliteTable(
  "allowance_grant",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: gameId().notNull(),
    /** "welcome" | "daily". */
    type: text("type").notNull(),
    /** "first" for the welcome, the Vietnam date for a daily. */
    day: text("day").notNull(),
    /** The currency granted (`manifest.allowance.kind`), for reading the table by hand. */
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    grantedAt: integer("granted_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId, t.type, t.day] }),
    check(
      "allowance_grant_day_shape",
      sql`(type = 'welcome' and day = 'first') or (type = 'daily' and day glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
  ],
);

// ---------------------------------------------------------------- Arcade tickets

/**
 * One ticket balance per player, shared by every game with `manifest.tickets`
 * (docs/standards/tickets.md). A running total kept in step with `ticket_ledger`
 * by `depositTickets`. `updated_at` is unix ms.
 */
export const ticketWallet = sqliteTable("ticket_wallet", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  /** Every ticket ever earned, never lowered by spending. */
  earnedTotal: integer("earned_total").notNull().default(0),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Every change to a wallet, newest last: the audit trail, and what the daily
 * earn cap and the weekly board are summed from. `reason` is "earn" (a game paid
 * out), "shop:<slug>:<itemId>" (a Prize Counter purchase, negative delta), or a
 * hand-written one ("adjust", "refund:…"). `created_at` is unix ms.
 */
export const ticketLedger = sqliteTable(
  "ticket_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: gameId().notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("ticket_ledger_user_time_idx").on(t.userId, t.createdAt),
    // The weekly board: one game's rows since Monday
    index("ticket_ledger_game_time_idx").on(t.gameId, t.createdAt),
  ],
);

/**
 * Something bought for a game that the game has not picked up yet
 * (docs/standards/tickets.md §4). `buyItem` writes it after the ticket spend;
 * the game's next `ctx.allowance.claim()` delivers it and stamps `claimed_at`
 * (unix ms; NULL = still waiting). `source` is "shop:<itemId>"; `ledger_id` is
 * the spend that paid for it, so a purchase can be audited and refunded.
 */
export const pendingGrant = sqliteTable(
  "pending_grant",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: gameId().notNull(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    source: text("source").notNull(),
    ledgerId: integer("ledger_id").references(() => ticketLedger.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    claimedAt: integer("claimed_at"),
  },
  (t) => [
    // What claimAllowance looks for: one player's undelivered grants in one game
    index("pending_grant_unclaimed_idx")
      .on(t.userId, t.gameId)
      .where(sql`claimed_at is null`),
    uniqueIndex("pending_grant_ledger_idx").on(t.ledgerId),
  ],
);
