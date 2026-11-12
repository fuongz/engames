import type { OnlineMode, ServerMessage, Vec } from "./online/protocol";
import type { RoomSetting } from "./online/room-game";
import type { AudioBus } from "./audio";
import type { Locale, Localized } from "./i18n";
import type { GameStorage } from "./storage";

export type GameCategory =
  | "hanh-dong"
  | "chien-thuat"
  | "tri-tue"
  | "the-thao"
  | "arcade"
  | "phieu-luu";

export interface GameManifest {
  /** URL segment and storage namespace. Must match the folder name. */
  slug: string;
  title: Localized<string>;
  tagline: Localized<string>;
  description: Localized<string>;
  /** One line per control hint, shown on the game page. Wrap a key in brackets to show it as a key cap: `[J]`, `[Space]`, `[↓→]` (an arrow motion is one key per arrow). */
  controls: Localized<string[]>;
  category: GameCategory;
  tags: Localized<string[]>;
  /** 3:4 key art with the title baked in, one per language (import the assets). */
  poster: Localized<string>;
  /** 2:1 key art without text, for hero banners; keep the left side calm for the title. */
  banner: string;
  /**
   * 1200x630 JPEG link preview (Facebook, X, Zalo, Messenger): the banner with
   * the title, made by `bun run art`. Import `./share.jpg`.
   */
  share: string;
  /**
   * "landscape" games ask phones to rotate (and lock orientation where the
   * browser allows). Defaults to portrait.
   */
  orientation?: "portrait" | "landscape";
  /** Logical resolution of the game; the player keeps this aspect ratio. */
  width: number;
  height: number;
  /** ISO date, used for "new" ordering. */
  releasedAt: string;
  inspiredBy?: Localized<string>;
  /**
   * Playable online too: the game has an `online.ts` adapter registered in
   * `online/registry.ts` (see docs/standards/online-multiplayer.md).
   */
  online?: {
    modes: OnlineMode[];
    minPlayers: number;
    maxPlayers: number;
    /** The host's lobby choices; the same list as the adapter's `settings` (a test keeps them equal). */
    settings?: RoomSetting[];
    /**
     * Empty seats are played by the computer. Co-op games always fill with bots;
     * a versus game sets this when it does too (Ludo, a property game).
     */
    bots?: boolean;
  };
  /**
   * Progress lives on the player's account (`GameContext.cloud`), so the portal
   * asks guests to sign in before mounting. The game also ships a `save.ts`
   * the server checks every save against (see saves.ts).
   */
  requiresAccount?: boolean;
  /** How many separate saves an account keeps for this game (default 1). */
  saveSlots?: number;
  /**
   * Accepts portal coupons (docs/standards/coupons.md): `kinds` are the reward
   * kinds the game knows how to grant, e.g. ["coins"]. Rewards of any other kind
   * are dropped before redemption.
   */
  coupons?: { kinds: string[] };
  /**
   * The game's own version, semver ("1.4.0"). Shown as a small "v1.4.0" on the
   * game page and handed to the game as `GameContext.version`. Bump it with
   * changes a player would notice.
   */
  version?: string;
  /**
   * Keeps progress on the account when the player is signed in, but stays
   * playable signed out (local storage only). Signed in, the portal provides
   * `GameContext.cloud` exactly as for `requiresAccount` games, with the same
   * server checks (the game ships a `save.ts`) and conflict handling.
   */
  accountSave?: boolean;
  /**
   * A server-granted allowance (docs/standards/allowance.md): `welcome` once per
   * account, then `daily` once per Vietnam day, both of currency `kind` (e.g.
   * "coins"). Signed-in players get `GameContext.allowance`.
   *
   * `streak` (optional) replaces the flat `daily` with a login streak: on the
   * n-th consecutive Vietnam day with a daily grant the player gets
   * `streak[(n - 1) % streak.length]`. A missed day starts over at day 1; the
   * welcome day is not a streak day.
   */
  allowance?: {
    kind: string;
    welcome: number;
    daily: number;
    streak?: number[];
  };
  /**
   * Pays out into the shared arcade ticket wallet (docs/standards/tickets.md).
   * Signed-in players get `GameContext.tickets`.
   */
  tickets?: boolean;
  /**
   * Feeds and rolls for the shared arcade Lucky Jar, "Hũ may mắn"
   * (docs/standards/jackpot.md). The game gets `GameContext.jackpot`.
   */
  jackpot?: boolean;
  /**
   * Items the portal's Prize Counter sells for shared arcade tickets
   * (docs/standards/tickets.md §4). A bought item reaches the game through
   * `ctx.allowance.claim()` as a `{ type: "shop" }` grant, so a game with a shop
   * must also declare `allowance`.
   */
  shop?: ShopItem[];
  /** Permanent skins sold by an in-game shop for shared tickets. */
  cosmetics?: CosmeticItem[];
  /**
   * What changed in each release, NEWEST FIRST (docs/standards/changelog.md).
   * Shown as "Update history" on the game page and on the site-wide /changelog.
   * When `version` is set it must equal `changelog[0].version`: every release
   * bumps `version` and adds an entry dated the release day (a test checks it).
   */
  changelog?: ChangelogEntry[];
}

/** One release of a game, as players read it. */
export interface ChangelogEntry {
  /** Semver, matching `manifest.version` for the newest entry ("1.3.0"). */
  version: string;
  /** The release day, ISO `YYYY-MM-DD` (Vietnam calendar). */
  date: string;
  /** An optional headline for the release ("Lucky Jar"). */
  title?: Localized<string>;
  /** One line per change a player would notice; at least one in each language. */
  changes: Localized<string[]>;
}

/** One Prize Counter item: `amount` of the game's currency `kind`, for `price` tickets. */
export interface ShopItem {
  /** Stable id, unique in the game: it names the purchase in the ledger. Never rename one. */
  id: string;
  /** What the player sees in the Prize Counter. */
  name: Localized<string>;
  /** The game-defined currency granted, e.g. "coins". */
  kind: string;
  amount: number;
  /** In shared arcade tickets. */
  price: number;
  /** How many one player may buy per Vietnam day (unlimited when missing). */
  dailyLimit?: number;
}

/**
 * Storage key a game may write its one-line best result to, as a
 * `Localized<string>` (e.g. `{ vi: "Kỷ lục 3400 điểm", en: "Best 3400 pts" }`).
 * The portal shows it on game cards. Older saves hold a plain Vietnamese string;
 * read it with `summaryText`.
 */
export const SUMMARY_KEY = "summary";

/** Pick a stored summary for a locale, accepting the pre-i18n plain-string form. */
export function summaryText(stored: unknown, locale: Locale): string | null {
  if (typeof stored === "string") return stored;
  if (
    stored &&
    typeof stored === "object" &&
    typeof (stored as Localized<string>)[locale] === "string"
  ) {
    return (stored as Localized<string>)[locale];
  }
  return null;
}

/** A finished run, offered to the portal's leaderboard. */
export interface ScoreReport {
  score: number;
  /** Short game-specific context shown next to the score, e.g. "Đợt 12". */
  detail?: string;
}

export interface GameContext {
  storage: GameStorage;
  /** Account inventory and permanent cosmetic purchases, including read-only state online. */
  cosmetics?: GameCosmetics;
  audio: AudioBus;
  /**
   * Call once when a run ends (game over / round complete), never on quit.
   * Optional so a game still runs outside the portal.
   */
  reportScore?(report: ScoreReport): void;
  /**
   * The player's current language. Read it when drawing (it can change while the
   * game is running) and report `detail` in it. Optional so a game still runs
   * outside the portal; treat a missing one as DEFAULT_LOCALE.
   */
  locale?(): Locale;
  /**
   * Set when this mount is an online match. The game must not step its own
   * simulation then: it sends inputs and draws what the room sends back.
   */
  online?: OnlineMatch;
  /**
   * The signed-in player's save slots, for `requiresAccount` and `accountSave`
   * games. Missing when nobody is signed in (or outside the portal); an
   * `accountSave` game must then fall back to `storage`.
   */
  cloud?: CloudSave;
  /**
   * The portal's coupon redeem dialog, for games with `manifest.coupons`. Missing
   * otherwise, outside the portal, and always in an online match: coupons never
   * apply there (the room owns the state).
   */
  coupons?: GameCoupons;
  /** `manifest.version`, when the game declares one. */
  version?: string;
  /**
   * The daily allowance, for games with `manifest.allowance`. Missing when nobody
   * is signed in, outside the portal, and always in an online match.
   */
  allowance?: GameAllowance;
  /**
   * The player's shared arcade ticket wallet, for games with `manifest.tickets`.
   * Missing when nobody is signed in, outside the portal, and always in an
   * online match.
   */
  tickets?: GameTickets;
  /**
   * The shared arcade Lucky Jar, for games with `manifest.jackpot`. Present
   * signed out too (`state` and `onState` work; `contribute` does nothing and
   * `roll` rejects). Missing outside the portal and always in an online match.
   */
  jackpot?: GameJackpot;
}

/**
 * One payout the server just recorded: the welcome, a daily (with its login
 * streak day, 1-based), or a Prize Counter purchase (`itemId` of `manifest.shop`).
 */
export type AllowanceGrant =
  | { type: "welcome"; kind: string; amount: number }
  | { type: "daily"; kind: string; amount: number; streakDay: number }
  | { type: "shop"; kind: string; amount: number; itemId: string };

export interface AllowanceClaim {
  grants: AllowanceGrant[];
  /** The next Vietnam midnight (unix ms): when the next daily is due. */
  nextDailyAt: number;
  /** What the next daily will pay if the player claims it on time (keeps the streak). */
  nextDailyAmount: number;
  /** Today's login streak day (1-based), or 0 when today has no daily (the welcome day). */
  streakDay: number;
}

export interface GameAllowance {
  /**
   * Ask the server for whatever is due now: the welcome once per account, then
   * one daily per Vietnam day (the first daily comes the Vietnam day after the
   * welcome), plus every Prize Counter purchase for this game not yet delivered.
   * `grants` is empty when nothing is due; `nextDailyAt` is the next Vietnam
   * midnight (unix ms), for a countdown.
   *
   * The server has ALREADY recorded every grant it returns, and will never send
   * it again: persist it IMMEDIATELY (storage or cloud save), before anything
   * else can go wrong.
   */
  claim(): Promise<AllowanceClaim>;
}

export interface GameTickets {
  /** The wallet's current balance (shared by every ticket game). */
  balance(): Promise<number>;
  /**
   * Earn `amount` tickets (a positive integer). The portal batches calls for a
   * couple of seconds and sends them together; the promise settles when the
   * server answers. `accepted` can be less than `amount` when a cap applies.
   */
  deposit(amount: number): Promise<{ balance: number; accepted: number }>;
  /** Called with the new balance whenever it changes; returns an unsubscribe. */
  onBalance(cb: (balance: number) => void): () => void;
}

/** One past Lucky Jar win, as everyone sees it. */
export interface JackpotWinner {
  /** The winner's first name (at most 12 characters); the portal's "a player" when nothing safe can be shown. */
  name: string;
  /** Tickets won. */
  amount: number;
  /** The game it was won in. */
  gameSlug: string;
  /** Unix ms. */
  wonAt: number;
}

/** What one roll did. */
export interface JackpotRoll {
  won: boolean;
  /** Tickets paid into the shared wallet; only when `won`. */
  amount?: number;
  /** The pool after the roll (back at the seed after a win). */
  pool: number;
}

export interface GameJackpot {
  /**
   * Feed the jar `coins` of the game's own coins (a positive integer): each adds
   * 2 tickets to the shared pool, up to a daily cap per player per game. Paid by
   * the house, not the player. Batched by the portal; a no-op signed out.
   */
  contribute(coins: number): void;
  /**
   * Roll once for the whole pool (a few rolls per player per day; over the limit
   * it resolves `won: false`). A win is already in the player's ticket wallet
   * when this resolves. Rejects with "sign-in-required" when signed out.
   */
  roll(): Promise<JackpotRoll>;
  /** The pool, its cap and the latest winners (newest first). Works signed out. */
  state(): Promise<{ pool: number; cap: number; recent: JackpotWinner[] }>;
  /** Called whenever the pool or cap changes; returns an unsubscribe. Works signed out. */
  onState(cb: (s: { pool: number; cap: number }) => void): () => void;
}

/** One reward a coupon carries. `kind` is game-defined, e.g. "coins". */
export interface CouponReward {
  kind: string;
  amount: number;
}

/** A redeemed coupon: only the rewards of the kinds this game accepts. */
export interface CouponGrant {
  code: string;
  rewards: CouponReward[];
}

export interface GameCoupons {
  /** Show the portal's redeem dialog (the player must be signed in). */
  open(): void;
  /**
   * Called once per successful redemption; returns an unsubscribe. The server
   * has already marked the code used, so persist the grant IMMEDIATELY (storage
   * or cloud save): a grant lost to a reload is never sent again.
   */
  onGrant(cb: (grant: CouponGrant) => void): () => void;
}

/** A saved game on the server: the game's own data plus a version for conflicts. */
export interface CloudSlot {
  data: unknown;
  /** Bumped by every save; 0 means "never saved". */
  version: number;
}

export type CloudSaveResult =
  | { ok: true; version: number }
  /** Another device saved first: `current` is what the server holds now. */
  | { ok: false; conflict: CloudSlot };

/**
 * The player's saves for this game, kept by the portal's server: `saveSlots`
 * numbered slots (0, 1, ...), each with its own data and version.
 */
export interface CloudSave {
  /** The player's display name. */
  player: string;
  /** The player's account id, to key any local backup to the right person. */
  playerId: string;
  /** Every slot that holds a save. */
  list(): Promise<(CloudSlot & { slot: number })[]>;
  load(slot: number): Promise<CloudSlot | null>;
  /**
   * Store `data` in `slot` if the server still holds `version` (optimistic
   * concurrency). `score` also files the player's best on the leaderboard, which
   * keeps the best of all slots.
   */
  save(
    slot: number,
    data: unknown,
    version: number,
    score?: ScoreReport,
  ): Promise<CloudSaveResult>;
  /** Empty `slot` for good (start over). */
  remove(slot: number): Promise<void>;
}

/** The game's side of an online match; the portal owns the socket behind it. */
export interface OnlineMatch {
  /** This client's seat in the simulation. */
  seat: number;
  seats: { seat: number; name: string }[];
  seed: number;
  /** Simulation steps per second (inputs go out at this rate). */
  tickRate: number;
  /** The host's lobby choices for this match (see RoomGame.settings). */
  settings: Record<string, string>;
  /** This input tick's move and actions. */
  send(input: { seq: number; move: Vec; actions: unknown[] }): void;
  /** Match messages from the room (`snap`, `ev`, `end`); returns an unsubscribe. */
  onMessage(fn: (m: ServerMessage) => void): () => void;
  /** After `end`: leave the match screen and return to the room's lobby. */
  backToLobby(): void;
}

export interface GameInstance {
  destroy(): void;
  pause?(): void;
  resume?(): void;
}

/** What every `src/<slug>/index.ts` must default-export. */
export interface GameModule {
  mount(root: HTMLElement, ctx: GameContext): GameInstance;
}

/** A permanent cosmetic, purchased once with the shared ticket wallet. Free items are always owned. */
export interface CosmeticItem {
  id: string;
  name: Localized<string>;
  price: number;
}
export interface CosmeticInventory {
  signedIn: boolean;
  balance: number | null;
  owned: string[];
  equipped: string;
}
export type CosmeticBuyResult = {
  ok: boolean;
  reason?: "insufficient" | "already-owned" | "unknown-item";
  inventory: CosmeticInventory;
};
export interface GameCosmetics {
  signIn?(): Promise<void>;
  state(): Promise<CosmeticInventory>;
  buy(itemId: string): Promise<CosmeticBuyResult>;
  equip(itemId: string): Promise<CosmeticInventory>;
}
