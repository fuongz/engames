import type { Localized } from "../core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  level: (n: number) => string;
  claim: string;
  tapHint: string;
  ruleHint: string;
  stuck: string;
  noUndo: string;
  noTube: string;
  tubeUsed: string;
  won: string;
  wonLine: (level: number, pours: number) => string;
  undoReward: string;
  next: string;
  gift: string;
  giftReward: (undos: number, tubes: number) => string;
  /** Leaderboard detail. */
  detail: (level: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    level: (n) => `MÀN ${n}`,
    claim: "Nhận",
    tapHint: "Chạm một ống, rồi chạm ống khác để rót",
    ruleHint: "Chỉ rót lên nước cùng màu hoặc vào ống trống",
    stuck: "Hết nước đi! Hoàn tác, thêm ống hoặc chơi lại",
    noUndo: "Hết lượt hoàn tác",
    noTube: "Hết ống thêm",
    tubeUsed: "Màn này đã thêm ống rồi",
    won: "Tuyệt Vời!",
    wonLine: (level, pours) => `Xong màn ${level} sau ${pours} lần rót`,
    undoReward: "+1 lượt hoàn tác",
    next: "Màn Tiếp",
    gift: "Quà đây!",
    giftReward: (undos, tubes) => `+${undos} hoàn tác · +${tubes} ống`,
    detail: (n) => `Màn ${n}`,
  },
  en: {
    level: (n) => `LEVEL ${n}`,
    claim: "Claim",
    tapHint: "Tap a tube, then another one to pour",
    ruleHint: "Pour only onto the same colour or into an empty tube",
    stuck: "No moves left! Undo, add a tube or restart",
    noUndo: "No undos left",
    noTube: "No extra tubes left",
    tubeUsed: "You already added a tube this level",
    won: "Well Done!",
    wonLine: (level, pours) => `Level ${level} cleared in ${pours} pours`,
    undoReward: "+1 undo",
    next: "Next Level",
    gift: "A gift!",
    giftReward: (undos, tubes) => `+${undos} undos · +${tubes} tube`,
    detail: (n) => `Level ${n}`,
  },
};
