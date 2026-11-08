import type { Localized } from "@web-games/core/i18n";
import type { FighterId } from "./config";

export interface Strings {
  fighters: Record<FighterId, { name: string; beast: string; style: string; moves: [string, string, string, string] }>;
  pickFighter: string;
  difficulty: string;
  levels: [string, string, string];
  start: string;
  pickHint: string;
  fightOf: (n: number, total: number) => string;
  bossTag: string;
  round: (n: number) => string;
  finalRound: string;
  fight: string;
  ko: string;
  timeUp: string;
  draw: string;
  perfect: string;
  wins: (name: string) => string;
  finishHim: string;
  finishHint: string;
  finisher: string;
  combo: (n: number) => string;
  beastReady: string;
  victory: string;
  defeat: string;
  ladderCleared: string;
  score: (n: number) => string;
  best: (n: number) => string;
  newBest: string;
  next: string;
  retry: string;
  change: string;
  paused: string;
  resume: string;
  keys: string;
  buttons: { P: string; K: string; S: string; B: string };
  /** Leaderboard detail, e.g. "Hổ, thắng 3/3". */
  detail: (fighter: string, won: number, total: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    fighters: {
      ho: { name: "Khang", beast: "Hổ", style: "Cân bằng, vuốt nhanh", moves: ["Hổ Trảo", "Thăng Long Trảo", "Hổ Vồ", "Hổ Cuồng Nộ"] },
      soi: { name: "Linh", beast: "Sói", style: "Nhanh, đánh xa", moves: ["Sói Tru", "Nguyệt Trảo", "Phong Cước", "Sói Cuồng Nộ"] },
      gau: { name: "Tấn", beast: "Gấu", style: "Chậm, khoẻ, có giáp", moves: ["Gấu Húc", "Gấu Hất", "Địa Chấn", "Gấu Cuồng Nộ"] },
    },
    pickFighter: "CHỌN VÕ SĨ",
    difficulty: "Độ khó",
    levels: ["Dễ", "Thường", "Khó"],
    start: "VÀO TRẬN",
    pickHint: "← → chọn võ sĩ, ↑ ↓ độ khó, Enter vào trận",
    fightOf: (n, total) => `TRẬN ${n}/${total}`,
    bossTag: "THỦ LĨNH",
    round: (n) => `HIỆP ${n}`,
    finalRound: "HIỆP QUYẾT ĐỊNH",
    fight: "ĐẤU!",
    ko: "K.O.",
    timeUp: "HẾT GIỜ",
    draw: "HOÀ",
    perfect: "HOÀN HẢO!",
    wins: (name) => `${name} THẮNG`,
    finishHim: "KẾT LIỄU!",
    finishHint: "↓ ↓ + Thú",
    finisher: "HOÁ THÚ KẾT LIỄU!",
    combo: (n) => `${n} ĐÒN`,
    beastReady: "THÚ SẴN SÀNG!",
    victory: "CHIẾN THẮNG!",
    defeat: "THẤT BẠI",
    ladderCleared: "Vô địch võ đài!",
    score: (n) => `${n.toLocaleString("vi-VN")} điểm`,
    best: (n) => `Kỷ lục: ${n.toLocaleString("vi-VN")}`,
    newBest: "Kỷ lục mới!",
    next: "Trận tiếp",
    retry: "Đấu lại",
    change: "Đổi võ sĩ",
    paused: "Tạm dừng",
    resume: "Tiếp tục",
    keys: "WASD/mũi tên di chuyển | J đấm | K đá | L chiêu | I hoá thú",
    buttons: { P: "Đấm", K: "Đá", S: "Chiêu", B: "Thú" },
    detail: (fighter, won, total) => `${fighter}, thắng ${won}/${total}`,
  },
  en: {
    fighters: {
      ho: { name: "Khang", beast: "Tiger", style: "Balanced, quick claws", moves: ["Tiger Claw", "Rising Dragon Claw", "Tiger Pounce", "Tiger Frenzy"] },
      soi: { name: "Linh", beast: "Wolf", style: "Fast, ranged", moves: ["Wolf Howl", "Moon Claw", "Wind Kick", "Wolf Frenzy"] },
      gau: { name: "Tấn", beast: "Bear", style: "Slow, strong, armoured", moves: ["Bear Charge", "Bear Swipe", "Earthquake", "Bear Frenzy"] },
    },
    pickFighter: "CHOOSE YOUR FIGHTER",
    difficulty: "Difficulty",
    levels: ["Easy", "Normal", "Hard"],
    start: "FIGHT",
    pickHint: "← → fighter, ↑ ↓ difficulty, Enter to fight",
    fightOf: (n, total) => `FIGHT ${n}/${total}`,
    bossTag: "CHAMPION",
    round: (n) => `ROUND ${n}`,
    finalRound: "FINAL ROUND",
    fight: "FIGHT!",
    ko: "K.O.",
    timeUp: "TIME UP",
    draw: "DRAW",
    perfect: "PERFECT!",
    wins: (name) => `${name} WINS`,
    finishHim: "FINISH!",
    finishHint: "↓ ↓ + Beast",
    finisher: "BEAST FINISHER!",
    combo: (n) => `${n} HITS`,
    beastReady: "BEAST READY!",
    victory: "VICTORY!",
    defeat: "DEFEAT",
    ladderCleared: "Champion of the ring!",
    score: (n) => `${n.toLocaleString("en-US")} pts`,
    best: (n) => `Best: ${n.toLocaleString("en-US")}`,
    newBest: "New best!",
    next: "Next fight",
    retry: "Rematch",
    change: "Change fighter",
    paused: "Paused",
    resume: "Resume",
    keys: "WASD/arrows move | J punch | K kick | L special | I beast",
    buttons: { P: "Punch", K: "Kick", S: "Special", B: "Beast" },
    detail: (fighter, won, total) => `${fighter}, won ${won}/${total}`,
  },
};
