import type { Localized } from "@web-games/core/i18n";
import type { Difficulty } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Money is in thousands of
// đồng and always written "200K".

export const money = (n: number) => `${Math.round(n)}K`;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface Strings {
  title: string;
  subtitle: string;
  level: Record<Difficulty, string>;
  // menu
  players: string;
  onPhone: string;
  onPhoneHint: (humans: number, bots: number) => string;
  computer: string;
  timeLimit: string;
  noLimit: string;
  minutes: (n: number) => string;
  start: string;
  resume: string;
  rules: string;
  rulesLines: string[];
  close: string;
  // names
  you: string;
  player: (n: number) => string;
  bot: string;
  // hud
  turnOf: (name: string) => string;
  yourTurn: string;
  timeLeft: (m: number, s: number) => string;
  thinking: (name: string) => string;
  passPhone: (name: string) => string;
  ready: string;
  board: string;
  follow: string;
  log: string;
  menu: string;
  // the decision panel
  roll: string;
  rollAgain: string;
  rollJail: string;
  endTurn: string;
  assets: string;
  trade: string;
  payJail: (fine: number) => string;
  useCard: string;
  inJail: (tries: number) => string;
  buy: (price: number) => string;
  toAuction: string;
  forSale: string;
  cantAfford: string;
  auction: string;
  bidNow: (bid: number, name: string) => string;
  noBids: string;
  passBid: string;
  waitBid: (name: string) => string;
  owe: (amount: number, to: string) => string;
  oweHint: string;
  bankrupt: string;
  confirmBankrupt: string;
  offerFrom: (name: string) => string;
  youGet: string;
  youGive: string;
  accept: string;
  reject: string;
  waitAnswer: (name: string) => string;
  nothing: string;
  freeCard: string;
  bank: string;
  at: (sq: string) => string;
  cashNow: (x: number) => string;
  deedsOf: (name: string) => string;
  cards: (n: number) => string;
  give: string;
  get: string;
  // assets sheet
  yourDeeds: string;
  noDeeds: string;
  addHouse: string;
  sellHouse: string;
  mortgage: (v: number) => string;
  unmortgage: (v: number) => string;
  mortgaged: string;
  housesLeft: (h: number, hotels: number) => string;
  done: string;
  // trade sheet
  tradeWith: string;
  cash: string;
  send: string;
  cancel: string;
  offersLeft: (n: number) => string;
  // deed card
  price: string;
  rent: string;
  rentSet: string;
  withHouses: (n: number) => string;
  hotel: string;
  houseCost: string;
  mortgageValue: string;
  owner: (name: string) => string;
  noOwner: string;
  transportRent: string;
  utilityRent: string;
  cardTitle: Record<"chance" | "chest", string>;
  // events
  ev: {
    turn: (a: string) => string;
    rent: (a: string, x: number, b: string) => string;
    buy: (a: string, sq: string, x: number) => string;
    salary: (a: string, x: number) => string;
    tax: (a: string, x: number) => string;
    payBank: (a: string, x: number) => string;
    payTo: (a: string, x: number, b: string) => string;
    gain: (a: string, x: number) => string;
    jail: (a: string) => string;
    jailDoubles: (a: string) => string;
    freePay: (a: string) => string;
    freeCard: (a: string) => string;
    freeDoubles: (a: string) => string;
    freeFine: (a: string) => string;
    stay: (a: string) => string;
    again: (a: string) => string;
    auction: (sq: string) => string;
    bid: (a: string, x: number) => string;
    pass: (a: string) => string;
    won: (a: string, sq: string, x: number) => string;
    unsold: (sq: string) => string;
    build: (a: string, sq: string) => string;
    hotel: (a: string, sq: string) => string;
    sell: (a: string, sq: string) => string;
    mortgage: (a: string, sq: string) => string;
    unmortgage: (a: string, sq: string) => string;
    offer: (a: string, b: string) => string;
    accepted: (b: string, a: string) => string;
    rejected: (b: string) => string;
    debt: (a: string, x: number) => string;
    bankrupt: (a: string) => string;
    over: (a: string) => string;
  };
  // result
  youWin: string;
  winOf: (name: string) => string;
  byTime: string;
  byLast: string;
  place: (n: number) => string;
  worth: (x: number) => string;
  scoreLine: (score: number) => string;
  again: string;
  backToLobby: string;
  watching: string;
  away: string;
  // board text
  detail: (level: Difficulty, worth: number) => string;
  onlineDetail: (place: number, n: number, worth: number) => string;
  summary: (level: Difficulty, wins: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "CỜ TỶ PHÚ",
    subtitle: "Mua đất · xây nhà · thu tiền thuê",
    level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
    players: "Số người chơi",
    onPhone: "Người chơi trên máy này",
    onPhoneHint: (h, b) => (b === 0 ? `${h} người chuyền máy cho nhau` : h === 1 ? `Bạn và ${b} máy` : `${h} người chuyền máy · ${b} máy`),
    computer: "Máy chơi mức",
    timeLimit: "Giới hạn giờ",
    noLimit: "Không",
    minutes: (n) => `${n} phút`,
    start: "Bắt đầu",
    resume: "Chơi tiếp ván dở",
    rules: "Luật chơi",
    rulesLines: [
      "Đổ 2 xúc xắc, đi quanh 40 ô. Qua Xuất phát nhận 200K.",
      "Dừng ở đất trống: mua, hoặc để mọi người đấu giá.",
      "Dừng ở đất người khác: trả tiền thuê. Đủ bộ màu thì thuê gấp đôi.",
      "Đủ bộ màu: xây nhà đều tay, 4 nhà rồi lên khách sạn. Ngân hàng chỉ có 32 nhà, 12 khách sạn.",
      "Bến xe, ga, cảng, sân bay: thuê theo số bến. Điện, nước: thuê theo xúc xắc.",
      "Cầm cố được nửa giá; chuộc lại thêm 10%. Bán nhà được nửa giá.",
      "Đổ đôi được đổ tiếp; 3 lần đôi liền là vào tù. Ra tù: nộp 50K, dùng thẻ, hoặc đổ đôi (tối đa 3 lượt).",
      "Giao dịch: đổi đất, tiền, thẻ ra tù với người khác.",
      "Hết tiền mà bán hết vẫn không đủ thì phá sản. Người cuối cùng trụ lại thắng; hết giờ thì ai giàu nhất thắng.",
    ],
    close: "Đã hiểu",
    you: "Bạn",
    player: (n) => `Người ${n}`,
    bot: "máy",
    turnOf: (name) => `Lượt của ${name}`,
    yourTurn: "Lượt của bạn",
    timeLeft: (m, s) => `${m}:${String(s).padStart(2, "0")}`,
    thinking: (name) => `${name} đang tính…`,
    passPhone: (name) => `Đưa máy cho ${name}`,
    ready: "Sẵn sàng",
    board: "Cả bàn",
    follow: "Theo quân",
    log: "Nhật ký",
    menu: "Menu",
    roll: "Đổ xúc xắc",
    rollAgain: "Đổ tiếp",
    rollJail: "Đổ tìm đôi",
    endTurn: "Hết lượt",
    assets: "Tài sản",
    trade: "Giao dịch",
    payJail: (f) => `Nộp ${money(f)}`,
    useCard: "Dùng thẻ",
    inJail: (t) => `Đang ở trại giam · lần ${t + 1}/3`,
    buy: (p) => `Mua ${money(p)}`,
    toAuction: "Đấu giá",
    forSale: "Đất trống",
    cantAfford: "Không đủ tiền: cầm cố hoặc cho đấu giá",
    auction: "Đấu giá",
    bidNow: (bid, name) => `Giá ${money(bid)} · ${name}`,
    noBids: "Chưa ai trả giá",
    passBid: "Bỏ",
    waitBid: (name) => `Chờ ${name} trả giá`,
    owe: (x, to) => `Bạn nợ ${to} ${money(x)}`,
    oweHint: "Bán nhà hoặc cầm cố cho đủ tiền",
    bankrupt: "Phá sản",
    confirmBankrupt: "Chạm lần nữa để phá sản",
    offerFrom: (name) => `${name} muốn giao dịch`,
    youGet: "Bạn nhận",
    youGive: "Bạn đưa",
    accept: "Đồng ý",
    reject: "Từ chối",
    waitAnswer: (name) => `Chờ ${name} trả lời`,
    nothing: "Không có gì",
    freeCard: "Thẻ ra tù",
    bank: "ngân hàng",
    at: (sq) => `Đang ở ${sq}`,
    cashNow: (x) => `Tiền mặt ${money(x)}`,
    deedsOf: (name) => `Tài sản của ${name}`,
    cards: (n) => `Thẻ ra tù × ${n}`,
    give: "Bạn đưa",
    get: "Bạn nhận",
    yourDeeds: "Tài sản",
    noDeeds: "Chưa có đất nào",
    addHouse: "+ Nhà",
    sellHouse: "− Nhà",
    mortgage: (v) => `Cầm +${money(v)}`,
    unmortgage: (v) => `Chuộc ${money(v)}`,
    mortgaged: "Đang cầm cố",
    housesLeft: (h, k) => `Ngân hàng còn ${h} nhà · ${k} khách sạn`,
    done: "Xong",
    tradeWith: "Giao dịch với",
    cash: "Tiền",
    send: "Gửi đề nghị",
    cancel: "Huỷ",
    offersLeft: (n) => `Còn ${n} lần đề nghị lượt này`,
    price: "Giá",
    rent: "Tiền thuê",
    rentSet: "Đủ bộ màu",
    withHouses: (n) => `${n} nhà`,
    hotel: "Khách sạn",
    houseCost: "Giá mỗi nhà",
    mortgageValue: "Cầm cố",
    owner: (name) => `Chủ: ${name}`,
    noOwner: "Chưa có chủ",
    transportRent: "Thuê theo số bến: 25K · 50K · 100K · 200K",
    utilityRent: "Thuê = xúc xắc × 4 (1 cái) hoặc × 10 (cả 2)",
    cardTitle: { chance: "Cơ hội", chest: "Khí vận" },
    ev: {
      turn: (a) => `Lượt của ${a}`,
      rent: (a, x, b) => `${a} trả ${money(x)} tiền thuê cho ${b}`,
      buy: (a, sq, x) => `${a} mua ${sq} giá ${money(x)}`,
      salary: (a, x) => `${a} qua Xuất phát +${money(x)}`,
      tax: (a, x) => `${a} nộp thuế ${money(x)}`,
      payBank: (a, x) => `${a} trả ngân hàng ${money(x)}`,
      payTo: (a, x, b) => `${a} trả ${b} ${money(x)}`,
      gain: (a, x) => `${a} nhận ${money(x)}`,
      jail: (a) => `${a} vào trại giam`,
      jailDoubles: (a) => `3 lần đôi liền: ${a} vào trại giam`,
      freePay: (a) => `${a} nộp phạt, ra tù`,
      freeCard: (a) => `${a} dùng thẻ, ra tù`,
      freeDoubles: (a) => `${a} đổ đôi, ra tù`,
      freeFine: (a) => `${a} hết 3 lượt: nộp phạt, ra tù`,
      stay: (a) => `${a} chưa ra được tù`,
      again: (a) => `Đôi! ${a} được đổ tiếp`,
      auction: (sq) => `Đấu giá ${sq}`,
      bid: (a, x) => `${a} trả ${money(x)}`,
      pass: (a) => `${a} bỏ`,
      won: (a, sq, x) => `${a} thắng đấu giá ${sq}: ${money(x)}`,
      unsold: (sq) => `Không ai mua ${sq}`,
      build: (a, sq) => `${a} xây nhà ở ${sq}`,
      hotel: (a, sq) => `${a} xây khách sạn ở ${sq}`,
      sell: (a, sq) => `${a} bán nhà ở ${sq}`,
      mortgage: (a, sq) => `${a} cầm cố ${sq}`,
      unmortgage: (a, sq) => `${a} chuộc ${sq}`,
      offer: (a, b) => `${a} đề nghị giao dịch với ${b}`,
      accepted: (b, a) => `${b} đồng ý giao dịch với ${a}`,
      rejected: (b) => `${b} từ chối giao dịch`,
      debt: (a, x) => `${a} thiếu ${money(x)}, phải xoay tiền`,
      bankrupt: (a) => `${a} phá sản!`,
      over: (a) => `${a} thắng!`,
    },
    youWin: "Bạn thắng!",
    winOf: (name) => `${name} thắng!`,
    byTime: "Hết giờ: ai giàu nhất thắng",
    byLast: "Trụ lại cuối cùng",
    place: (n) => `Hạng ${n}`,
    worth: (x) => `Tài sản ${money(x)}`,
    scoreLine: (n) => `${n} điểm`,
    again: "Ván mới",
    backToLobby: "Về phòng",
    watching: "Đang xem",
    away: "mất kết nối",
    detail: (level, worth) => cut(`Thắng máy ${STRINGS.vi.level[level]} · tài sản ${money(worth)}`, 40),
    onlineDetail: (place, n, worth) => cut(`Hạng ${place}/${n} · tài sản ${money(worth)}`, 40),
    summary: (level, wins) => `Thắng máy ${STRINGS.vi.level[level]} ${wins} lần`,
  },
  en: {
    title: "TYCOON",
    subtitle: "Buy land · build houses · collect rent",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    players: "Players",
    onPhone: "People on this phone",
    onPhoneHint: (h, b) => (b === 0 ? `${h} people pass the phone` : h === 1 ? `You and ${b} CPU` : `${h} people pass the phone · ${b} CPU`),
    computer: "Computer level",
    timeLimit: "Time limit",
    noLimit: "None",
    minutes: (n) => `${n} min`,
    start: "Start",
    resume: "Resume game",
    rules: "How to play",
    rulesLines: [
      "Roll two dice and go round the 40 squares. Passing Start pays 200K.",
      "Land on free land: buy it, or everyone bids for it at auction.",
      "Land on someone's land: pay rent. A full colour set doubles it.",
      "With a full set, build evenly: 4 houses, then a hotel. The bank has only 32 houses and 12 hotels.",
      "Bus station, rail, seaport, airport: rent by how many you own. Power and water: rent by the dice.",
      "Mortgage for half the price; buy back for 10% more. Houses sell for half.",
      "Doubles roll again; three doubles in a row is jail. Out of jail: pay 50K, use a card, or roll doubles (3 turns max).",
      "Trade land, cash and jail cards with other players.",
      "Can't pay even after selling everything? Bankrupt. Last player standing wins; if time runs out, the richest wins.",
    ],
    close: "Got it",
    you: "You",
    player: (n) => `Player ${n}`,
    bot: "CPU",
    turnOf: (name) => `${name}'s turn`,
    yourTurn: "Your turn",
    timeLeft: (m, s) => `${m}:${String(s).padStart(2, "0")}`,
    thinking: (name) => `${name} is thinking…`,
    passPhone: (name) => `Pass the phone to ${name}`,
    ready: "Ready",
    board: "Board",
    follow: "Follow",
    log: "Log",
    menu: "Menu",
    roll: "Roll dice",
    rollAgain: "Roll again",
    rollJail: "Roll for doubles",
    endTurn: "End turn",
    assets: "Assets",
    trade: "Trade",
    payJail: (f) => `Pay ${money(f)}`,
    useCard: "Use card",
    inJail: (t) => `In jail · try ${t + 1}/3`,
    buy: (p) => `Buy ${money(p)}`,
    toAuction: "Auction",
    forSale: "For sale",
    cantAfford: "Not enough cash: mortgage, or send it to auction",
    auction: "Auction",
    bidNow: (bid, name) => `${money(bid)} · ${name}`,
    noBids: "No bids yet",
    passBid: "Pass",
    waitBid: (name) => `Waiting for ${name} to bid`,
    owe: (x, to) => `You owe ${to} ${money(x)}`,
    oweHint: "Sell houses or mortgage to raise it",
    bankrupt: "Bankrupt",
    confirmBankrupt: "Tap again to go bankrupt",
    offerFrom: (name) => `${name} wants to trade`,
    youGet: "You get",
    youGive: "You give",
    accept: "Accept",
    reject: "Decline",
    waitAnswer: (name) => `Waiting for ${name}'s answer`,
    nothing: "Nothing",
    freeCard: "Jail card",
    bank: "the bank",
    at: (sq) => `On ${sq}`,
    cashNow: (x) => `Cash ${money(x)}`,
    deedsOf: (name) => `${name}'s assets`,
    cards: (n) => `Jail card × ${n}`,
    give: "You give",
    get: "You get",
    yourDeeds: "Assets",
    noDeeds: "No land yet",
    addHouse: "+ House",
    sellHouse: "− House",
    mortgage: (v) => `Mortgage +${money(v)}`,
    unmortgage: (v) => `Redeem ${money(v)}`,
    mortgaged: "Mortgaged",
    housesLeft: (h, k) => `Bank has ${h} houses · ${k} hotels`,
    done: "Done",
    tradeWith: "Trade with",
    cash: "Cash",
    send: "Send offer",
    cancel: "Cancel",
    offersLeft: (n) => `${n} offers left this turn`,
    price: "Price",
    rent: "Rent",
    rentSet: "Full set",
    withHouses: (n) => `${n} house${n > 1 ? "s" : ""}`,
    hotel: "Hotel",
    houseCost: "Each house",
    mortgageValue: "Mortgage",
    owner: (name) => `Owner: ${name}`,
    noOwner: "No owner",
    transportRent: "Rent by stations owned: 25K · 50K · 100K · 200K",
    utilityRent: "Rent = dice × 4 (one) or × 10 (both)",
    cardTitle: { chance: "Chance", chest: "Fortune" },
    ev: {
      turn: (a) => `${a}'s turn`,
      rent: (a, x, b) => `${a} pays ${b} ${money(x)} rent`,
      buy: (a, sq, x) => `${a} buys ${sq} for ${money(x)}`,
      salary: (a, x) => `${a} passes Start +${money(x)}`,
      tax: (a, x) => `${a} pays ${money(x)} tax`,
      payBank: (a, x) => `${a} pays the bank ${money(x)}`,
      payTo: (a, x, b) => `${a} pays ${b} ${money(x)}`,
      gain: (a, x) => `${a} collects ${money(x)}`,
      jail: (a) => `${a} goes to jail`,
      jailDoubles: (a) => `Three doubles: ${a} goes to jail`,
      freePay: (a) => `${a} pays the fine and walks out`,
      freeCard: (a) => `${a} uses a jail card`,
      freeDoubles: (a) => `${a} rolls doubles and walks out`,
      freeFine: (a) => `${a} served 3 turns: pays the fine`,
      stay: (a) => `${a} stays in jail`,
      again: (a) => `Doubles! ${a} rolls again`,
      auction: (sq) => `Auction: ${sq}`,
      bid: (a, x) => `${a} bids ${money(x)}`,
      pass: (a) => `${a} passes`,
      won: (a, sq, x) => `${a} wins ${sq} for ${money(x)}`,
      unsold: (sq) => `Nobody bought ${sq}`,
      build: (a, sq) => `${a} builds a house on ${sq}`,
      hotel: (a, sq) => `${a} builds a hotel on ${sq}`,
      sell: (a, sq) => `${a} sells a house on ${sq}`,
      mortgage: (a, sq) => `${a} mortgages ${sq}`,
      unmortgage: (a, sq) => `${a} redeems ${sq}`,
      offer: (a, b) => `${a} offers ${b} a trade`,
      accepted: (b, a) => `${b} accepts ${a}'s trade`,
      rejected: (b) => `${b} declines the trade`,
      debt: (a, x) => `${a} is ${money(x)} short and must raise cash`,
      bankrupt: (a) => `${a} goes bankrupt!`,
      over: (a) => `${a} wins!`,
    },
    youWin: "You win!",
    winOf: (name) => `${name} wins!`,
    byTime: "Time's up: the richest wins",
    byLast: "Last one standing",
    place: (n) => `${n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`} place`,
    worth: (x) => `Worth ${money(x)}`,
    scoreLine: (n) => `${n} pts`,
    again: "New game",
    backToLobby: "Back to room",
    watching: "Watching",
    away: "disconnected",
    detail: (level, worth) => cut(`Beat ${STRINGS.en.level[level]} CPU · worth ${money(worth)}`, 40),
    onlineDetail: (place, n, worth) => cut(`Place ${place}/${n} · worth ${money(worth)}`, 40),
    summary: (level, wins) => `Beat ${STRINGS.en.level[level]} CPU ${wins}×`,
  },
};
