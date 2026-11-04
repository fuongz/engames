import type { Localized } from "@web-games/core/i18n";
import type { Gravity } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  level: (n: number) => string;
  gravity: Record<Gravity, string>;
  tapHint: string;
  noPath: string;
  noHint: string;
  noShuffle: string;
  noFreeze: string;
  stillFrozen: string;
  frozen: (seconds: number) => string;
  shuffled: string;
  autoShuffled: string;
  combo: (n: number) => string;
  won: string;
  wonLine: (level: number) => string;
  bonus: (n: number) => string;
  reward: (shuffleAndFreeze: boolean) => string;
  next: string;
  timeUp: string;
  overLine: (score: number, level: number) => string;
  best: (n: number) => string;
  again: string;
  /** Leaderboard detail. */
  detail: (level: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    level: (n) => `MÀN ${n}`,
    gravity: {
      none: "Đứng yên",
      down: "Rơi xuống",
      up: "Bay lên",
      left: "Dồn sang trái",
      right: "Dồn sang phải",
      "split-v-out": "Tách lên trên – xuống dưới",
      "split-v-in": "Dồn vào giữa (trên – dưới)",
      "split-h-out": "Tách sang hai bên",
      "split-h-in": "Dồn vào giữa (trái – phải)",
    },
    tapHint: "Chạm hai thú giống nhau nối được bằng đường gấp khúc tối đa 2 lần",
    noPath: "Không nối được: đường đi quá 2 lần gấp khúc",
    noHint: "Hết lượt gợi ý",
    noShuffle: "Hết lượt đổi chỗ",
    noFreeze: "Hết lượt đóng băng",
    stillFrozen: "Đồng hồ đang đóng băng rồi",
    frozen: (s) => `Đóng băng thời gian ${s} giây!`,
    shuffled: "Đã đổi chỗ các thú",
    autoShuffled: "Hết đường nối, tự đổi chỗ miễn phí!",
    combo: (n) => `Liên hoàn x${n}!`,
    won: "Qua Màn!",
    wonLine: (level) => `Đã dọn sạch màn ${level}`,
    bonus: (n) => `Thưởng thời gian +${n}`,
    reward: (more) => (more ? "+1 gợi ý, +1 đổi chỗ, +1 đóng băng" : "+1 gợi ý"),
    next: "Màn Tiếp",
    timeUp: "Hết Giờ!",
    overLine: (score, level) => `${score} điểm, tới màn ${level}`,
    best: (n) => `Kỷ lục ${n} điểm`,
    again: "Chơi Lại",
    detail: (n) => `Màn ${n}`,
  },
  en: {
    level: (n) => `LEVEL ${n}`,
    gravity: {
      none: "Still",
      down: "Fall down",
      up: "Float up",
      left: "Slide left",
      right: "Slide right",
      "split-v-out": "Split up and down",
      "split-v-in": "Squeeze to the middle row",
      "split-h-out": "Split left and right",
      "split-h-in": "Squeeze to the middle column",
    },
    tapHint: "Tap two matching animals that a line with at most 2 bends can join",
    noPath: "Can't connect: the line would need more than 2 bends",
    noHint: "No hints left",
    noShuffle: "No shuffles left",
    noFreeze: "No freezes left",
    stillFrozen: "The clock is already frozen",
    frozen: (s) => `Time frozen for ${s} seconds!`,
    shuffled: "Animals shuffled",
    autoShuffled: "No moves left, a free shuffle!",
    combo: (n) => `Combo x${n}!`,
    won: "Cleared!",
    wonLine: (level) => `Level ${level} is clear`,
    bonus: (n) => `Time bonus +${n}`,
    reward: (more) => (more ? "+1 hint, +1 shuffle, +1 freeze" : "+1 hint"),
    next: "Next Level",
    timeUp: "Time's Up!",
    overLine: (score, level) => `${score} points, reached level ${level}`,
    best: (n) => `Best ${n} points`,
    again: "Play Again",
    detail: (n) => `Level ${n}`,
  },
};
