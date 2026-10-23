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
  /** One line per control hint, shown on the game page. */
  controls: Localized<string[]>;
  category: GameCategory;
  tags: Localized<string[]>;
  /** 3:4 key art with the title baked in, one per language (import the assets). */
  poster: Localized<string>;
  /** 2:1 key art without text, for hero banners; keep the left side calm for the title. */
  banner: string;
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
