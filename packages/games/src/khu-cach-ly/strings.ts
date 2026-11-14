import type { Localized } from "@web-games/core/i18n";
interface Strings {
  title: string;
  subtitle: string;
  start: string;
  resume: string;
  again: string;
  move: string;
  shoot: string;
  keys: string;
  paused: string;
  over: string;
  score: string;
  best: string;
  kills: string;
  wave: string;
  incoming: string;
  boss: string;
  weapons: string[];
  blast: string;
  ready: string;
  locked: (n: number) => string;
  detail: (wave: number, kills: number) => string;
  summary: (score: number) => string;
}
export const STRINGS: Localized<Strings> = {
  vi: {
    title: "KHU CÁCH LY",
    subtitle: "TÍN HIỆU CUỐI CÙNG: TRẠM 07",
    start: "VÀO CHIẾN DỊCH",
    resume: "TIẾP TỤC",
    again: "THỬ LẠI",
    move: "Kéo để di chuyển",
    shoot: "Súng tự ngắm và bắn",
    keys: "WASD / ↑↓←→, 1–3 đổi súng, Space xung nổ, P dừng",
    paused: "TẠM DỪNG",
    over: "MẤT TÍN HIỆU",
    score: "ĐIỂM",
    best: "KỶ LỤC",
    kills: "ĐÃ HẠ",
    wave: "ĐỢT",
    incoming: "PHÁT HIỆN SINH VẬT",
    boss: "CẢNH BÁO: QUÁI ĐẦU ĐÀN",
    weapons: ["LIÊN THANH", "SÚNG CHÙM", "PLASMA"],
    blast: "XUNG NỔ",
    ready: "SẴN SÀNG",
    locked: (n) => `Hạ ${n} quái`,
    detail: (w, k) => `Đợt ${w}, ${k} quái`,
    summary: (s) => `Kỷ lục ${s} điểm`,
  },
  en: {
    title: "QUARANTINE",
    subtitle: "LAST TRANSMISSION: STATION 07",
    start: "ENTER THE ZONE",
    resume: "RESUME",
    again: "TRY AGAIN",
    move: "Drag to move",
    shoot: "Auto aim and fire",
    keys: "WASD / ↑↓←→, 1–3 weapons, Space pulse, P pause",
    paused: "PAUSED",
    over: "SIGNAL LOST",
    score: "SCORE",
    best: "BEST",
    kills: "KILLS",
    wave: "WAVE",
    incoming: "LIFEFORMS DETECTED",
    boss: "WARNING: HIVE LORD",
    weapons: ["ASSAULT", "SHOTGUN", "PLASMA"],
    blast: "PULSE",
    ready: "READY",
    locked: (n) => `${n} kills`,
    detail: (w, k) => `Wave ${w}, ${k} kills`,
    summary: (s) => `Best ${s} points`,
  },
};
