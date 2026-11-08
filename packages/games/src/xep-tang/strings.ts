import type { Localized } from "@web-games/core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  tapToStart: string;
  startHint: string;
  paused: string;
  tapToResume: string;
  perfect: string;
  streak: (n: number) => string;
  grew: string;
  over: string;
  floors: string;
  best: (n: number) => string;
  newBest: string;
  perfects: (n: number) => string;
  again: string;
  /** Leaderboard detail, ≤ 40 chars. */
  detail: (floors: number, perfects: number) => string;
  summary: (best: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "XẾP TẦNG",
    tapToStart: "Chạm để bắt đầu",
    startHint: "Chạm để thả tấm đang trượt. Phần thò ra sẽ bị cắt.",
    paused: "Tạm dừng",
    tapToResume: "Chạm để chơi tiếp",
    perfect: "Hoàn hảo!",
    streak: (n) => `Hoàn hảo ×${n}`,
    grew: "Tấm nở rộng!",
    over: "Hết lượt",
    floors: "tầng",
    best: (n) => `Kỷ lục ${n} tầng`,
    newBest: "Kỷ lục mới!",
    perfects: (n) => `${n} lần hoàn hảo`,
    again: "Chơi lại",
    detail: (f, p) => `${f} tầng · ${p} hoàn hảo`,
    summary: (b) => `Kỷ lục ${b} tầng`,
  },
  en: {
    title: "STACK UP",
    tapToStart: "Tap to start",
    startHint: "Tap to drop the sliding slab. Whatever hangs over is cut off.",
    paused: "Paused",
    tapToResume: "Tap to keep playing",
    perfect: "Perfect!",
    streak: (n) => `Perfect ×${n}`,
    grew: "Slab grows!",
    over: "Game over",
    floors: "floors",
    best: (n) => `Best ${n} floors`,
    newBest: "New best!",
    perfects: (n) => `${n} perfect drops`,
    again: "Play again",
    detail: (f, p) => `${f} floors · ${p} perfect`,
    summary: (b) => `Best ${b} floors`,
  },
};
