import type { Localized } from "@web-games/core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Arcade words the machine prints
// (SUPER, MINI, BONUS) stay as they are in both languages, like on a real cabinet.
import type { CardId } from "./config";

export interface Strings {
  title: string;
  subtitle: string;
  beta: string;
  betaNote: (coins: number) => string;
  coins: string;
  tickets: string;
  spins: string;
  shoot: string;
  auto: string;
  on: string;
  off: string;
  holdHint: string;
  youWin: string;
  marquee: (n: number) => string;
  superSpin: string;
  miniSpin: string;
  coreIn: (n: number, of: number) => string;
  coinsWon: (n: number) => string;
  coinRain: (n: number) => string;
  cardNew: string;
  cardDupe: string;
  album: string;
  albumTitle: string;
  albumNote: (each: number, set: number) => string;
  setDone: string;
  setBonus: (n: number) => string;
  cards: Record<CardId, string>;
  start: string;
  resume: string;
  newRun: string;
  rules: string;
  enterCode: string;
  couponCoins: (n: number) => string;
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
  setsLine: (n: number) => string;
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
    auto: "Tự động",
    on: "Bật",
    off: "Tắt",
    holdHint: "Giữ nút để bắn liên tục",
    youWin: "BẠN THẮNG",
    marquee: (n) => `SUPER tới ${n} vé`,
    superSpin: "SUPER SPIN!",
    miniSpin: "MINI SPIN!",
    coreIn: (n, of) => `Lõi năng lượng ${n}/${of}`,
    coinsWon: (n) => `+${n} xu`,
    coinRain: (n) => `${n} xu`,
    cardNew: "Thẻ mới!",
    cardDupe: "Thẻ trùng",
    album: "Thẻ",
    albumTitle: "Bộ sưu tập mèo",
    albumNote: (each, set) => `Mỗi thẻ ${each} vé · đủ 10 thẻ +${set} vé`,
    setDone: "ĐỦ BỘ SƯU TẬP!",
    setBonus: (n) => `+${n} vé`,
    cards: {
      persian: "Mèo Ba Tư",
      british: "Mèo Anh lông ngắn",
      siamese: "Mèo Xiêm",
      "maine-coon": "Mèo Maine Coon",
      "scottish-fold": "Mèo Scottish Fold",
      ragdoll: "Mèo Ragdoll",
      bengal: "Mèo Bengal",
      sphynx: "Mèo Sphynx",
      munchkin: "Mèo Munchkin",
      tabby: "Mèo mướp Việt",
    },
    start: "Bắt đầu",
    resume: "Chơi tiếp",
    newRun: "Lượt mới",
    rules: "Luật chơi",
    enterCode: "Nhập mã",
    couponCoins: (n) => `+${n} xu`,
    rulesLines: [
      "Bấm BẮN (hoặc phím Space): tốn 1 xu, xu bay lên vòng quay. Ô đối diện ống bắn lúc xu chạm vòng quyết định thưởng.",
      "Ô VÉ: cộng vé ngay, xu không rơi xuống. Ô XU (1, 2, 4, 6, 8): ngần ấy xu rơi rải khắp kệ.",
      "Thanh đẩy dồn mọi thứ ra mép. Hai bên có vách chắn, chỉ rơi ra mép trước: mỗi xu +1 xu, +1 vé.",
      "Ô LÕI: một viên lõi rơi xuống kệ + 1 lượt MINI SPIN (20–50 vé hoặc 20–35 xu).",
      "Chỉ lõi bị đẩy rơi mép trước mới được tính. Đủ 6 lõi: SUPER SPIN 80–500 vé!",
      "Ô THẺ: một thẻ mèo rơi xuống kệ. Đẩy rơi mép trước: +60 vé và vào bộ sưu tập. Đủ 10 thẻ khác nhau: +1000 vé.",
      "Hết xu và kệ đứng yên là hết lượt. Điểm = tổng vé.",
    ],
    close: "Đã hiểu",
    menu: "Menu",
    paused: "Tạm dừng",
    noCoins: "Hết xu!",
    over: "HẾT XU!",
    totalTickets: "Tổng vé",
    supersLine: (n) => (n > 0 ? `${n} lần Super Spin` : "Chưa có Super Spin"),
    best: (n) => `Kỷ lục ${n} vé`,
    newBest: "Kỷ lục mới!",
    again: "Chơi lại",
    detail: (tickets, supers) => (supers > 0 ? `${tickets} vé · ${supers} lần Super` : `${tickets} vé`),
    setsLine: (n) => `Hoàn tất ${n} bộ thẻ`,
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
    auto: "Auto",
    on: "On",
    off: "Off",
    holdHint: "Hold the button to keep firing",
    youWin: "YOU WIN",
    marquee: (n) => `SUPER UP TO ${n}`,
    superSpin: "SUPER SPIN!",
    miniSpin: "MINI SPIN!",
    coreIn: (n, of) => `Energy core ${n}/${of}`,
    coinsWon: (n) => `+${n} coins`,
    coinRain: (n) => (n === 1 ? "1 coin" : `${n} coins`),
    cardNew: "New card!",
    cardDupe: "Duplicate",
    album: "Cards",
    albumTitle: "Cat collection",
    albumNote: (each, set) => `${each} tickets a card · all 10: +${set}`,
    setDone: "SET COMPLETE!",
    setBonus: (n) => `+${n} tickets`,
    cards: {
      persian: "Persian",
      british: "British Shorthair",
      siamese: "Siamese",
      "maine-coon": "Maine Coon",
      "scottish-fold": "Scottish Fold",
      ragdoll: "Ragdoll",
      bengal: "Bengal",
      sphynx: "Sphynx",
      munchkin: "Munchkin",
      tabby: "Vietnamese tabby",
    },
    start: "Start",
    resume: "Continue",
    newRun: "New run",
    rules: "How to play",
    enterCode: "Enter code",
    couponCoins: (n) => `+${n} coins`,
    rulesLines: [
      "Press SHOOT (or Space): 1 coin flies up to the wheel. The slot facing the chute when it lands pays.",
      "TICKET slot: tickets at once, and the coin stays up. COIN slot (1, 2, 4, 6, 8): that many coins rain across the shelf.",
      "The pusher shoves everything forward. Walls guard both sides, so things only fall off the front: each coin gives +1 coin, +1 ticket.",
      "CORE slot: an energy core drops onto the shelf + 1 MINI SPIN (20–50 tickets or 20–35 coins).",
      "Only cores pushed off the front count. Collect 6: SUPER SPIN for 80–500 tickets!",
      "CARD slot: a cat card drops onto the shelf. Push it off the front: +60 tickets and it joins your album. All 10 different cards: +1000.",
      "Out of coins and the shelf at rest ends the run. Score = total tickets.",
    ],
    close: "Got it",
    menu: "Menu",
    paused: "Paused",
    noCoins: "No coins!",
    over: "OUT OF COINS!",
    totalTickets: "Total tickets",
    supersLine: (n) => (n === 0 ? "No Super Spin yet" : n === 1 ? "1 Super Spin" : `${n} Super Spins`),
    best: (n) => `Best ${n} tickets`,
    newBest: "New best!",
    again: "Play again",
    detail: (tickets, supers) => (supers > 0 ? `${tickets} tickets · ${supers}× Super` : `${tickets} tickets`),
    setsLine: (n) => (n === 1 ? "1 card set completed" : `${n} card sets completed`),
    summary: (n) => `Best ${n} tickets`,
  },
};
