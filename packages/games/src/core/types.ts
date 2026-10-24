import type { OnlineMode, ServerMessage, Vec } from "../online/protocol";
import type { AudioBus } from "./audio";
import type { Locale, Localized } from "./i18n";
import type { GameStorage } from "./storage";

export type GameCategory =
  | "hanh-dong"
  | "chien-thuat"
  | "tri-tue"
  | "the-thao"
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
  online?: { modes: OnlineMode[]; minPlayers: number; maxPlayers: number };
  /**
   * Progress lives on the player's account (`GameContext.cloud`), so the portal
   * asks guests to sign in before mounting. The game also ships a `save.ts`
   * the server checks every save against (see saves.ts).
   */
  requiresAccount?: boolean;
  /** How many separate saves an account keeps for this game (default 1). */
  saveSlots?: number;
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
   * The signed-in player's save slot, for `requiresAccount` games. Missing when
   * nobody is signed in (or outside the portal).
   */
  cloud?: CloudSave;
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
