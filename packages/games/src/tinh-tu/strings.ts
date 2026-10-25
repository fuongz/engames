import type { Localized } from "@web-games/core/i18n";
import type { PickupKind } from "./config";

// Every player-visible string the game draws. Vietnamese marked "ad" is copied
// from the reference recording (RE_NOTES.md); keep it verbatim.

export interface Strings {
  /** Floating caption over the rider when a bubble is collected. */
  pickup: Record<PickupKind, string>;
  waveCleared: (wave: number) => string;
  bossWarning: string;
  skillName: string;
  getReady: string;
  scoreLabel: string;
  paused: string;
  pauseScore: (score: number) => string;
  keyHint: string;
  resume: string;
  playAgain: string;
  won: string;
  lost: string;
  resultScore: (score: number) => string;
  resultLine: (shards: number, goal: number, best: number) => string;
  /** ScoreReport.detail, after the "n★, " prefix. */
  shardsDetail: (shards: number, goal: number) => string;
  summary: (best: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    pickup: {
      pierce: "Cấp đạn xuyên.", // ad
      multi: "Tăng số lượng đạn.", // ad
      energy: "Cung cấp Năng Lượng Tinh Tú.", // ad
      capacity: "Mở rộng Năng Lượng Tinh Tú.",
    },
    waveCleared: (wave) => `Đã Vượt Qua Đợt ${wave}!`, // ad
    bossWarning: "CẢNH BÁO: BOSS XUẤT HIỆN",
    skillName: "TINH TÚ QUANG PHÁO",
    getReady: "Chuẩn Bị Bắt Đầu", // ad
    scoreLabel: "Điểm Hiện Tại:", // ad
    paused: "Tạm Dừng",
    pauseScore: (score) => `Điểm hiện tại: ${score}`,
    keyHint: "Phím: WASD/mũi tên di chuyển | Space dùng chiêu",
    resume: "Tiếp tục",
    playAgain: "Chơi lại",
    won: "Hoàn Thành!",
    lost: "Thất Bại",
    resultScore: (score) => `Điểm: ${score}`,
    resultLine: (shards, goal, best) =>
      `Mảnh tinh tú ${shards}/${goal} | Kỷ lục ${best}`,
    shardsDetail: (shards, goal) => `${shards}/${goal} mảnh`,
    summary: (best) => `Kỷ lục ${best} điểm`,
  },
  en: {
    pickup: {
      pierce: "Piercing shots!",
      multi: "Extra bullet stream!",
      energy: "Star Energy charged!",
      capacity: "Star Energy capacity up!",
    },
    waveCleared: (wave) => `Wave ${wave} cleared!`,
    bossWarning: "WARNING: BOSS INCOMING",
    skillName: "STARLIGHT CANNON",
    getReady: "Get Ready",
    scoreLabel: "Score:",
    paused: "Paused",
    pauseScore: (score) => `Score: ${score}`,
    keyHint: "Keys: WASD/arrows to move | Space for skill",
    resume: "Resume",
    playAgain: "Play again",
    won: "Cleared!",
    lost: "Game Over",
    resultScore: (score) => `Score: ${score}`,
    resultLine: (shards, goal, best) =>
      `Star shards ${shards}/${goal} | Best ${best}`,
    shardsDetail: (shards, goal) => `${shards}/${goal} shards`,
    summary: (best) => `Best ${best} pts`,
  },
};
