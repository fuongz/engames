import type { AudioBus } from "./audio";
import type { GameStorage } from "./storage";

export type GameCategory = "hanh-dong" | "chien-thuat" | "tri-tue" | "the-thao" | "phieu-luu";

export interface GameManifest {
  /** URL segment and storage namespace. Must match the folder name. */
  slug: string;
  title: string;
  tagline: string;
  description: string;
  /** One line per control hint, shown on the game page. */
  controls: string[];
  category: GameCategory;
  tags: string[];
  /** 3:4 key art with the title baked in, for game cards (import the asset). */
  poster: string;
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
  inspiredBy?: string;
}

/**
 * Storage key a game may write a one-line best result to (e.g. "Đợt 12 · 3400
 * điểm"). The portal shows it on the home page under "Kỷ lục của bạn".
 */
export const SUMMARY_KEY = "summary";

export interface GameContext {
  storage: GameStorage;
  audio: AudioBus;
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
