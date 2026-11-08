import type { RoomSetting } from "@web-games/core/online";

// Tuning for Ô Ăn Quan. Numbers only; the rules are in logic.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- the board

/**
 * Twelve pits in a ring: 0 is the left quan pit, 1–5 the bottom row (seat 0)
 * left to right, 6 the right quan pit, 7–11 the top row (seat 1) right to left.
 * Step +1 goes round anticlockwise as drawn.
 */
export const PITS = 12;
export const QUAN_PITS = [0, 6] as const;
/** Small stones ("dân") in each of the ten square pits at the start. */
export const DAN_START = 5;
/** A captured quan stone is worth this many dân. */
export const QUAN_VALUE = 10;
/** Dân a player puts back (one per pit) when their row is empty on their turn. */
export const REFILL = 5;
/** With "no young quan" on, a quan pit is only captured once it holds this many dân. */
export const QUAN_NON_MIN = 5;
/** Sowing that relays more than this many times is stopped (a loop guard; never reached in play). */
export const MAX_RELAYS = 60;
/** A game that runs this long ends and is counted as it stands. */
export const MAX_PLIES = 300;

// ---------------------------------------------------------------- against the computer

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
/** Search depth in plies by level (easy also blunders, see ai.ts). */
export const AI_DEPTH: Record<Difficulty, number> = { easy: 1, normal: 3, hard: 6 };
/** Easy picks a random legal move this often. */
export const EASY_RANDOM = 0.45;
/** Solo score for beating the computer: base by level, plus a bonus per point of margin. */
export const WIN_SCORE: Record<Difficulty, number> = { easy: 100, normal: 400, hard: 1200 };
export const MARGIN_BONUS: Record<Difficulty, number> = { easy: 2, normal: 6, hard: 15 };
/** Seconds the computer "thinks" before its move starts (the search itself is instant). */
export const AI_DELAY = 0.55;

// ---------------------------------------------------------------- animation

/** Seconds per stone dropped while sowing, and for the other trace steps. */
export const SOW_STEP = 0.16;
export const TAKE_STEP = 0.32;
export const CAPTURE_STEP = 0.55;
export const REFILL_STEP = 0.8;
export const SWEEP_STEP = 0.9;

// ---------------------------------------------------------------- themes

export type ThemeId = "san-gach" | "son-mai" | "dong-ho";
export const THEMES: ThemeId[] = ["san-gach", "son-mai", "dong-ho"];

// ---------------------------------------------------------------- online

/** A turn online (on top of the time the last move takes to play out). */
export const TURN_SECONDS = 30;
/** Timed-out turns in a row that forfeit the match. */
export const MAX_TIMEOUTS = 3;
/** Seconds a dropped player has to come back before the match is forfeited. */
export const RECONNECT_SECONDS = 30;
/** Match lengths the host can pick in the lobby (best of N games). */
export const BEST_OF = [1, 3, 5] as const;
export type BestOf = (typeof BEST_OF)[number];
export const DEFAULT_BEST_OF: BestOf = 1;
/** Games to win the match: first to 1, 2 or 3. */
export const winsNeeded = (bestOf: number) => Math.ceil(bestOf / 2);
/** Draws can repeat; the match stops after this many games regardless. */
export const maxGames = (bestOf: number) => bestOf + 2;
/** The host's lobby choices (manifest and room adapter share this list). */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "bestOf",
    label: { vi: "Thể thức", en: "Match length" },
    choices: BEST_OF.map((n) => ({ value: String(n), label: { vi: `Bo${n}`, en: `Best of ${n}` } })),
    default: String(DEFAULT_BEST_OF),
  },
  {
    key: "quanNon",
    label: { vi: "Ăn quan non", en: "Young quan" },
    choices: [
      { value: "allow", label: { vi: "Cho ăn", en: "Can be taken" } },
      { value: "forbid", label: { vi: "Cấm (quan phải có 5 dân)", en: "Not until it holds 5" } },
    ],
    default: "allow",
  },
];
/** Pause between games, after the last move has played out. */
export const BETWEEN_GAMES = 3.5;
/** Online scores: the match winner gets this plus a little per point won; the loser a little per game won. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_POINT_BONUS = 4;
export const GAME_WIN_SCORE = 250;
