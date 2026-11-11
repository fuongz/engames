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
  /** Under the shelf for the first few shots: how to aim, in one sentence a child gets. */
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
  coinsN: (n: number) => string;
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
    aimHint: "Bấm BẮN khi lỗ sáng xanh là xu rơi trúng lỗ!",
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
    rare: "Hiếm",
    album: "Thẻ",
    albumTitle: "Kho thẻ mèo",
    albumNote: "Thẻ trùng được cộng dồn · đổi lấy vé hoặc xu",
    count: (n) => `x${n}`,
    traded: "đã đổi",
    exchange: "Đổi thẻ",
    pickCard: "Chọn một thẻ để đổi",
    oneCard: "Đổi 1 thẻ",
    fullSet: "Đổi cả bộ 10 giống (mỗi giống 1 thẻ)",
    setMissing: (n) => `Còn thiếu ${n} giống`,
    setReady: "Đủ bộ!",
    ticketsN: (n) => `+${n} vé`,
    coinsN: (n) => `+${n} xu`,
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
      "Tối đa 4 lượt chờ (đèn dưới cổng). Đèn đầy mà xu vẫn vào lỗ thì mất xu đó.",
      "Xu bị đẩy rơi mép trước: +1 xu, +1 vé (hai bên có vách). Hết xu thì máy nghỉ, kệ giữ nguyên chờ bạn.",
      "Ô LÕI: lõi rơi xuống kệ + 1 MINI SPIN. Đẩy 6 lõi rơi mép trước: SUPER SPIN 80–500 vé!",
      "Ô THẺ: thẻ mèo rơi xuống kệ. Đẩy rơi mép trước: vào kho thẻ, thẻ trùng cộng dồn. Mèo Ragdoll hiếm hơn.",
      "Đổi thẻ khi bạn muốn: 1 thẻ = 60 vé hoặc 3 xu (Ragdoll 300 vé hoặc 15 xu); cả bộ 10 giống = 1000 vé hoặc 50 xu.",
      "Đăng nhập: 100 xu chào mừng, 50 xu mỗi ngày, máy lưu vào tài khoản, vé vào ví vé chung của các game thùng.",
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
      "Bắn dễ hơn: xu luôn rơi vào vòng đích, lỗ to hơn và sáng xanh khi tới lúc bấm.",
      "Thêm nhiều ô xu: quay thưởng ra xu thường hơn, vòng quay 11 ô to rõ.",
      "Mèo Ragdoll hiếm: khó gặp hơn các bé mèo khác, có huy hiệu Hiếm.",
      "Kho thẻ: thẻ trùng được cộng dồn; tự chọn lúc đổi 1 thẻ hoặc cả bộ lấy vé hay xu.",
      "Xem thẻ: chạm thẻ trong kho để xem to, nghiêng và lật thẻ.",
      "Chơi liền mạch: hết xu không còn bảng chắn, bảng xếp hạng tự cập nhật.",
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
    aimHint: "Press SHOOT when the hole glows green and the coin drops right in!",
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
    rare: "Rare",
    album: "Cards",
    albumTitle: "Cat cards",
    albumNote: "Duplicates stack · exchange them for tickets or coins",
    count: (n) => `x${n}`,
    traded: "traded",
    exchange: "Exchange",
    pickCard: "Pick a card to exchange",
    oneCard: "One card",
    fullSet: "A full set of 10 (one of each cat)",
    setMissing: (n) => (n === 1 ? "1 cat missing" : `${n} cats missing`),
    setReady: "Full set!",
    ticketsN: (n) => `+${n} tickets`,
    coinsN: (n) => `+${n} coins`,
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
      "Up to 4 spins wait (lamps under the gate). A coin that drops in while all 4 are lit is lost.",
      "Coins pushed off the front: +1 coin, +1 ticket each (walls guard the sides). Out of coins, the machine rests and keeps its shelf.",
      "CORE: a core drops onto the shelf + a MINI SPIN. Push 6 cores off the front: SUPER SPIN, 80–500 tickets!",
      "CARD: a cat card drops onto the shelf. Pushed off the front, it goes into your card stash; duplicates stack. The Ragdoll is rare.",
      "Exchange cards when you like: one card = 60 tickets or 3 coins (Ragdoll 300 or 15); a full set of 10 cats = 1000 tickets or 50 coins.",
      "Signed in: 100 welcome coins, 50 coins a day, your machine saved to your account, tickets in the shared arcade wallet.",
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
      "Easier aiming: every coin lands on the target ring, the hole is bigger and glows green when it's time to shoot.",
      "More coin prizes: prize spins pay coins more often, on a bigger, clearer 11-slot wheel.",
      "The rare Ragdoll: harder to find than the other cats, with a Rare badge.",
      "Card stash: duplicates stack; you choose when to exchange one card or a full set, for tickets or coins.",
      "Card viewer: tap a card in your stash to see it big, tilt it and flip it over.",
      "Nonstop play: no more out-of-coins panel, and the leaderboard updates by itself.",
    ],
    detail: (tickets, supers) => (supers > 0 ? `${tickets} tickets · ${supers}× Super` : `${tickets} tickets`),
    summary: (n) => `${n} tickets collected`,
  },
};
