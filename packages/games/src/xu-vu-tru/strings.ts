import type { Localized } from "@web-games/core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Arcade words the machine prints
// (SUPER, MINI, BONUS) stay as they are in both languages, like on a real cabinet.
import type { CardId } from "./config";

export interface Strings {
  title: string;
  subtitle: string;
  /** The start card's line about where the machine lives. */
  accountNote: string;
  guestNote: (coins: number) => string;
  /** A small corner label, e.g. "v1.0.0". */
  versionLabel: (v: string) => string;
  coins: string;
  tickets: string;
  /** The ticket counter's label for a guest (local trial tickets, never deposited). */
  trialTickets: string;
  spins: string;
  shoot: string;
  auto: string;
  on: string;
  off: string;
  /** Under the shelf for the first few shots: how to aim. */
  aimHint: string;
  /** Pops on the gate: a coin dropped in the hole, or did while the spin stock was full. */
  holeIn: string;
  stockFull: string;
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
  rules: string;
  enterCode: string;
  couponCoins: (n: number) => string;
  rulesLines: string[];
  close: string;
  menu: string;
  paused: string;
  noCoins: string;
  loading: string;
  loadFailed: string;
  retry: string;
  /** The out-of-coins panel. */
  dryTitle: string;
  dryKept: string;
  /** Countdown to the next daily coins, "hh:mm:ss". */
  dailyIn: (coins: number, clock: string) => string;
  dailyLater: (coins: number) => string;
  /** The sign-in nudge for guests (on the out-of-coins panel). */
  guestNudge: (welcome: number, daily: number) => string;
  viewMachine: string;
  lifetimeLine: (n: number) => string;
  supersLine: (n: number) => string;
  /** Allowance toasts. */
  welcomeGrant: (n: number) => string;
  dailyGrant: (n: number) => string;
  /** A deposit came back short: the server's daily ticket cap. */
  ticketCap: string;
  /** The account went away mid-game: back on the guest trial machine. */
  signedOut: string;
  /** Another device saved later: its machine was loaded. */
  conflictAdopted: string;
  /** A beta run was found in storage and dropped. */
  legacyNote: string;
  /** The What's new card. */
  newsTitle: (v: string) => string;
  newsLines: string[];
  /** Leaderboard detail, ≤ 40 chars. */
  detail: (tickets: number, supers: number) => string;
  summary: (tickets: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "XU VŨ TRỤ",
    subtitle: "Máy xu robot & vũ trụ",
    accountNote: "Máy, kệ xu và bộ thẻ được lưu vào tài khoản",
    guestNote: (n) => `Máy thử: ${n} xu, lưu trên thiết bị này`,
    versionLabel: (v) => `v${v}`,
    coins: "XU",
    tickets: "VÉ",
    trialTickets: "VÉ THỬ",
    spins: "LƯỢT",
    shoot: "BẮN",
    auto: "Tự động",
    on: "Bật",
    off: "Tắt",
    aimHint: "Canh lúc bắn để xu rơi vào lỗ đang lắc",
    holeIn: "VÀO!",
    stockFull: "Đầy lượt quay",
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
    rules: "Luật chơi",
    enterCode: "Nhập mã",
    couponCoins: (n) => `+${n} xu`,
    rulesLines: [
      "BẮN (hoặc Space): tốn 1 xu, nửa giây sau xu rơi xuống cổng dưới vòng quay, giữa hai vạch vàng.",
      "Cổng lắc qua lại, có một lỗ. Vào lỗ: 1 lượt quay thưởng. Trượt: xu nảy ra, rơi xuống kệ.",
      "Quay thưởng: đèn dừng ở một ô (ô càng rộng càng dễ trúng). Ô VÉ: cộng vé. Ô XU (1–8): xu rơi khắp kệ.",
      "Tối đa 4 lượt chờ (đèn dưới cổng). Đèn đầy mà xu vẫn vào lỗ thì mất xu đó.",
      "Xu bị đẩy rơi mép trước: +1 xu, +1 vé (hai bên có vách). Hết xu thì máy nghỉ, kệ giữ nguyên chờ bạn.",
      "Ô LÕI: lõi rơi xuống kệ + 1 MINI SPIN. Đẩy 6 lõi rơi mép trước: SUPER SPIN 80–500 vé!",
      "Ô THẺ: thẻ mèo rơi xuống kệ. Đẩy rơi mép trước: +60 vé, vào bộ sưu tập. Đủ 10 thẻ: +1000 vé.",
      "Đăng nhập: 100 xu chào mừng, 50 xu mỗi ngày, máy lưu vào tài khoản, vé vào ví vé chung của các game thùng.",
    ],
    close: "Đã hiểu",
    menu: "Menu",
    paused: "Tạm dừng",
    noCoins: "Hết xu!",
    loading: "Đang tải máy của bạn…",
    loadFailed: "Chưa tải được máy của bạn. Kiểm tra mạng rồi thử lại.",
    retry: "Thử lại",
    dryTitle: "HẾT XU!",
    dryKept: "Máy nghỉ, kệ xu vẫn giữ nguyên chờ bạn.",
    dailyIn: (n, clock) => `${n} xu hôm nay sau ${clock}`,
    dailyLater: (n) => `Mai quay lại nhận ${n} xu`,
    guestNudge: (w, d) =>
      `Đăng nhập để nhận ${w} xu chào mừng và ${d} xu mỗi ngày, lưu máy vào tài khoản và gom vé chung. Máy tài khoản bắt đầu mới: máy thử này không được chuyển sang.`,
    viewMachine: "Xem máy",
    lifetimeLine: (n) => `Máy đã trả ${n} vé`,
    supersLine: (n) => (n > 0 ? `${n} lần Super Spin` : "Chưa có Super Spin"),
    welcomeGrant: (n) => `Quà chào mừng +${n} xu`,
    dailyGrant: (n) => `Xu hôm nay +${n}`,
    ticketCap: "Hôm nay máy đã trả đủ vé, mai nhận tiếp",
    signedOut: "Đã đăng xuất: chơi máy thử",
    conflictAdopted: "Đã tải bản lưu mới hơn",
    legacyNote: "Lượt chơi bản beta cũ đã được dọn: máy 1.0 bắt đầu mới.",
    newsTitle: (v) => `Có gì mới · v${v}`,
    newsLines: [
      "Cổng lắc có lỗ: canh xu rơi vào lỗ để được lượt quay thưởng.",
      "Hình mới: tủ máy, vòng quay, xu, lõi năng lượng và robot vẽ lại.",
      "Xu mỗi ngày: đăng nhập nhận 100 xu chào mừng, rồi 50 xu mỗi ngày.",
      "Lưu đám mây: máy, kệ xu và bộ thẻ theo tài khoản, chơi tiếp ở thiết bị nào cũng được.",
      "Vé chung: vé thắng được vào ví vé dùng chung cho các game thùng.",
    ],
    detail: (tickets, supers) => (supers > 0 ? `${tickets} vé · ${supers} lần Super` : `${tickets} vé`),
    summary: (n) => `Đã gom ${n} vé`,
  },
  en: {
    title: "COSMO COINS",
    subtitle: "A robot & space coin machine",
    accountNote: "Your machine, shelf and cards are saved to your account",
    guestNote: (n) => `Trial machine: ${n} coins, kept on this device`,
    versionLabel: (v) => `v${v}`,
    coins: "COINS",
    tickets: "TICKETS",
    trialTickets: "TRIAL",
    spins: "SPINS",
    shoot: "SHOOT",
    auto: "Auto",
    on: "On",
    off: "Off",
    aimHint: "Time it so the coin drops into the swinging hole",
    holeIn: "IN!",
    stockFull: "Spins full",
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
    rules: "How to play",
    enterCode: "Enter code",
    couponCoins: (n) => `+${n} coins`,
    rulesLines: [
      "SHOOT (or Space): 1 coin lands on the gate under the wheel half a second later, between the gold marks.",
      "The gate swings with a hole in it. In the hole: a prize spin. Missed: the coin bounces onto the shelf.",
      "Prize spin: a light stops on a slot (wider = likelier). TICKETS pay at once; COINS (1–8) rain onto the shelf.",
      "Up to 4 spins wait (lamps under the gate). A coin that drops in while all 4 are lit is lost.",
      "Coins pushed off the front: +1 coin, +1 ticket each (walls guard the sides). Out of coins, the machine rests and keeps its shelf.",
      "CORE: a core drops onto the shelf + a MINI SPIN. Push 6 cores off the front: SUPER SPIN, 80–500 tickets!",
      "CARD: a cat card drops onto the shelf. Pushed off the front: +60 tickets, into the album. All 10: +1000.",
      "Signed in: 100 welcome coins, 50 coins a day, your machine saved to your account, tickets in the shared arcade wallet.",
    ],
    close: "Got it",
    menu: "Menu",
    paused: "Paused",
    noCoins: "No coins!",
    loading: "Loading your machine…",
    loadFailed: "Couldn't load your machine. Check your connection and try again.",
    retry: "Try again",
    dryTitle: "OUT OF COINS!",
    dryKept: "The machine rests, and keeps its shelf for you.",
    dailyIn: (n, clock) => `${n} coins today in ${clock}`,
    dailyLater: (n) => `Come back tomorrow for ${n} coins`,
    guestNudge: (w, d) =>
      `Sign in for ${w} welcome coins and ${d} coins a day, a machine saved to your account, and shared tickets. Your account machine starts fresh: this trial machine doesn't carry over.`,
    viewMachine: "View machine",
    lifetimeLine: (n) => (n === 1 ? "This machine has paid 1 ticket" : `This machine has paid ${n} tickets`),
    supersLine: (n) => (n === 0 ? "No Super Spin yet" : n === 1 ? "1 Super Spin" : `${n} Super Spins`),
    welcomeGrant: (n) => `Welcome gift +${n} coins`,
    dailyGrant: (n) => `Today's coins +${n}`,
    ticketCap: "Today's ticket limit reached, more tomorrow",
    signedOut: "Signed out: playing the trial machine",
    conflictAdopted: "Loaded a newer save",
    legacyNote: "Your old beta run was cleared: the 1.0 machine starts fresh.",
    newsTitle: (v) => `What's new · v${v}`,
    newsLines: [
      "A swinging gate with a hole: time your coin into it for a prize spin.",
      "New art: the cabinet, wheel, coins, energy cores and robots, all redrawn.",
      "Daily coins: sign in for 100 welcome coins, then 50 coins every day.",
      "Cloud save: your machine, shelf and cards follow your account to any device.",
      "Shared tickets: the tickets you win go to the arcade wallet every arcade game shares.",
    ],
    detail: (tickets, supers) => (supers > 0 ? `${tickets} tickets · ${supers}× Super` : `${tickets} tickets`),
    summary: (n) => `${n} tickets collected`,
  },
};
