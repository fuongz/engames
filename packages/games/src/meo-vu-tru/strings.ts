import type { Localized } from "@web-games/core/i18n";
import type { Family, WaveDef } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Where {
  round: number;
  chapter: number;
  wave: number;
}

export interface Strings {
  title: string;
  story: string;
  tapToStart: string;
  dragHint: string;
  keysHint: string;
  missileHint: string;
  /** "Chương 1 - Đợt 3", with the loop in front from round 2. */
  where: (w: Where) => string;
  waveName: (def: WaveDef) => string;
  bossWarning: string;
  family: Record<Family, string>;
  level: (n: number) => string;
  maxed: string;
  missileGain: string;
  lifeGain: string;
  cleared: string;
  bonus: (n: number) => string;
  bossDown: string;
  gameOver: string;
  scoreLine: (n: number) => string;
  reached: (w: Where) => string;
  bestLine: (n: number) => string;
  newBest: string;
  again: string;
  paused: string;
  resume: string;
  /** Leaderboard detail. */
  detail: (w: Where) => string;
  best: (score: number, w: Where) => string;
}

const vnNum = (n: number) => n.toLocaleString("vi-VN");
const enNum = (n: number) => n.toLocaleString("en-US");

const viWhere = (w: Where) =>
  `${w.round > 1 ? `Vòng ${w.round} · ` : ""}Chương ${w.chapter} - Đợt ${w.wave}`;
const enWhere = (w: Where) =>
  `${w.round > 1 ? `Round ${w.round} · ` : ""}Chapter ${w.chapter} - Wave ${w.wave}`;

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "MÈO VŨ TRỤ",
    story: "Mèo ngoài hành tinh đang trộm cá của Trái Đất!",
    tapToStart: "Chạm để cất cánh",
    dragHint: "Kéo ngón tay để bay · súng tự bắn",
    keysHint: "Phím mũi tên / WASD để bay · Space phóng tên lửa",
    missileHint: "Chạm nút tên lửa để dọn sạch màn hình",
    where: viWhere,
    waveName: (d) => {
      switch (d.kind) {
        case "grid":
          return "Đội hình mèo";
        case "lines":
          return "Mèo bay uốn lượn";
        case "kamikaze":
          return "Robo-mèo lao tới!";
        case "rocks":
          return "Mưa rác vũ trụ";
        case "mini":
          return "Đĩa bay khổng lồ";
        case "bonus":
          return "Mưa cá khô!";
        case "boss":
          return ["Thuyền trưởng Mèo Mập", "Robo-Mèo Thép", "Nữ hoàng Mèo"][
            d.boss - 1
          ];
      }
    },
    bossWarning: "CẢNH BÁO: TRÙM!",
    family: { spread: "Đạn tỏa", laser: "Tia laser", bolt: "Sét chuỗi" },
    level: (n) => `Cấp ${n}`,
    maxed: "Tối đa!",
    missileGain: "+1 tên lửa",
    lifeGain: "+1 mạng",
    cleared: "Xong đợt!",
    bonus: (n) => `Thưởng +${vnNum(n)}`,
    bossDown: "Hạ trùm!",
    gameOver: "Hết mạng!",
    scoreLine: (n) => `${vnNum(n)} điểm`,
    reached: (w) => `Tới ${viWhere(w)}`,
    bestLine: (n) => `Kỷ lục: ${vnNum(n)}`,
    newBest: "Kỷ lục mới!",
    again: "Bay lại",
    paused: "Tạm dừng",
    resume: "Chạm để bay tiếp",
    detail: viWhere,
    best: (n, w) => `Kỷ lục ${vnNum(n)} · ${viWhere(w)}`,
  },
  en: {
    title: "COSMIC CATS",
    story: "Alien cats are stealing Earth's fish!",
    tapToStart: "Tap to take off",
    dragHint: "Drag to fly · your guns fire on their own",
    keysHint: "Arrows / WASD to fly · Space fires a missile",
    missileHint: "Tap the missile button to clear the screen",
    where: enWhere,
    waveName: (d) => {
      switch (d.kind) {
        case "grid":
          return "Cat formation";
        case "lines":
          return "Cat conga line";
        case "kamikaze":
          return "Kamikaze kittens!";
        case "rocks":
          return "Space-junk storm";
        case "mini":
          return "The big saucer";
        case "bonus":
          return "Fish rain!";
        case "boss":
          return ["Captain Chonk", "Steel Mecha-Cat", "The Cat Queen"][
            d.boss - 1
          ];
      }
    },
    bossWarning: "WARNING: BOSS!",
    family: { spread: "Spread", laser: "Laser", bolt: "Chain bolt" },
    level: (n) => `Lv ${n}`,
    maxed: "Maxed!",
    missileGain: "+1 missile",
    lifeGain: "+1 life",
    cleared: "Wave clear!",
    bonus: (n) => `Bonus +${enNum(n)}`,
    bossDown: "Boss down!",
    gameOver: "Out of lives!",
    scoreLine: (n) => `${enNum(n)} points`,
    reached: (w) => `Reached ${enWhere(w)}`,
    bestLine: (n) => `Best: ${enNum(n)}`,
    newBest: "New best!",
    again: "Fly again",
    paused: "Paused",
    resume: "Tap to keep flying",
    detail: enWhere,
    best: (n, w) => `Best ${enNum(n)} · ${enWhere(w)}`,
  },
};
