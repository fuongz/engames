import type { RoomSetting } from "@web-games/core/online";

// Tuning for Cờ Lật (Reversi). Numbers only; the rules are in logic.ts.

export const W = 540;
export const H = 960;

/** The board is SIZE × SIZE squares. */
export const SIZE = 8;
export const CELLS = SIZE * SIZE;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Solo score for beating the computer: base by level, plus a bonus per disc of margin. */
export const WIN_SCORE: Record<Difficulty, number> = {
  easy: 100,
  normal: 400,
  hard: 1200,
};
export const MARGIN_BONUS: Record<Difficulty, number> = {
  easy: 2,
  normal: 6,
  hard: 15,
};
/** Take-backs per game against the computer. */
export const UNDOS_PER_GAME = 3;
/** Seconds the computer "thinks" before its move appears (Easy/Normal are instant; Hard takes its time). */
export const AI_DELAY = 0.55;

/** Seconds one disc takes to turn over, and the gap between neighbours in a flipped line. */
export const FLIP_TIME = 0.34;
export const FLIP_STAGGER = 0.07;

// ---------------------------------------------------------------- online

/** A turn online; when it runs out the room plays the Normal computer's move for you. */
export const TURN_SECONDS = 30;
/** Timed-out turns in a row that forfeit the match. */
export const MAX_TIMEOUTS = 3;
/** Seconds a dropped player has to come back before the match is forfeited. */
export const RECONNECT_SECONDS = 30;
/** Match lengths the host can pick in the lobby (best of N games). */
export const BEST_OF = [1, 3, 5] as const;
export type BestOf = (typeof BEST_OF)[number];
export const DEFAULT_BEST_OF: BestOf = 3;
/** Games to win the match: first to 1, 2 or 3. */
export const winsNeeded = (bestOf: number) => Math.ceil(bestOf / 2);
/** Draws can repeat; the match stops after this many games regardless. */
export const maxGames = (bestOf: number) => bestOf + 2;
/** The lobby setting the host picks the match length with (manifest and room adapter share it). */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "bestOf",
    label: { vi: "Thể thức", en: "Match length" },
    choices: BEST_OF.map((n) => ({ value: String(n), label: { vi: `Bo${n}`, en: `Best of ${n}` } })),
    default: String(DEFAULT_BEST_OF),
  },
];
/** Pause between games, showing who took the last one. */
export const BETWEEN_GAMES = 4;
/** Online scores: the match winner, plus a bonus per disc of margin in the games they won; the loser gets a little per game won. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_MARGIN_BONUS = 5;
export const GAME_WIN_SCORE = 250;
