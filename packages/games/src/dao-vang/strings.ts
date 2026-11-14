import type { Localized } from "@web-games/core/i18n";
import type { ShopKind } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  level: (n: number) => string;
  goal: (n: number) => string;
  goalLong: (n: number) => string;
  tapToStart: string;
  aimHint: string;
  dynamiteHint: string;
  cleared: string;
  clearedLine: (money: number) => string;
  toShop: string;
  timeUp: string;
  overLine: (money: number, goal: number) => string;
  overStats: (level: number) => string;
  again: string;
  shopTitle: string;
  shopLine: string;
  bank: (n: number) => string;
  buy: string;
  sold: string;
  tooPoor: string;
  leave: string;
  items: Record<ShopKind, { name: string; info: string }>;
  sackMoney: (n: number) => string;
  sackDynamite: string;
  sackStrength: string;
  boom: string;
  paused: string;
  resume: string;
  /** Leaderboard detail. */
  detail: (level: number) => string;
  best: (money: number, level: number) => string;
}

const money = (n: number) => n.toLocaleString("vi-VN");

export const STRINGS: Localized<Strings> = {
  vi: {
    level: (n) => `MÀN ${n}`,
    goal: (n) => `Mục tiêu ${money(n)}`,
    goalLong: (n) => `Kiếm đủ ${money(n)} trong 60 giây`,
    tapToStart: "Chạm để bắt đầu",
    aimHint: "Chạm khi móc chỉ vào vàng",
    dynamiteHint: "Móc phải đá? Chạm thuốc nổ để bỏ",
    cleared: "Đủ tiền rồi!",
    clearedLine: (n) => `Trong túi: ${money(n)}`,
    toShop: "Vào tiệm",
    timeUp: "Hết giờ!",
    overLine: (n, goal) => `Được ${money(n)} / cần ${money(goal)}`,
    overStats: (level) => `Dừng ở màn ${level}`,
    again: "Đào lại",
    shopTitle: "Tiệm Đồ Mỏ",
    shopLine: "Đồ mua dùng cho màn kế tiếp",
    bank: (n) => money(n),
    buy: "Mua",
    sold: "Đã mua",
    tooPoor: "Chưa đủ tiền",
    leave: "Đi đào tiếp",
    items: {
      dynamite: {
        name: "Thuốc nổ",
        info: "Bỏ món đang kéo, móc về thật nhanh",
      },
      strength: { name: "Thuốc khoẻ", info: "Kéo móc nhanh hơn suốt màn sau" },
      clover: { name: "Cỏ bốn lá", info: "Túi bí ẩn ra quà xịn hơn" },
      polish: { name: "Sáp đánh bóng", info: "Kim cương đáng giá gấp rưỡi" },
      book: { name: "Sách về đá", info: "Đá đáng giá gấp ba" },
    },
    sackMoney: (n) => `+${money(n)}`,
    sackDynamite: "+1 thuốc nổ!",
    sackStrength: "Khoẻ hẳn ra!",
    boom: "Bùm!",
    paused: "Tạm dừng",
    resume: "Chạm để đào tiếp",
    detail: (n) => `Màn ${n}`,
    best: (n, level) => `Kỷ lục ${money(n)}, màn ${level}`,
  },
  en: {
    level: (n) => `LEVEL ${n}`,
    goal: (n) => `Goal ${n.toLocaleString("en-US")}`,
    goalLong: (n) => `Bank ${n.toLocaleString("en-US")} in 60 seconds`,
    tapToStart: "Tap to start",
    aimHint: "Tap when the claw points at gold",
    dynamiteHint: "Hooked a rock? Tap the dynamite to drop it",
    cleared: "Goal reached!",
    clearedLine: (n) => `In the bank: ${n.toLocaleString("en-US")}`,
    toShop: "To the shop",
    timeUp: "Time's up!",
    overLine: (n, goal) =>
      `Got ${n.toLocaleString("en-US")} / needed ${goal.toLocaleString("en-US")}`,
    overStats: (level) => `Stopped at level ${level}`,
    again: "Dig again",
    shopTitle: "Mining Shop",
    shopLine: "What you buy works next level",
    bank: (n) => n.toLocaleString("en-US"),
    buy: "Buy",
    sold: "Bought",
    tooPoor: "Not enough",
    leave: "Back to digging",
    items: {
      dynamite: {
        name: "Dynamite",
        info: "Drop what you're reeling and snap back",
      },
      strength: { name: "Strength tonic", info: "Reel faster all next level" },
      clover: {
        name: "Lucky clover",
        info: "Mystery sacks hold better prizes",
      },
      polish: { name: "Diamond polish", info: "Diamonds are worth 1.5×" },
      book: { name: "Rock book", info: "Rocks are worth 3×" },
    },
    sackMoney: (n) => `+${n.toLocaleString("en-US")}`,
    sackDynamite: "+1 dynamite!",
    sackStrength: "Super strength!",
    boom: "Boom!",
    paused: "Paused",
    resume: "Tap to keep digging",
    detail: (n) => `Level ${n}`,
    best: (n, level) => `Best ${n.toLocaleString("en-US")}, level ${level}`,
  },
};
