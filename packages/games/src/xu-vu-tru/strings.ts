import type { Localized } from "@web-games/core/i18n";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Arcade words the machine prints
// (SUPER, MINI, BONUS) stay as they are in both languages, like on a real cabinet.
import type { CardId } from "./config";

/** A ticket count with thousands grouped the local way: 12.345 (vi), 12,345 (en). */
const grouped = (n: number, sep: string) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const vn = (n: number) => grouped(n, ".");
const en = (n: number) => grouped(n, ",");

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
  /** A tiny caption on the ticket counter, signed in: the balance is the shared arcade wallet. */
  sharedWallet: string;
  spins: string;
  shoot: string;
  auto: string;
  on: string;
  off: string;
  /** Under the shelf for the first few shots: how to aim, in one sentence a child gets. */
  aimHint: string;
  /** Pops on the gate when a coin drops in the hole. */
  holeIn: string;
  /** The robot jar's label on the front lip, and its pop when it eats coins. */
  jar: string;
  jarYum: string;
  youWin: string;
  marquee: (n: number) => string;
  /**
   * The Lucky Jar (Hũ may mắn, shared by every arcade game): the robot jar's
   * badge, the marquee's pool line and sign-in hint, the roll's suspense and
   * its two outcomes, and the toast a guest sees after a Super spin.
   */
  jarBadge: string;
  jarPool: (n: number) => string;
  jarSignIn: string;
  jarRolling: string;
  jarMissed: string;
  jarWinTitle: string;
  jarWinAmount: (n: number) => string;
  jarWon: (n: number) => string;
  jarGuestSuper: string;
  superSpin: string;
  miniSpin: string;
  /** The reels' label while a Mini spin runs (an arcade word, the same in both languages). */
  miniLabel: string;
  /**
   * The full-screen Super wheel (1.4.0): the name on its crest, the core count
   * under it, the big button and its line, the auto-spin note, the prize
   * screen's "tap to collect", and the line that closes it after the Lucky Jar.
   */
  superLabel: string;
  superCores: (n: number, of: number) => string;
  superSpinButton: string;
  superSpinLine: string;
  superAutoLine: string;
  superCollect: string;
  superContinue: string;
  coreIn: (n: number, of: number) => string;
  coinsWon: (n: number) => string;
  coinRain: (n: number) => string;
  cardNew: string;
  cardDupe: string;
  /** The badge on the rare card (card face, album slot, drop toast). */
  rare: string;
  album: string;
  albumTitle: string;
  albumNote: string;
  /** A card's count in the inventory, e.g. "x5". */
  count: (n: number) => string;
  /** A cat collected once but exchanged down to none. */
  traded: string;
  /** The card exchange: its button and screen. */
  exchange: string;
  pickCard: string;
  oneCard: string;
  fullSet: string;
  setMissing: (n: number) => string;
  setReady: string;
  ticketsN: (n: number) => string;
  confirmCard: (name: string, reward: string) => string;
  confirmSet: (reward: string) => string;
  confirm: string;
  cancel: string;
  done: string;
  exchanged: (reward: string) => string;
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
  /** The out-of-coins strip by the coin counter (never blocks the machine): countdown to the next daily coins, "hh:mm:ss". */
  dailyIn: (coins: number, clock: string) => string;
  dailyLater: (coins: number) => string;
  /** The strip's sign-in hint for guests. */
  guestHint: (welcome: number) => string;
  /** The card viewer: how to flip, and its close button. */
  flipHint: string;
  /** The start card, signed in: the shared wallet balance (the same number as the VÉ counter). */
  walletLine: (n: number) => string;
  /** The start card, guest: the local trial tickets. */
  trialLine: (n: number) => string;
  supersLine: (n: number) => string;
  /** Allowance toasts: the welcome, a daily on login streak day `day`, a Prize Counter purchase. */
  welcomeGrant: (n: number) => string;
  streakGrant: (day: number, n: number) => string;
  shopCoins: (n: number) => string;
  /** A card from the Prize Counter: the toast, and the line over the card viewer. */
  shopCard: (name: string) => string;
  shopCardTitle: string;
  /**
   * The out-of-coins strip's second line: where to trade tickets for coins. The
   * portal gives a game no way to open the Prize Counter, so it points at the
   * ticket chip (top bar on phones, sidebar on desktop).
   */
  counterHint: string;
  /** A deposit came back short: the server's daily ticket cap. */
  ticketCap: string;
  /** The account went away mid-game: back on the guest trial machine. */
  signedOut: string;
  /** Another device saved later: its machine was loaded. */
  conflictAdopted: string;
  /** A beta run was found in storage and dropped. */
  legacyNote: string;
  /** The What's new card's heading; its lines come from changelog.ts. */
  newsTitle: (v: string) => string;
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
    sharedWallet: "Ví chung",
    spins: "LƯỢT",
    shoot: "BẮN",
    auto: "Tự động",
    on: "Bật",
    off: "Tắt",
    aimHint: "Bấm BẮN khi lỗ sáng xanh là xu rơi trúng lỗ!",
    holeIn: "VÀO!",
    jar: "HŨ",
    jarYum: "Măm!",
    youWin: "BẠN THẮNG",
    marquee: (n) => `SUPER tới ${n} vé`,
    jarBadge: "Nuôi Hũ may mắn",
    jarPool: (n) => `Hũ may mắn ${vn(n)} vé`,
    jarSignIn: "Đăng nhập để Super có cơ hội trúng Hũ",
    jarRolling: "Hũ may mắn…",
    jarMissed: "Hũ may mắn chưa nổ lần này",
    jarWinTitle: "HŨ MAY MẮN!",
    jarWinAmount: (n) => `+${vn(n)} vé`,
    jarWon: (n) => `Bạn trúng Hũ may mắn ${vn(n)} vé!`,
    jarGuestSuper: "Đăng nhập để Super trúng được Hũ may mắn",
    superSpin: "SUPER SPIN!",
    miniSpin: "MINI SPIN!",
    miniLabel: "MINI",
    superLabel: "SUPER",
    superCores: (n, of) => `${n}/${of} lõi`,
    superSpinButton: "QUAY!",
    superSpinLine: "Nhận Vé thưởng!",
    superAutoLine: "Tự động quay…",
    superCollect: "Chạm để nhận",
    superContinue: "Chạm để chơi tiếp",
    coreIn: (n, of) => `Lõi năng lượng ${n}/${of}`,
    coinsWon: (n) => `+${n} xu`,
    coinRain: (n) => `${n} xu`,
    cardNew: "Thẻ mới!",
    cardDupe: "Thẻ trùng",
    rare: "Hiếm",
    album: "Thẻ",
    albumTitle: "Kho thẻ mèo",
    albumNote: "Thẻ trùng được cộng dồn, đổi lấy vé",
    count: (n) => `x${n}`,
    traded: "đã đổi",
    exchange: "Đổi thẻ",
    pickCard: "Chọn một thẻ để đổi",
    oneCard: "Đổi 1 thẻ",
    fullSet: "Đổi cả bộ 10 giống (mỗi giống 1 thẻ)",
    setMissing: (n) => `Còn thiếu ${n} giống`,
    setReady: "Đủ bộ!",
    ticketsN: (n) => `+${n} vé`,
    confirmCard: (name, reward) => `Đổi 1 thẻ ${name} lấy ${reward}?`,
    confirmSet: (reward) => `Đổi 10 thẻ (mỗi giống 1 thẻ) lấy ${reward}?`,
    confirm: "Đổi",
    cancel: "Huỷ",
    done: "Xong",
    exchanged: (reward) => `Đã đổi: ${reward}`,
    setDone: "ĐỔI CẢ BỘ!",
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
      "Bấm BẮN khi lỗ sáng xanh là xu rơi trúng lỗ!",
      "BẮN (hoặc Space) tốn 1 xu; xu luôn rơi vào vòng đích dưới vòng quay. Vào lỗ: 1 lượt quay thưởng. Trượt: xu nảy xuống kệ.",
      "Quay thưởng: đèn dừng ở một ô (ô càng rộng càng dễ trúng). Ô VÉ: cộng vé. Ô XU: xu rơi khắp kệ.",
      "Tối đa 4 lượt chờ (đèn dưới cổng). Đủ 4 lượt thì nắp lỗ đóng: xu nảy xuống kệ, không mất xu nào.",
      "Xu bị đẩy rơi mép trước: +1 xu, +1 vé (hai bên có vách). Riêng khúc giữa có hũ robot: xu rơi vào hũ thì máy giữ.",
      "Ô LÕI: lõi rơi xuống kệ + 1 MINI SPIN. Đẩy 6 lõi rơi mép trước: mở vòng quay SUPER cả màn hình, 80–500 vé! Lõi và thẻ rơi vào hũ vẫn được tính.",
      "Hũ may mắn: xu rơi vào hũ robot nuôi một hũ vé chung của mọi game thùng. Đã đăng nhập, mỗi SUPER SPIN có một cơ hội trúng cả hũ (hũ càng đầy càng dễ nổ), vé vào ví.",
      "Ô THẺ: thẻ mèo rơi xuống kệ. Đẩy rơi mép trước: vào kho thẻ, thẻ trùng cộng dồn. Mèo Ragdoll hiếm hơn.",
      "Đổi thẻ lấy vé khi bạn muốn: 1 thẻ = 60 vé (Ragdoll 300 vé); cả bộ 10 giống = 1000 vé.",
      "Đăng nhập: 100 xu chào mừng, xu mỗi ngày tăng theo chuỗi ngày (50 tới 150 xu), máy lưu vào tài khoản, vé vào ví vé chung của các game thùng.",
      "Quầy đổi thưởng (bấm ô vé ngoài trang): đổi vé lấy xu hoặc gói thẻ mèo. Hết xu thì máy nghỉ, kệ giữ nguyên chờ bạn.",
    ],
    close: "Đã hiểu",
    menu: "Menu",
    paused: "Tạm dừng",
    noCoins: "Hết xu!",
    loading: "Đang tải máy của bạn…",
    loadFailed: "Chưa tải được máy của bạn. Kiểm tra mạng rồi thử lại.",
    retry: "Thử lại",
    dailyIn: (n, clock) => `+${n} xu sau ${clock}`,
    dailyLater: (n) => `Mai nhận ${n} xu`,
    guestHint: (w) => `Đăng nhập nhận ${w} xu`,
    flipHint: "Chạm thẻ để lật",
    walletLine: (n) => `Ví vé: ${vn(n)} vé, dùng chung mọi game thùng`,
    trialLine: (n) => `Vé thử: ${vn(n)} vé (chỉ trên máy này)`,
    supersLine: (n) => (n > 0 ? `${n} lần Super Spin` : "Chưa có Super Spin"),
    welcomeGrant: (n) => `Quà chào mừng +${n} xu`,
    streakGrant: (day, n) => `Chuỗi ngày ${day}: +${n} xu`,
    shopCoins: (n) => `Quầy đổi thưởng: +${n} xu`,
    shopCard: (name) => `Quầy đổi thưởng: ${name}`,
    shopCardTitle: "Thẻ từ Quầy đổi thưởng",
    counterHint: "Thêm xu: bấm ô vé ngoài trang để mở Quầy đổi thưởng",
    ticketCap: "Hôm nay máy đã trả đủ vé, mai nhận tiếp",
    signedOut: "Đã đăng xuất: chơi máy thử",
    conflictAdopted: "Đã tải bản lưu mới hơn",
    legacyNote: "Lượt chơi bản beta cũ đã được dọn: máy 1.0 bắt đầu mới.",
    newsTitle: (v) => `Có gì mới (v${v})`,
    detail: (tickets, supers) => (supers > 0 ? `${tickets} vé, ${supers} lần Super` : `${tickets} vé`),
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
    sharedWallet: "Shared",
    spins: "SPINS",
    shoot: "SHOOT",
    auto: "Auto",
    on: "On",
    off: "Off",
    aimHint: "Press SHOOT when the hole glows green and the coin drops right in!",
    holeIn: "IN!",
    jar: "JAR",
    jarYum: "Yum!",
    youWin: "YOU WIN",
    marquee: (n) => `SUPER UP TO ${n}`,
    jarBadge: "Feeds the Lucky Jar",
    jarPool: (n) => `Lucky Jar ${en(n)} tickets`,
    jarSignIn: "Sign in so Supers can win the Jar",
    jarRolling: "Lucky Jar…",
    jarMissed: "The Lucky Jar didn't tip this time",
    jarWinTitle: "LUCKY JAR!",
    jarWinAmount: (n) => `+${en(n)} tickets`,
    jarWon: (n) => `You won the Lucky Jar: ${en(n)} tickets!`,
    jarGuestSuper: "Sign in so your Supers can win the Lucky Jar",
    superSpin: "SUPER SPIN!",
    miniSpin: "MINI SPIN!",
    miniLabel: "MINI",
    superLabel: "SUPER",
    superCores: (n, of) => `${n}/${of} cores`,
    superSpinButton: "SPIN!",
    superSpinLine: "Win tickets!",
    superAutoLine: "Auto spin…",
    superCollect: "Tap to collect",
    superContinue: "Tap to play on",
    coreIn: (n, of) => `Energy core ${n}/${of}`,
    coinsWon: (n) => `+${n} coins`,
    coinRain: (n) => (n === 1 ? "1 coin" : `${n} coins`),
    cardNew: "New card!",
    cardDupe: "Duplicate",
    rare: "Rare",
    album: "Cards",
    albumTitle: "Cat cards",
    albumNote: "Duplicates stack, exchange them for tickets",
    count: (n) => `x${n}`,
    traded: "traded",
    exchange: "Exchange",
    pickCard: "Pick a card to exchange",
    oneCard: "One card",
    fullSet: "A full set of 10 (one of each cat)",
    setMissing: (n) => (n === 1 ? "1 cat missing" : `${n} cats missing`),
    setReady: "Full set!",
    ticketsN: (n) => `+${n} tickets`,
    confirmCard: (name, reward) => `Exchange one ${name} card for ${reward}?`,
    confirmSet: (reward) => `Exchange 10 cards (one of each cat) for ${reward}?`,
    confirm: "Exchange",
    cancel: "Cancel",
    done: "Done",
    exchanged: (reward) => `Exchanged: ${reward}`,
    setDone: "FULL SET!",
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
      "Press SHOOT when the hole glows green and the coin drops right in!",
      "SHOOT (or Space) costs 1 coin, which always lands on the target ring under the wheel. In the hole: a prize spin. Missed: it bounces onto the shelf.",
      "Prize spin: a light stops on a slot (wider = likelier). TICKETS pay at once; COINS rain onto the shelf.",
      "Up to 4 spins wait (lamps under the gate). With all 4 lit the hole's lid shuts: coins bounce onto the shelf, none is wasted.",
      "Coins pushed off the front: +1 coin, +1 ticket each (walls guard the sides). In the middle sits the robot jar: coins that fall in are kept by the machine.",
      "CORE: a core drops onto the shelf + a MINI SPIN. Push 6 cores off the front: the full-screen SUPER wheel, 80–500 tickets! Cores and cards still count in the jar's spot.",
      "Lucky Jar: coins the robot jar eats fill a jar shared by all arcade games. Signed in, each SUPER SPIN can win it all (the fuller, the likelier).",
      "CARD: a cat card drops onto the shelf. Pushed off the front, it goes into your card stash; duplicates stack. The Ragdoll is rare.",
      "Exchange cards for tickets when you like: one card = 60 tickets (Ragdoll 300); a full set of 10 cats = 1000 tickets.",
      "Signed in: 100 welcome coins, daily coins that grow with your login streak (50 up to 150), your machine saved to your account, tickets in the shared arcade wallet.",
      "The Prize Counter (tap your ticket count outside the game) trades tickets for coins or cat card packs. Out of coins, the machine rests and keeps its shelf.",
    ],
    close: "Got it",
    menu: "Menu",
    paused: "Paused",
    noCoins: "No coins!",
    loading: "Loading your machine…",
    loadFailed: "Couldn't load your machine. Check your connection and try again.",
    retry: "Try again",
    dailyIn: (n, clock) => `+${n} coins in ${clock}`,
    dailyLater: (n) => `${n} coins tomorrow`,
    guestHint: (w) => `Sign in for ${w} coins`,
    flipHint: "Tap the card to flip it",
    walletLine: (n) => `Ticket wallet: ${en(n)} ${n === 1 ? "ticket" : "tickets"}, shared by every arcade game`,
    trialLine: (n) => `Trial tickets: ${en(n)} ${n === 1 ? "ticket" : "tickets"} (this device only)`,
    supersLine: (n) => (n === 0 ? "No Super Spin yet" : n === 1 ? "1 Super Spin" : `${n} Super Spins`),
    welcomeGrant: (n) => `Welcome gift +${n} coins`,
    streakGrant: (day, n) => `Streak day ${day}: +${n} coins`,
    shopCoins: (n) => `Prize Counter: +${n} coins`,
    shopCard: (name) => `Prize Counter: ${name}`,
    shopCardTitle: "From the Prize Counter",
    counterHint: "More coins: tap your ticket count outside the game for the Prize Counter",
    ticketCap: "Today's ticket limit reached, more tomorrow",
    signedOut: "Signed out: playing the trial machine",
    conflictAdopted: "Loaded a newer save",
    legacyNote: "Your old beta run was cleared: the 1.0 machine starts fresh.",
    newsTitle: (v) => `What's new (v${v})`,
    detail: (tickets, supers) => (supers > 0 ? `${tickets} tickets, ${supers}× Super` : `${tickets} tickets`),
    summary: (n) => `${n} tickets collected`,
  },
};
