import type { Localized } from "@web-games/core/i18n";

// The two card decks, with our own wording. "Cơ hội" (Chance) moves you around
// the country; "Khí vận" (Fortune) is mostly money. logic.ts applies the effect.

export type Deck = "chance" | "chest";

export type CardEffect =
  /** Go to a square; Xuất phát's salary if you pass it on the way. */
  | { kind: "advance"; to: number }
  | { kind: "back"; steps: number }
  /** Nearest transport (rent ×2) or nearest utility (10 × a fresh roll). */
  | { kind: "nearest"; group: 8 | 9 }
  | { kind: "jail" }
  /** A "get out of jail" card you keep. */
  | { kind: "free" }
  /** + from the bank, − to the bank. */
  | { kind: "cash"; amount: number }
  /** + collect from every other player, − pay every other player. */
  | { kind: "each"; amount: number }
  | { kind: "repairs"; house: number; hotel: number };

export interface Card {
  text: Localized<string>;
  effect: CardEffect;
}

export const CHANCE: Card[] = [
  { text: { vi: "Chuyến xe sớm: về Xuất phát, nhận lương", en: "Early bus: go to Start and collect your salary" }, effect: { kind: "advance", to: 0 } },
  { text: { vi: "Ra Hà Nội ăn phở: tới Hà Nội", en: "Off to Hanoi for a bowl of phở: go to Hanoi" }, effect: { kind: "advance", to: 39 } },
  { text: { vi: "Đêm rằm phố cổ: tới Hội An", en: "Full-moon lantern night: go to Hoi An" }, effect: { kind: "advance", to: 23 } },
  { text: { vi: "Săn mây sáng sớm: tới Sa Pa", en: "Chasing morning clouds: go to Sa Pa" }, effect: { kind: "advance", to: 6 } },
  { text: { vi: "Đi xe ôm ra Bến xe", en: "Hop on a motorbike taxi to the Bus station" }, effect: { kind: "advance", to: 5 } },
  { text: { vi: "Vé tàu giờ chót: tới bến gần nhất, trả thuê gấp đôi", en: "Last-minute ticket: nearest transport, pay double rent" }, effect: { kind: "nearest", group: 8 } },
  { text: { vi: "Lỡ chuyến: tới bến gần nhất, trả thuê gấp đôi", en: "Missed your ride: nearest transport, pay double rent" }, effect: { kind: "nearest", group: 8 } },
  { text: { vi: "Mất điện cả phố: tới điện / nước gần nhất, trả 10 × xí ngầu", en: "Street blackout: nearest utility, pay 10 × the dice" }, effect: { kind: "nearest", group: 9 } },
  { text: { vi: "Rẽ nhầm hẻm: lùi 3 ô", en: "Wrong alley: go back 3 squares" }, effect: { kind: "back", steps: 3 } },
  { text: { vi: "Vượt đèn đỏ: vào thẳng trại giam", en: "Ran a red light: go straight to jail" }, effect: { kind: "jail" } },
  { text: { vi: "Người quen giúp đỡ: thẻ Ra tù (giữ lại dùng sau)", en: "A friend vouches for you: Out of jail card (keep it)" }, effect: { kind: "free" } },
  { text: { vi: "Trúng vé số cuối tuần: nhận 150K", en: "Weekend lottery win: collect 150K" }, effect: { kind: "cash", amount: 150 } },
  { text: { vi: "Lãi tiết kiệm về: nhận 50K", en: "Savings interest arrives: collect 50K" }, effect: { kind: "cash", amount: 50 } },
  { text: { vi: "Phạt quá tốc độ: trả 15K", en: "Speeding ticket: pay 15K" }, effect: { kind: "cash", amount: -15 } },
  { text: { vi: "Làm trưởng đoàn du lịch: trả mỗi người 50K", en: "You lead the group tour: pay each player 50K" }, effect: { kind: "each", amount: -50 } },
  { text: { vi: "Sửa nhà sau bão: 25K mỗi nhà, 100K mỗi khách sạn", en: "Storm repairs: 25K per house, 100K per hotel" }, effect: { kind: "repairs", house: 25, hotel: 100 } },
];

export const CHEST: Card[] = [
  { text: { vi: "Được đón về Xuất phát: nhận lương", en: "A lift back to Start: collect your salary" }, effect: { kind: "advance", to: 0 } },
  { text: { vi: "Lì xì Tết: nhận 100K", en: "Lucky Tết envelope: collect 100K" }, effect: { kind: "cash", amount: 100 } },
  { text: { vi: "Ngân hàng cộng nhầm cho bạn: nhận 200K", en: "A bank slip in your favour: collect 200K" }, effect: { kind: "cash", amount: 200 } },
  { text: { vi: "Bán đồ cũ ở chợ phiên: nhận 50K", en: "Sold old things at the flea market: collect 50K" }, effect: { kind: "cash", amount: 50 } },
  { text: { vi: "Hoàn thuế: nhận 20K", en: "Tax refund: collect 20K" }, effect: { kind: "cash", amount: 20 } },
  { text: { vi: "Giải ba thi nấu phở: nhận 10K", en: "Third prize at the phở contest: collect 10K" }, effect: { kind: "cash", amount: 10 } },
  { text: { vi: "Bảo hiểm đáo hạn: nhận 100K", en: "Insurance matures: collect 100K" }, effect: { kind: "cash", amount: 100 } },
  { text: { vi: "Phí tư vấn: nhận 25K", en: "Consulting fee: collect 25K" }, effect: { kind: "cash", amount: 25 } },
  { text: { vi: "Được thừa kế vườn cau: nhận 100K", en: "You inherit an areca garden: collect 100K" }, effect: { kind: "cash", amount: 100 } },
  { text: { vi: "Sinh nhật bạn: mỗi người tặng 10K", en: "It's your birthday: each player gives you 10K" }, effect: { kind: "each", amount: 10 } },
  { text: { vi: "Viện phí: trả 100K", en: "Hospital bill: pay 100K" }, effect: { kind: "cash", amount: -100 } },
  { text: { vi: "Học phí: trả 50K", en: "School fees: pay 50K" }, effect: { kind: "cash", amount: -50 } },
  { text: { vi: "Nhổ răng khôn: trả 50K", en: "Wisdom tooth out: pay 50K" }, effect: { kind: "cash", amount: -50 } },
  { text: { vi: "Phí sửa đường: 40K mỗi nhà, 115K mỗi khách sạn", en: "Road works levy: 40K per house, 115K per hotel" }, effect: { kind: "repairs", house: 40, hotel: 115 } },
  { text: { vi: "Hàng xóm bảo lãnh: thẻ Ra tù (giữ lại dùng sau)", en: "A neighbour stands bail: Out of jail card (keep it)" }, effect: { kind: "free" } },
  { text: { vi: "Bị bắt nhầm: vào thẳng trại giam", en: "Mistaken arrest: go straight to jail" }, effect: { kind: "jail" } },
];

export const DECKS: Record<Deck, Card[]> = { chance: CHANCE, chest: CHEST };
