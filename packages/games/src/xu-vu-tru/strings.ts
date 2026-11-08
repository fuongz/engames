import type { Localized } from "@web-games/core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Arcade words the machine prints
// (SUPER BONUS, BONUS) stay as they are in both languages, like on a real cabinet.

export interface Strings {
  title: string;
  subtitle: string;
  beta: string;
  betaNote: (coins: number) => string;
  coins: string;
  tickets: string;
  spins: string;
  shoot: string;
  holdHint: string;
  youWin: string;
  marquee: (n: number) => string;
  superBonus: string;
  bonusSpin: string;
  coreLit: string;
  start: string;
  resume: string;
  newRun: string;
  rules: string;
  rulesLines: string[];
  close: string;
  menu: string;
  paused: string;
  noCoins: string;
  over: string;
  totalTickets: string;
  supersLine: (n: number) => string;
  best: (n: number) => string;
  newBest: string;
  again: string;
  /** Leaderboard detail, ≤ 40 chars. */
  detail: (tickets: number, supers: number) => string;
  summary: (tickets: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "XU VŨ TRỤ",
    subtitle: "Máy xu robot & vũ trụ",
    beta: "BETA",
    betaNote: (n) => `Bản thử: mỗi lượt có ${n} xu`,
    coins: "XU",
    tickets: "VÉ",
    spins: "LƯỢT",
    shoot: "BẮN",
    holdHint: "Giữ nút để bắn liên tục",
    youWin: "BẠN THẮNG",
    marquee: (n) => `SUPER BONUS ${n}`,
    superBonus: "SUPER BONUS!",
    bonusSpin: "BONUS SPIN!",
    coreLit: "LÕI SÁNG!",
    start: "Bắt đầu",
    resume: "Chơi tiếp",
    newRun: "Lượt mới",
    rules: "Luật chơi",
    rulesLines: [
      "Bấm BẮN (hoặc phím Space): tốn 1 xu, xu bay lên vòng quay.",
      "Ô đối diện ống bắn lúc xu chạm vòng quyết định thưởng: vé, LÕI hoặc BONUS.",
      "Xu rơi xuống kệ; thanh đẩy dồn xu ra mép. Rơi mép trước: +1 xu, +1 vé. Rơi hai bên: mất.",
      "Đẩy được viên lõi năng lượng ra mép trước: lõi sáng + 1 lượt Bonus Spin (10–100 vé).",
      "Sáng đủ 6 lõi: SUPER BONUS 250 vé và mưa xu!",
      "Hết xu và kệ đứng yên là hết lượt. Điểm = tổng vé.",
    ],
    close: "Đã hiểu",
    menu: "Menu",
    paused: "Tạm dừng",
    noCoins: "Hết xu!",
    over: "HẾT XU!",
    totalTickets: "Tổng vé",
    supersLine: (n) => (n > 0 ? `${n} lần Super Bonus` : "Chưa có Super Bonus"),
    best: (n) => `Kỷ lục ${n} vé`,
    newBest: "Kỷ lục mới!",
    again: "Chơi lại",
    detail: (tickets, supers) => (supers > 0 ? `${tickets} vé · ${supers} lần Super Bonus` : `${tickets} vé`),
    summary: (n) => `Kỷ lục ${n} vé`,
  },
  en: {
    title: "COSMO COINS",
    subtitle: "A robot & space coin machine",
    beta: "BETA",
    betaNote: (n) => `Test build: ${n} coins a run`,
    coins: "COINS",
    tickets: "TICKETS",
    spins: "SPINS",
    shoot: "SHOOT",
    holdHint: "Hold the button to keep firing",
    youWin: "YOU WIN",
    marquee: (n) => `SUPER BONUS ${n}`,
    superBonus: "SUPER BONUS!",
    bonusSpin: "BONUS SPIN!",
    coreLit: "CORE LIT!",
    start: "Start",
    resume: "Continue",
    newRun: "New run",
    rules: "How to play",
    rulesLines: [
      "Press SHOOT (or Space): 1 coin flies up the chute to the wheel.",
      "The slot facing the chute when it lands pays: tickets, a CORE or BONUS.",
      "The coin drops on the shelf; the pusher shoves coins off. Front edge: +1 coin, +1 ticket. Sides: lost.",
      "Push an energy core off the front: it lights up + 1 Bonus Spin (10–100 tickets).",
      "Light all 6 cores: SUPER BONUS 250 tickets and a coin shower!",
      "Out of coins and the shelf at rest ends the run. Score = total tickets.",
    ],
    close: "Got it",
    menu: "Menu",
    paused: "Paused",
    noCoins: "No coins!",
    over: "OUT OF COINS!",
    totalTickets: "Total tickets",
    supersLine: (n) => (n === 0 ? "No Super Bonus yet" : n === 1 ? "1 Super Bonus" : `${n} Super Bonuses`),
    best: (n) => `Best ${n} tickets`,
    newBest: "New best!",
    again: "Play again",
    detail: (tickets, supers) => (supers > 0 ? `${tickets} tickets · ${supers}× Super Bonus` : `${tickets} tickets`),
    summary: (n) => `Best ${n} tickets`,
  },
};
