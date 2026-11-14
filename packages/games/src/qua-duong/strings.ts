import type { Localized } from "@web-games/core/i18n";
import type { Death } from "./logic";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  tapToStart: string;
  startHint: string;
  keysHint: string;
  paused: string;
  tapToResume: string;
  best: (n: number) => string;
  newBest: string;
  coins: string;
  over: string;
  death: Record<Death, string>;
  rows: (n: number) => string;
  again: string;
  hurry: string;
  skin: string;
  noWebGL: string;
  /** Leaderboard detail, ≤ 40 chars. */
  detail: (rows: number, coins: number) => string;
  summary: (best: number) => string;
  /** Under the outfit picker: how many outfits the Prize Counter still sells. */
  moreSkins: (n: number) => string;
  /** Shared arcade ticket balance. */
  tickets: (n: number) => string;
  /** Tickets this run paid out. */
  ticketsWon: (n: number) => string;
  ticketCap: string;
  /** What the run's coins are worth: "2 xu = +10 vé". */
  coinValue: (coins: number, tickets: number) => string;
  /** Signed out: rows and coins turn into tickets only with an account. */
  signInForTickets: string;
  // online race
  connecting: string;
  go: string;
  timeUp: string;
  you: string;
  out: string;
  spectating: (name: string) => string;
  watching: string;
  outcome: Record<"win" | "loss" | "draw", string>;
  raceOver: string;
  backToLobby: string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "QUA ĐƯỜNG",
    tapToStart: "Chạm để bắt đầu",
    startHint: "Chạm để nhảy lên, vuốt để đổi hướng.",
    keysHint: "Phím mũi tên hoặc W A S D",
    paused: "Tạm dừng",
    tapToResume: "Chạm để chơi tiếp",
    best: (n) => `Kỷ lục ${n}`,
    newBest: "Kỷ lục mới!",
    coins: "xu",
    over: "Hết lượt",
    death: {
      hit: "Bị xe tông bẹp dí!",
      train: "Tàu hỏa tới rồi!",
      drown: "Ùm! Rơi xuống sông.",
      edge: "Trôi mất theo dòng nước.",
      caught: "Chú dân phòng bắt được rồi!",
      netted: "Trộm chó vợt nhầm vịt! Cạp cạp, cứu với!",
    },
    rows: (n) => `${n} hàng`,
    again: "Chơi lại",
    hurry: "Nhanh lên! Chú dân phòng đang tới…",
    skin: "Đổi áo",
    noWebGL: "Trình duyệt này chưa hỗ trợ đồ họa 3D (WebGL).",
    detail: (r, c) => `${r} hàng, ${c} xu`,
    summary: (b) => `Kỷ lục ${b} hàng`,
    moreSkins: (n) => `Thêm ${n} áo ở Quầy đổi thưởng`,
    tickets: (n) => `${n.toLocaleString("vi")} vé`,
    ticketsWon: (n) => `Nhận tổng +${n.toLocaleString("vi")} vé`,
  coinValue: (c, t) => `${c} xu = +${t.toLocaleString("vi")} vé`,
  signInForTickets: "Đăng nhập để đổi hàng đi được và xu ra vé",
    ticketCap: "Hôm nay đã nhận đủ vé từ game này",
    connecting: "Đang vào đường đua…",
    go: "Đi!",
    timeUp: "Hết giờ!",
    you: "Bạn",
    out: "Bạn bị loại!",
    spectating: (name) => `Đang xem ${name}`,
    watching: "Trận đang diễn ra, bạn xem trận này",
    outcome: { win: "Về nhất!", loss: "Thua rồi", draw: "Hòa!" },
    raceOver: "Kết quả",
    backToLobby: "Về phòng chờ",
  },
  en: {
    title: "CROSS THE STREET",
    tapToStart: "Tap to start",
    startHint: "Tap to hop forward, swipe to turn.",
    keysHint: "Arrow keys or W A S D",
    paused: "Paused",
    tapToResume: "Tap to keep playing",
    best: (n) => `Best ${n}`,
    newBest: "New best!",
    coins: "coins",
    over: "Game over",
    death: {
      hit: "Flattened by traffic!",
      train: "The train came through!",
      drown: "Splash! Into the river.",
      edge: "Swept away downstream.",
      caught: "The ward officer caught you!",
      netted: "Dog-nappers netted a duck! Quack, help!",
    },
    rows: (n) => `${n} rows`,
    again: "Play again",
    hurry: "Hurry! The ward officer is coming…",
    skin: "Outfit",
    noWebGL: "This browser can't show 3D graphics (WebGL).",
    detail: (r, c) => `${r} rows, ${c} coins`,
    summary: (b) => `Best ${b} rows`,
    moreSkins: (n) => `${n} more at the Prize Counter`,
    tickets: (n) => `${n.toLocaleString("en")} tickets`,
    ticketsWon: (n) => `Total +${n.toLocaleString("en")} tickets`,
  coinValue: (c, t) => `${c} ${c === 1 ? "coin" : "coins"} = +${t.toLocaleString("en")} tickets`,
  signInForTickets: "Sign in to turn rows and coins into tickets",
    ticketCap: "Today's tickets from this game are maxed out",
    connecting: "Joining the race…",
    go: "Go!",
    timeUp: "Time's up!",
    you: "You",
    out: "You're out!",
    spectating: (name) => `Watching ${name}`,
    watching: "A race is on, you're watching",
    outcome: { win: "You won!", loss: "You lost", draw: "A tie!" },
    raceOver: "Results",
    backToLobby: "Back to lobby",
  },
};
