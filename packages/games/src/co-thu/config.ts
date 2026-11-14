import type { RoomSetting } from "@web-games/core/online";

// Tuning for Cờ Thú. Numbers and tables only; the rules are in logic.ts.

export const W = 540;
export const H = 960;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Plies the computer looks ahead (plus a short capture-only tail). */
export const AI_DEPTH: Record<Difficulty, number> = { easy: 1, normal: 3, hard: 5 };
/** Random swing (in eval points) added to each root move: Easy plays loose. */
export const AI_NOISE: Record<Difficulty, number> = { easy: 260, normal: 0, hard: 0 };
/** Seconds the computer "thinks" at least, so its move doesn't snap in. */
export const AI_DELAY = 0.5;
/** Milliseconds of search per frame before handing the frame back. */
export const AI_SLICE_MS = 9;

/** Solo score for beating the computer: base by level, plus a bonus per move under QUICK_WIN_MOVES. */
export const WIN_SCORE: Record<Difficulty, number> = { easy: 100, normal: 400, hard: 1200 };
export const QUICK_WIN_MOVES = 80;
export const QUICK_WIN_BONUS: Record<Difficulty, number> = { easy: 2, normal: 6, hard: 15 };

/** Animal ids, by rank (index 1..8): also the art file names in img/<id>.webp. */
export const ANIMAL_IDS = ["", "chuot", "meo", "cho", "soi", "bao", "ho", "su-tu", "voi"] as const;
export type AnimalId = Exclude<(typeof ANIMAL_IDS)[number], "">;

/** Seconds for a one-square hop and for a pond jump. */
export const HOP_TIME = 0.32;
export const JUMP_TIME = 0.62;
/** Pause after the last move before the result card. */
export const RESULT_DELAY = 1.3;

/** Side colours (bases, HUD). */
export const RED_HEX = "#e2483d";
export const RED_DARK = "#9e2a22";
export const BLUE_HEX = "#2f7fe0";
export const BLUE_DARK = "#1b4f99";

// ---------------------------------------------------------------- online

/** Timed-out turns in a row that forfeit the match. */
export const MAX_TIMEOUTS = 3;
/** Seconds a dropped player has to come back before the match is forfeited. */
export const RECONNECT_SECONDS = 60;
/** Who plays Red (and so moves first): the host, the guest, or a coin toss. */
export const RED_CHOICES = ["host", "guest", "random"] as const;
export type RedChoice = (typeof RED_CHOICES)[number];
/** Seconds per move the host can pick; 0 is no clock. */
export const TURN_CHOICES = [0, 30, 60] as const;
export type TurnSeconds = (typeof TURN_CHOICES)[number];
export const DEFAULT_TURN: TurnSeconds = 60;
/** The lobby settings (manifest and room adapter share this one list). */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "red",
    label: { vi: "Phe Đỏ (đi trước)", en: "Red (moves first)" },
    choices: [
      { value: "host", label: { vi: "Chủ phòng", en: "Host" } },
      { value: "guest", label: { vi: "Khách", en: "Guest" } },
      { value: "random", label: { vi: "Ngẫu nhiên", en: "Random" } },
    ],
    default: "host",
  },
  {
    key: "turn",
    label: { vi: "Thời gian mỗi nước", en: "Time per move" },
    choices: TURN_CHOICES.map((n) => ({
      value: String(n),
      label: n === 0 ? { vi: "Không giới hạn", en: "No limit" } : { vi: `${n} giây`, en: `${n} seconds` },
    })),
    default: String(DEFAULT_TURN),
  },
];
/** Online scores: the winner gets a base plus a bonus for a quick win; a draw gets a little. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_QUICK_MOVES = 60;
export const MATCH_QUICK_BONUS = 10;
export const MATCH_DRAW_SCORE = 300;
