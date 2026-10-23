import type { Localized } from "../core";

// Every player-visible string the game draws. game.ts picks the catalog for the
// current locale each frame, so flipping the language mid-run takes effect at once.

export interface Strings {
  /** HUD pill and the `reportScore` detail. */
  wave: (n: number) => string;
  /** Sliding banner when a wave starts. */
  waveBanner: (n: number) => string;
  bossBanner: (n: number) => string;
  tutorial: string;
  hatch: string;
  evolving: string;
  evolved: string;
  level: (n: number) => string;
  tapToContinue: string;
  gameOver: string;
  survived: (wave: number) => string;
  score: (n: number) => string;
  best: (wave: number, score: number) => string;
  kills: (n: number) => string;
  playAgain: string;
  /** Launcher card line, stored under SUMMARY_KEY. */
  summary: (wave: number, score: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    wave: (n) => `Đợt ${n}`,
    waveBanner: (n) => `ĐỢT ${n}`,
    bossBanner: (n) => `BOSS ĐỢT ${n}!`,
    tutorial: "Kéo 2 thú cùng cấp để ghép!",
    hatch: "ẤP TRỨNG",
    evolving: "Đang tiến hóa",
    evolved: "Tiến hóa thành công!",
    level: (n) => `Cấp ${n}`,
    tapToContinue: "Chạm để tiếp tục",
    gameOver: "THUA RỒI!",
    survived: (wave) => `Trụ được tới đợt ${wave}`,
    score: (n) => `Điểm: ${n}`,
    best: (wave, score) => `Kỷ lục: đợt ${wave}, ${score} điểm`,
    kills: (n) => `Hạ gục ${n} zombie`,
    playAgain: "CHƠI LẠI",
    summary: (wave, score) => `Đợt ${wave}, ${score} điểm`,
  },
  en: {
    wave: (n) => `Wave ${n}`,
    waveBanner: (n) => `WAVE ${n}`,
    // "WAVE n: BOSS!" overflows the 300px banner at 40px; this order fits.
    bossBanner: (n) => `BOSS WAVE ${n}!`,
    tutorial: "Drag 2 same-level critters to merge!",
    hatch: "HATCH",
    evolving: "Evolving...",
    evolved: "Evolved!",
    level: (n) => `Level ${n}`,
    tapToContinue: "Tap to continue",
    gameOver: "GAME OVER!",
    survived: (wave) => `Survived to wave ${wave}`,
    score: (n) => `Score: ${n}`,
    best: (wave, score) => `Best: wave ${wave}, ${score} pts`,
    kills: (n) => `${n} ${n === 1 ? "zombie" : "zombies"} defeated`,
    playAgain: "PLAY AGAIN",
    summary: (wave, score) => `Wave ${wave}, ${score} pts`,
  },
};
