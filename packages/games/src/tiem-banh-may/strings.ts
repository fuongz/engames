import type { Localized } from "@web-games/core/i18n";
import type { MixMode, PipeMode, StoveMode, WaitMode, Weather } from "./config";
import type { Grade, Note } from "./logic";

type Unit = "g" | "ml" | "egg" | "cup";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Names of cakes, ingredients
// and customers live with their catalogs in config.ts.

export interface Strings {
  num: (n: number) => string;
  coins: (n: number) => string;
  day: (n: number) => string;
  weekdays: string[];
  weather: Record<Weather, string>;
  beforeBed: (minutes: number) => string;
  lateNight: (minutes: number) => string;
  beforeOpen: (minutes: number) => string;
  bedtimeTitle: string;
  bedtimeAsk: string;
  sleep: string;
  stayUp: string;
  mustSleep: string;
  slept: (minutes: number) => string;
  tired: string;
  napLabel: string;
  coffeeLabel: string;
  noCoffee: string;
  hintTired: string;
  leave: string;
  openNow: string;
  ovenBusy: string;
  ready: (cake: string) => string;
  minutesLeft: (m: number) => string;
  openAt: string;
  ovenWarn: string;
  autoOpened: string;
  startWait: string;
  minutes: (n: number) => string;
  loading: string;
  needSignIn: string;
  loadFailed: string;
  retry: string;
  saveFailed: string;
  conflict: string;
  reload: string;

  forecast: (day: number) => string;
  crowd: (n: number) => string;
  trend: (cake: string) => string;
  vipRumour: string;
  preorder: (who: string, qty: number, cake: string, time: string) => string;
  noPreorder: string;
  market: string;
  book: string;
  bake: string;
  open: string;
  hintMarket: string;
  hintBake: string;
  hintOpen: string;
  hintTimeUp: string;
  display: (n: number, cap: number) => string;
  emptyDisplay: string;

  pack: (amount: number, unit: Unit) => string;
  amount: (amount: number, unit: Unit, spoon: boolean) => string;
  inPantry: (q: string) => string;
  fresh: (days: number) => string;
  checkout: (minutes: number) => string;
  total: string;
  noCoins: string;
  noTime: string;

  recipesTab: string;
  upgradesTab: string;
  owned: string;
  mastery: (n: number, of: number) => string;
  mastered: string;
  yieldLine: (n: number, price: number) => string;
  makes: (n: number) => string;
  timeLine: (m: number) => string;
  upgradeInfo: Record<"mixer" | "oven2" | "display" | "fridge", string>;
  close: string;
  bought: string;

  make: string;
  makeFast: string;
  missing: (ing: string) => string;
  displayFull: string;
  needTime: string;

  stepAdd: (amount: string, ing: string) => string;
  stepMix: Record<MixMode, string>;
  turns: (n: number) => string;
  stepStove: Record<StoveMode, string>;
  stepWait: (mode: WaitMode, m: number) => string;
  stepOven: (t: number, m: number) => string;
  stepPipe: Record<PipeMode, string>;
  pickIng: string;
  holdPour: string;
  tapAdd: (unit: string) => string;
  spoonUnit: string;
  eggUnit: string;
  added: string;
  spin: string;
  done: string;
  useMixer: string;
  stoveHint: string;
  offHeat: string;
  heatOn: string;
  ovenSet: string;
  ovenIn: string;
  ovenOut: string;
  pipeHint: string;
  waiting: string;
  next: string;
  grade: Record<Grade, string>;
  note: (key: Note, ing?: string) => string;
  fail: Record<"burnt" | "raw" | "flat", string>;
  ruined: string;
  baked: (n: number, cake: string) => string;
  store: string;
  bin: string;

  opening: string;
  discount: string;
  discountOn: string;
  closeEarly: string;
  give: string;
  soldOut: string;
  vipWants: string;
  preorderTag: string;
  totalPaid: (total: number, paid: number) => string;
  counted: (n: number) => string;
  giveChange: string;
  recount: string;
  exactPaid: string;
  pickBox: string;
  pieces: (n: number) => string;
  box: (n: number) => string;
  boxSmall: string;
  thanks: string;
  tip: (n: number) => string;
  shortChange: string;
  overChange: (n: number) => string;
  walked: string;
  queueFull: string;
  vipHappy: string;
  vipSad: string;
  notOrdered: string;
  preorderMissing: string;
  closed: string;

  reportTitle: (day: number) => string;
  revenue: string;
  tips: string;
  boxes: string;
  ingredients: string;
  wasted: (n: number) => string;
  spoiled: string;
  profit: string;
  loss: string;
  overGiven: (n: number) => string;
  served: (n: number) => string;
  walkedOff: (n: number) => string;
  soldOutLine: string;
  rep: (a: number, b: number) => string;
  vipReport: Record<"happy" | "sad" | "missed", string>;
  preorderReport: (done: number, missed: number) => string;
  bailout: (n: number) => string;
  nextDay: string;

  /** Card summary and leaderboard detail. */
  summary: (day: number, coins: number) => string;
  detail: (day: number) => string;
  // Save slots and settings
  slotsTitle: string;
  slotName: (n: number) => string;
  slotEmpty: string;
  slotNew: string;
  slotInfo: (day: number, coins: number) => string;
  slotRep: (rep: number) => string;
  settings: string;
  sound: string;
  music: string;
  on: string;
  off: string;
  switchShop: string;
  restart: string;
  restartAsk: (n: number) => string;
  restartSure: string;
  restartYes: string;
  goOn: string;
  cancel: string;
  restarted: string;
  pauseTitle: string;
  aisles: Record<"dry" | "cold" | "flavour" | "special" | "records", string>;
  basket: (n: number) => string;
  basketTitle: string;
  basketEmpty: string;
  basketHint: string;
  keepShopping: string;
  clearBasket: string;
  inStock: (q: string) => string;
  packOf: (q: string) => string;
  displayTitle: string;
  stat: Record<"rep" | "energy" | "mood", { title: string; body: string }>;
  gotIt: string;
  ingredientsTitle: string;
  trayLabel: string;
  musicBox: {
    title: string;
    playing: string;
    off: string;
    buyMore: string;
    owned: string;
    bought: string;
    buyAsk: string;
    buy: string;
  };
  tour: {
    welcome: string;
    start: string;
    skip: string;
    /** After skipping the tour: where to find it again. */
    skipped: string;
    next: string;
    market: string;
    shopping: string;
    pay: string;
    bake: string;
    pickCookie: string;
    kitchen: string;
    display: string;
    bed: string;
    open: string;
    selling: string;
    done: string;
    thanks: string;
    replay: string;
  };
  trayHint: string;
  tile: Record<
    | "revenue"
    | "tips"
    | "boxes"
    | "ingredients"
    | "rep"
    | "served"
    | "walked"
    | "wasted"
    | "spoiled",
    string
  >;
  fact: {
    time: (m: number) => string;
    pieces: (n: number) => string;
    price: (p: number) => string;
    batch: (p: number) => string;
    mastery: string;
  };
  stepTag: {
    mix: Record<MixMode, string>;
    stove: Record<StoveMode, string>;
    wait: Record<WaitMode, string>;
    oven: string;
    pipe: Record<PipeMode, string>;
  };
  stepsTitle: string;
  learned: string;
  tapContinue: string;
  displayKeep: string;
  displaySpaces: (n: number, cap: number) => string;
  pausedNote: string;
}

const viNum = (n: number) => Math.round(n).toLocaleString("vi-VN");
const enNum = (n: number) => Math.round(n).toLocaleString("en-US");

const hm = (m: number, h: string) => {
  const hours = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  return hours
    ? `${hours}${h}${mins ? String(mins).padStart(2, "0") : ""}`
    : `${mins}'`;
};

export const STRINGS: Localized<Strings> = {
  vi: {
    num: viNum,
    coins: (n) => `${viNum(n)} xu`,
    day: (n) => `Ngày ${n}`,
    weekdays: [
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
      "Chủ Nhật",
    ],
    weather: { sunny: "Nắng đẹp", cloudy: "Nhiều mây", rainy: "Mưa" },
    beforeBed: (m) => `Còn ${hm(m, "h")} tới giờ ngủ`,
    lateNight: (m) => `Thức khuya, còn ${hm(m, "h")} tới 1:00`,
    beforeOpen: (m) => `Còn ${hm(m, "h")} tới giờ mở cửa`,
    bedtimeTitle: "22:00 rồi!",
    bedtimeAsk:
      "Đi ngủ để mai đủ sức, hay thức khuya làm thêm? Ngủ ít thì sáng mai mệt và kém vui.",
    sleep: "Đi ngủ",
    stayUp: "Thức khuya",
    mustSleep: "1:00 rồi, phải đi ngủ thôi!",
    slept: (m) => `Chào buổi sáng! Ngủ được ${hm(m, "h")}`,
    tired: "Mệt quá, nghỉ chút đã",
    napLabel: "Chợp mắt",
    coffeeLabel: "Cà phê",
    noCoffee: "Hết cà phê, mua ở siêu thị nhé",
    leave: "Ra ngoài",
    openNow: "Tới giờ mở cửa rồi!",
    ovenBusy: "Lò đang bận",
    ready: (cake) => `${cake} xong rồi!`,
    minutesLeft: (m) => `Còn ${Math.ceil(m)} phút`,
    openAt: "Mở lúc 9:00",
    ovenWarn: "Lò vẫn còn bánh, ngủ bây giờ là cháy đấy!",
    autoOpened: "9:30 rồi, tiệm tự mở cửa",
    startWait: "Bắt đầu",
    hintTired: "Hết sức rồi. Chợp mắt, uống cà phê hoặc đi ngủ nhé.",
    minutes: (n) => `${n} phút`,
    loading: "Đang mở cửa tiệm...",
    needSignIn: "Đăng nhập để vào tiệm bánh của bạn",
    loadFailed: "Không tải được tiệm bánh. Kiểm tra mạng rồi thử lại nhé.",
    retry: "Thử lại",
    saveFailed: "Chưa lưu được, đang thử lại...",
    conflict: "Tiệm vừa được mở ở thiết bị khác.",
    reload: "Tải lại",

    forecast: (d) => `Dự báo ngày ${d}`,
    crowd: (n) =>
      `${n < 16 ? "Vắng khách" : n < 26 ? "Khách vừa" : "Đông khách"}, khoảng ${n} khách`,
    trend: (cake) => `Đang chuộng: ${cake}`,
    vipRumour: "Nghe đồn nhà phê bình ẩm thực sẽ ghé!",
    preorder: (who, qty, cake, time) =>
      `${who} đặt ${qty} ${cake}, lấy lúc ${time}`,
    noPreorder: "Chưa có đơn đặt trước",
    market: "Siêu thị",
    book: "Sổ công thức",
    bake: "Làm bánh",
    open: "Mở cửa",
    hintMarket: "Kho trống trơn. Đi siêu thị mua nguyên liệu trước nhé!",
    hintBake: "Có nguyên liệu rồi, vào bếp làm bánh thôi!",
    hintOpen: "Bánh đã lên kệ. Mở cửa khi bạn sẵn sàng!",
    hintTimeUp: "Hết giờ làm việc rồi. Đến giờ mở cửa!",
    display: (n, cap) => `Tủ kính ${n}/${cap}`,
    emptyDisplay: "Tủ kính còn trống",

    pack: (a, u) =>
      u === "egg"
        ? `${a} quả`
        : u === "cup"
          ? `${a} ly`
          : a >= 1000
            ? `${a / 1000} ${u === "g" ? "kg" : "lít"}`
            : `${a} ${u}`,
    amount: (a, u, spoon) =>
      u === "egg" || u === "cup"
        ? `${a} ${u === "egg" ? "quả" : "ly"}`
        : spoon
          ? `${a / 5} thìa`
          : `${a} ${u}`,
    inPantry: (q) => `Kho: ${q}`,
    fresh: (d) => `${d} ngày`,
    checkout: (m) => `Thanh toán (${m} phút)`,
    total: "Tổng",
    noCoins: "Không đủ xu",
    noTime: "Không đủ giờ làm việc",

    recipesTab: "Công thức",
    upgradesTab: "Nâng cấp",
    owned: "Đã có",
    mastery: (n, of) => `Đã làm ${n}/${of} mẻ`,
    mastered: "Thuần thục",
    yieldLine: (n, p) => `Ra ${n} cái, ${p} xu mỗi cái`,
    makes: (n) => `Ra ${n} cái`,
    timeLine: (m) => `${m} phút một mẻ`,
    upgradeInfo: {
      mixer: "Đánh bông tự động, bớt 10 phút",
      fridge: "Đồ tươi để được 5 ngày",
      display: "Tủ kính chứa 90 cái",
      oven2: "Nướng 2 mẻ cùng lúc",
    },
    close: "Đóng",
    bought: "Đã mua!",

    make: "Làm",
    makeFast: "Làm nhanh 2★",
    missing: (ing) => `Thiếu ${ing.toLowerCase()}`,
    displayFull: "Tủ kính đầy",
    needTime: "Không đủ giờ",

    stepAdd: (amount, ing) => `${amount} ${ing.toLowerCase()}`,
    stepMix: {
      cream: "Đánh bông bơ đường",
      whisk: "Đánh bông",
      fold: "Trộn nhẹ tay",
      knead: "Nhồi bột",
      stir: "Khuấy đều",
    },
    turns: (n) => `${n} vòng`,
    stepStove: {
      caramel: "Thắng caramel",
      fry: "Chiên vàng",
      cook: "Nấu bột",
      steam: "Hấp bánh",
    },
    stepWait: (mode, m) =>
      mode === "proof" ? `Ủ bột ${m} phút` : `Để nguội ${m} phút`,
    stepOven: (t, m) => `Nướng ${t}°C trong ${m} phút`,
    stepPipe: {
      frost: "Bắt kem",
      glaze: "Phủ sốt dâu",
      fill: "Bơm kem",
      cream: "Phủ kem, xếp dâu",
      topping: "Phết sốt, rắc chà bông",
      dust: "Rắc bột ca cao",
    },
    pickIng: "Chọn đúng nguyên liệu trên kệ",
    holdPour: "Giữ để đổ, thả tay để dừng",
    tapAdd: (u) => `Chạm để thêm 1 ${u}`,
    spoonUnit: "thìa",
    eggUnit: "quả",
    added: "Cho vào tô",
    spin: "Xoay vòng quanh tô",
    done: "Xong",
    useMixer: "Dùng máy",
    stoveHint: "Bật lửa, nhấc ra khi vừa màu",
    offHeat: "Nhấc ra",
    heatOn: "Bật lửa",
    ovenSet: "Chỉnh nhiệt rồi cho vào lò",
    ovenIn: "Cho vào lò",
    ovenOut: "Lấy ra",
    pipeHint: "Giữ để bóp, thả tay khi vừa",
    waiting: "Đang chờ...",
    next: "Tiếp",
    grade: {
      perfect: "Hoàn hảo!",
      good: "Tốt",
      minor: "Hơi lệch",
      major: "Hỏng rồi!",
    },
    note: (key, ing = "") =>
      ({
        exact: "Chuẩn!",
        tooMuch: `Thừa ${ing.toLowerCase()}`,
        tooLittle: `Thiếu ${ing.toLowerCase()}`,
        wrongIngredient: `Công thức không có ${ing.toLowerCase()}!`,
        outOfOrder: `Chưa tới lượt ${ing.toLowerCase()}`,
        undermixed: "Trộn chưa đủ",
        overmixed: "Trộn quá tay",
        underdone: "Chưa tới",
        overdone: "Quá lửa",
        tooHot: "Lò nóng quá",
        tooCold: "Lò nguội quá",
        sloppy: "Chưa khéo tay",
      })[key],
    fail: {
      burnt: "Bánh cháy đen!",
      raw: "Bánh còn sống!",
      flat: "Bánh xẹp lép!",
    },
    ruined: "Mẻ này hỏng rồi...",
    baked: (n, cake) => `Ra lò ${n} ${cake.toLowerCase()}`,
    store: "Cất vào tủ kính",
    bin: "Bỏ đi",

    opening: "Đang mở cửa",
    discount: "Giảm 30%",
    discountOn: "Đang giảm giá",
    closeEarly: "Đóng cửa sớm",
    give: "Giao bánh",
    soldOut: "Hết mất rồi...",
    vipWants: "Chỉ nhận bánh 3★",
    preorderTag: "Đơn đặt trước",
    totalPaid: (t, p) => `Tổng ${viNum(t)}, khách đưa ${viNum(p)}`,
    counted: (n) => `Tiền thối: ${viNum(n)}`,
    giveChange: "Đưa tiền thối",
    recount: "Đếm lại",
    exactPaid: "Khách trả đủ tiền",
    pickBox: "Chọn hộp vừa khít",
    pieces: (n) => `${n} cái`,
    box: (n) => `Hộp ${n}`,
    boxSmall: "Không vừa!",
    thanks: "Cảm ơn!",
    tip: (n) => `+${n} tip`,
    shortChange: "Thối thiếu rồi!",
    overChange: (n) => `Thối dư ${n} xu`,
    walked: "Đợi lâu quá, đi thôi...",
    queueFull: "Đông quá, khách bỏ đi",
    vipHappy: "Tuyệt hảo! Nhà phê bình hài lòng",
    vipSad: "Nhà phê bình thất vọng...",
    notOrdered: "Khách không gọi món này",
    preorderMissing: "Không có bánh cho đơn đặt!",
    closed: "Đóng cửa!",

    reportTitle: (d) => `Tổng kết ngày ${d}`,
    revenue: "Tiền bán bánh",
    tips: "Tiền tip",
    boxes: "Tiền hộp",
    ingredients: "Nguyên liệu đã dùng",
    wasted: (n) => `Bánh bỏ đi (${n} cái)`,
    spoiled: "Nguyên liệu hỏng",
    profit: "Lãi",
    loss: "Lỗ",
    overGiven: (n) => `Thối dư ${viNum(n)} xu`,
    served: (n) => `Phục vụ ${n} khách`,
    walkedOff: (n) => `${n} khách bỏ về`,
    soldOutLine: "Khách muốn mà hết",
    rep: (a, b) => `Danh tiếng ${a} → ${b}`,
    vipReport: {
      happy: "Nhà phê bình khen nức nở!",
      sad: "Nhà phê bình chê bánh...",
      missed: "Nhà phê bình về tay không",
    },
    preorderReport: (d, m) =>
      `Đơn đặt trước: ${d} xong${m ? `, ${m} lỡ hẹn` : ""}`,
    bailout: (n) => `Bác hàng xóm cho mượn ${n} xu. Cố lên!`,
    nextDay: "Sang ngày mới",

    summary: (d, c) => `Ngày ${d}, ${viNum(c)} xu`,
    detail: (d) => `Ngày ${d}`,
    slotsTitle: "Chọn tiệm",
    slotName: (n) => `Tiệm ${n}`,
    slotEmpty: "Tiệm trống",
    slotNew: "Bấm để mở tiệm mới",
    slotInfo: (day, coins) => `Ngày ${day}, ${viNum(coins)} xu`,
    slotRep: (rep) => `Uy tín ${Math.round(rep)}`,
    settings: "Cài đặt",
    sound: "Âm thanh",
    music: "Nhạc nền",
    on: "Bật",
    off: "Tắt",
    switchShop: "Đổi tiệm",
    restart: "Chơi lại từ đầu",
    restartAsk: (n) =>
      `Chơi lại Tiệm ${n} từ đầu? Tiền, công thức, nâng cấp và bánh của tiệm này sẽ mất. Bảng xếp hạng vẫn giữ thành tích tốt nhất của bạn.`,
    restartSure: "Chắc chắn chưa? Không thể hoàn tác đâu nhé.",
    restartYes: "Xoá và chơi lại",
    goOn: "Tiếp tục",
    cancel: "Huỷ",
    restarted: "Tiệm mới đã sẵn sàng!",
    pauseTitle: "Tạm dừng",
    aisles: {
      dry: "Đồ khô",
      cold: "Tủ mát",
      flavour: "Hương liệu",
      special: "Đặc sản",
      records: "Đĩa nhạc",
    },
    basket: (n) => (n ? `Giỏ: ${n} món` : "Giỏ trống"),
    basketTitle: "Giỏ hàng",
    basketEmpty: "Giỏ đang trống",
    basketHint: "Chạm vào món trên kệ để bỏ vào giỏ.",
    keepShopping: "Chọn tiếp",
    clearBasket: "Bỏ hết",
    inStock: (q) => `Trong kho: ${q}`,
    packOf: (q) => `Gói ${q}`,
    displayTitle: "Tủ kính",
    stat: {
      rep: {
        title: "Uy tín",
        body: "Uy tín càng cao, càng nhiều khách ghé tiệm mỗi ngày. Uy tín tăng khi khách nhận đúng bánh, đơn đặt trước giao đủ và khách VIP vui. Uy tín giảm khi thối tiền thiếu hay khách VIP không vừa ý. Tâm trạng tốt cũng cộng thêm một chút mỗi ngày.",
      },
      energy: {
        title: "Thể lực",
        body: "Mỗi phút thức đều tốn sức, một ngày đứng quầy còn tốn hơn. Ngủ đủ giấc sẽ hồi lại. Dưới 50 tay bắt đầu run: rót dễ lố, bấm bếp và lò hay trễ. Về 0 thì phải nghỉ mới làm tiếp được. Cà phê cho thêm sức ngay nhưng làm ngủ kém, chợp mắt 30 phút hồi được một ít.",
      },
      mood: {
        title: "Tâm trạng",
        body: "Tâm trạng tăng khi ngủ đủ, ra mẻ bánh 3 sao và ngày bán có lời. Tâm trạng giảm khi thức khuya, bánh hỏng, bán lỗ hay khách bỏ về. Vui vẻ thì khách kiên nhẫn hơn, tip nhiều hơn, ngủ hồi sức tốt hơn và uy tín tăng thêm mỗi ngày.",
      },
    },
    gotIt: "Đã hiểu",
    ingredientsTitle: "Nguyên liệu",
    trayLabel: "Khay",
    musicBox: {
      title: "Hộp nhạc",
      playing: "Đang phát",
      off: "Tắt nhạc",
      buyMore: "Mua thêm đĩa ở siêu thị",
      owned: "Đã có",
      bought: "Đĩa mới đã lên hộp nhạc!",
      buyAsk: "Mua đĩa này?",
      buy: "Mua",
    },
    tour: {
      welcome:
        "Chào mừng đến Tiệm Bánh Mây! Mình là Mây. Đêm nay mình cùng làm mẻ bánh đầu tiên nhé.",
      start: "Bắt đầu",
      skip: "Bỏ qua",
      skipped: "Xem lại hướng dẫn trong Cài đặt nhé!",
      next: "Tiếp",
      market: "Kho đang trống. Đi siêu thị mua nguyên liệu trước nhé!",
      shopping:
        "Chạm món để bỏ vào giỏ, mua xong thì ra quầy tính tiền. Bánh quy cần bột mì, đường, bơ và trứng.",
      pay: "Đủ rồi! Bấm thanh toán nhé.",
      bake: "Có nguyên liệu rồi. Vào bếp làm bánh thôi!",
      pickCookie: "Làm Bánh quy bơ, món dễ nhất.",
      kitchen:
        "Làm theo thẻ công thức ở trên: chọn đúng nguyên liệu, đong vừa đủ, trộn đủ vòng, nướng đúng nhiệt.",
      display: "Bánh đã vào tủ kính. Sáng mai bán cho khách nhé.",
      bed: "Khuya rồi, đi ngủ cho có sức bán hàng.",
      open: "Trời sáng rồi! Mở cửa đón khách nào.",
      selling:
        "Khách gọi món trong bong bóng. Chạm bánh trong tủ để đặt lên khay, rồi bấm Giao bánh.",
      done: "Bạn làm tốt lắm! Từ giờ tiệm là của bạn. Chúc buôn may bán đắt!",
      thanks: "Cảm ơn Mây!",
      replay: "Xem lại hướng dẫn",
    },
    trayHint: "Chạm bánh trong tủ để đặt lên khay",
    tile: {
      revenue: "Bán bánh",
      tips: "Tiền tip",
      boxes: "Hộp",
      ingredients: "Nguyên liệu",
      rep: "Uy tín",
      served: "Phục vụ",
      walked: "Bỏ về",
      wasted: "Bánh bỏ",
      spoiled: "Đồ hỏng",
    },
    fact: {
      time: (m) => `${m} phút`,
      pieces: (n) => `${n} cái/mẻ`,
      price: (p) => `${p} xu/cái`,
      batch: (p) => `${p} xu/mẻ`,
      mastery: "Thành thạo",
    },
    stepTag: {
      mix: {
        cream: "Đánh bông",
        whisk: "Đánh bông",
        fold: "Trộn nhẹ",
        knead: "Nhồi bột",
        stir: "Khuấy",
      },
      stove: {
        caramel: "Thắng đường",
        fry: "Chiên",
        cook: "Nấu bột",
        steam: "Hấp",
      },
      wait: { proof: "Ủ bột", cool: "Để nguội" },
      oven: "Nướng",
      pipe: {
        frost: "Bắt kem",
        glaze: "Phủ sốt",
        fill: "Bơm kem",
        cream: "Phủ kem",
        topping: "Phủ topping",
        dust: "Rắc ca cao",
      },
    },
    stepsTitle: "Các bước",
    learned: "Học được công thức mới!",
    tapContinue: "Chạm để tiếp tục",
    displayKeep: "Bánh chỉ tươi trong một ngày, nhớ bán hết khi mở cửa nhé!",
    displaySpaces: (n, cap) => `${n}/${cap} chỗ`,
    pausedNote:
      "Tiệm đang nghỉ một chút. Đồng hồ, lò nướng và khách đều đứng yên.",
  },
  en: {
    num: enNum,
    coins: (n) => `${enNum(n)} coins`,
    day: (n) => `Day ${n}`,
    weekdays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    weather: { sunny: "Sunny", cloudy: "Cloudy", rainy: "Rainy" },
    beforeBed: (m) => `${hm(m, "h")} until bedtime`,
    lateNight: (m) => `Up late: ${hm(m, "h")} until 1:00`,
    beforeOpen: (m) => `${hm(m, "h")} until opening`,
    bedtimeTitle: "It's 22:00!",
    bedtimeAsk:
      "Go to bed and be fresh tomorrow, or stay up and work? Less sleep means a tired, gloomier morning.",
    sleep: "Go to bed",
    stayUp: "Stay up",
    mustSleep: "It's 1:00, time for bed!",
    slept: (m) => `Good morning! Slept ${hm(m, "h")}`,
    tired: "Too tired, rest first",
    napLabel: "Nap",
    coffeeLabel: "Coffee",
    noCoffee: "No coffee left, buy some at the supermarket",
    leave: "Step out",
    openNow: "Time to open the shop!",
    ovenBusy: "The oven is busy",
    ready: (cake) => `${cake} is ready!`,
    minutesLeft: (m) => `${Math.ceil(m)} min left`,
    openAt: "Opens at 9:00",
    ovenWarn: "There is still something in the oven: it will burn overnight!",
    autoOpened: "It's 9:30, the shop opens by itself",
    startWait: "Start",
    hintTired: "You're worn out. Take a nap, have a coffee or go to bed.",
    minutes: (n) => `${n} min`,
    loading: "Opening the bakery...",
    needSignIn: "Sign in to open your bakery",
    loadFailed:
      "Couldn't load your bakery. Check your connection and try again.",
    retry: "Try again",
    saveFailed: "Not saved yet, retrying...",
    conflict: "Your bakery was just opened on another device.",
    reload: "Reload",

    forecast: (d) => `Forecast for day ${d}`,
    crowd: (n) =>
      `${n < 16 ? "Quiet" : n < 26 ? "Steady" : "Busy"}, about ${n} customers`,
    trend: (cake) => `In demand: ${cake}`,
    vipRumour: "Word is a food critic is coming!",
    preorder: (who, qty, cake, time) =>
      `${who} ordered ${qty} ${cake}, pickup ${time}`,
    noPreorder: "No pre-orders yet",
    market: "Supermarket",
    book: "Recipe book",
    bake: "Bake",
    open: "Open shop",
    hintMarket: "The pantry is empty. Go to the supermarket first!",
    hintBake: "Ingredients are in. Time to bake!",
    hintOpen: "Cakes are on display. Open when you're ready!",
    hintTimeUp: "Out of working hours. Time to open!",
    display: (n, cap) => `Display ${n}/${cap}`,
    emptyDisplay: "The display is empty",

    pack: (a, u) =>
      u === "egg"
        ? `${a} eggs`
        : u === "cup"
          ? `${a} ${a === 1 ? "cup" : "cups"}`
          : a >= 1000
            ? `${a / 1000} ${u === "g" ? "kg" : "L"}`
            : `${a} ${u}`,
    amount: (a, u, spoon) =>
      u === "egg"
        ? `${a} ${a === 1 ? "egg" : "eggs"}`
        : u === "cup"
          ? `${a} ${a === 1 ? "cup" : "cups"}`
          : spoon
            ? `${a / 5} tsp`
            : `${a} ${u}`,
    inPantry: (q) => `Pantry: ${q}`,
    fresh: (d) => `${d} days`,
    checkout: (m) => `Pay (${m} min)`,
    total: "Total",
    noCoins: "Not enough coins",
    noTime: "Not enough working time",

    recipesTab: "Recipes",
    upgradesTab: "Upgrades",
    owned: "Owned",
    mastery: (n, of) => `Baked ${n}/${of} batches`,
    mastered: "Mastered",
    yieldLine: (n, p) => `Makes ${n}, ${p} coins each`,
    makes: (n) => `Makes ${n}`,
    timeLine: (m) => `${m} min a batch`,
    upgradeInfo: {
      mixer: "Whisks for you, 10 min faster",
      fridge: "Fresh goods last 5 days",
      display: "Display holds 90",
      oven2: "Bake two batches at once",
    },
    close: "Close",
    bought: "Bought!",

    make: "Bake",
    makeFast: "Quick bake 2★",
    missing: (ing) => `Need ${ing.toLowerCase()}`,
    displayFull: "Display full",
    needTime: "Not enough time",

    stepAdd: (amount, ing) => `${amount} ${ing.toLowerCase()}`,
    stepMix: {
      cream: "Cream butter & sugar",
      whisk: "Whisk",
      fold: "Fold gently",
      knead: "Knead",
      stir: "Stir",
    },
    turns: (n) => `${n} turns`,
    stepStove: {
      caramel: "Make caramel",
      fry: "Fry golden",
      cook: "Cook the paste",
      steam: "Steam the cakes",
    },
    stepWait: (mode, m) =>
      mode === "proof" ? `Proof ${m} min` : `Cool ${m} min`,
    stepOven: (t, m) => `Bake at ${t}°C for ${m} min`,
    stepPipe: {
      frost: "Pipe the frosting",
      glaze: "Dip in glaze",
      fill: "Fill with cream",
      cream: "Cream & strawberries",
      topping: "Spread, add floss & egg",
      dust: "Dust with cocoa",
    },
    pickIng: "Pick the right ingredient",
    holdPour: "Hold to pour, let go to stop",
    tapAdd: (u) => `Tap to add 1 ${u}`,
    spoonUnit: "tsp",
    eggUnit: "egg",
    added: "Into the bowl",
    spin: "Circle round the bowl",
    done: "Done",
    useMixer: "Use mixer",
    stoveHint: "Turn on the heat, take it off at the right colour",
    offHeat: "Off the heat",
    heatOn: "Heat on",
    ovenSet: "Set the temperature, then bake",
    ovenIn: "Into the oven",
    ovenOut: "Take it out",
    pipeHint: "Hold to squeeze, let go when it's right",
    waiting: "Waiting...",
    next: "Next",
    grade: {
      perfect: "Perfect!",
      good: "Good",
      minor: "A bit off",
      major: "Ruined!",
    },
    note: (key, ing = "") =>
      ({
        exact: "Spot on!",
        tooMuch: `Too much ${ing.toLowerCase()}`,
        tooLittle: `Not enough ${ing.toLowerCase()}`,
        wrongIngredient: `No ${ing.toLowerCase()} in this recipe!`,
        outOfOrder: `Not ${ing.toLowerCase()} yet`,
        undermixed: "Undermixed",
        overmixed: "Overmixed",
        underdone: "Not done yet",
        overdone: "Overdone",
        tooHot: "Oven too hot",
        tooCold: "Oven too cold",
        sloppy: "A bit messy",
      })[key],
    fail: {
      burnt: "Burnt to a crisp!",
      raw: "Still raw inside!",
      flat: "Flat as a pancake!",
    },
    ruined: "This batch is ruined...",
    baked: (n, cake) => `${n} ${cake.toLowerCase()} out of the oven`,
    store: "Put on display",
    bin: "Bin it",

    opening: "Open",
    discount: "30% off",
    discountOn: "On sale",
    closeEarly: "Close early",
    give: "Hand over",
    soldOut: "All gone...",
    vipWants: "3★ cakes only",
    preorderTag: "Pre-order",
    totalPaid: (t, p) => `Total ${enNum(t)}, paid ${enNum(p)}`,
    counted: (n) => `Change: ${enNum(n)}`,
    giveChange: "Give change",
    recount: "Recount",
    exactPaid: "Paid the exact amount",
    pickBox: "Pick the snuggest box",
    pieces: (n) => `${n} ${n === 1 ? "piece" : "pieces"}`,
    box: (n) => `Box of ${n}`,
    boxSmall: "Won't fit!",
    thanks: "Thank you!",
    tip: (n) => `+${n} tip`,
    shortChange: "You short-changed me!",
    overChange: (n) => `${n} coins too much change`,
    walked: "Too slow, I'm off...",
    queueFull: "Too crowded, they left",
    vipHappy: "Superb! The critic is delighted",
    vipSad: "The critic is disappointed...",
    notOrdered: "Not what they ordered",
    preorderMissing: "No cakes for the pre-order!",
    closed: "Closed!",

    reportTitle: (d) => `Day ${d} summary`,
    revenue: "Sales",
    tips: "Tips",
    boxes: "Boxes",
    ingredients: "Ingredients used",
    wasted: (n) => `Binned cakes (${n})`,
    spoiled: "Spoiled ingredients",
    profit: "Profit",
    loss: "Loss",
    overGiven: (n) => `${enNum(n)} coins too much change`,
    served: (n) => `Served ${n} customers`,
    walkedOff: (n) => `${n} walked off`,
    soldOutLine: "Wanted but sold out",
    rep: (a, b) => `Reputation ${a} → ${b}`,
    vipReport: {
      happy: "The critic raved about you!",
      sad: "The critic panned your cakes...",
      missed: "The critic left empty-handed",
    },
    preorderReport: (d, m) =>
      `Pre-orders: ${d} done${m ? `, ${m} missed` : ""}`,
    bailout: (n) => `Your neighbour lent you ${n} coins. Hang in there!`,
    nextDay: "Next day",

    summary: (d, c) => `Day ${d}, ${enNum(c)} coins`,
    detail: (d) => `Day ${d}`,
    slotsTitle: "Choose a bakery",
    slotName: (n) => `Bakery ${n}`,
    slotEmpty: "Empty",
    slotNew: "Tap to open a new bakery",
    slotInfo: (day, coins) => `Day ${day}, ${enNum(coins)} coins`,
    slotRep: (rep) => `Reputation ${Math.round(rep)}`,
    settings: "Settings",
    sound: "Sound",
    music: "Music",
    on: "On",
    off: "Off",
    switchShop: "Switch bakery",
    restart: "Start over",
    restartAsk: (n) =>
      `Start Bakery ${n} over? Its coins, recipes, upgrades and cakes will be gone. The leaderboard keeps your best result.`,
    restartSure: "Are you sure? This cannot be undone.",
    restartYes: "Delete and restart",
    goOn: "Continue",
    cancel: "Cancel",
    restarted: "Your new bakery is ready!",
    pauseTitle: "Paused",
    aisles: {
      dry: "Dry goods",
      cold: "Chilled",
      flavour: "Flavours",
      special: "Specials",
      records: "Records",
    },
    basket: (n) =>
      n ? `Basket: ${n} item${n > 1 ? "s" : ""}` : "Basket empty",
    basketTitle: "Basket",
    basketEmpty: "The basket is empty",
    basketHint: "Tap things on the shelves to put them in.",
    keepShopping: "Keep shopping",
    clearBasket: "Empty it",
    inStock: (q) => `In pantry: ${q}`,
    packOf: (q) => `Pack of ${q}`,
    displayTitle: "Display case",
    stat: {
      rep: {
        title: "Reputation",
        body: "The higher your reputation, the more customers visit each day. It rises when customers get the right cake, pre-orders are filled and VIPs are happy. It falls when change comes up short or a VIP leaves unhappy. A good mood adds a little every day too.",
      },
      energy: {
        title: "Energy",
        body: "Every waking minute costs a little, a day at the counter costs more, and a good sleep brings it back. Below 50 your hands shake: pours overshoot, taps on the stove and oven come late. At 0 you must rest before working again. Coffee gives energy now but costs sleep; a 30-minute nap gives a little back.",
      },
      mood: {
        title: "Mood",
        body: "Mood rises with a full night, 3-star batches and a profitable day, and falls with late nights, failed batches, losses and customers walking off. A happy baker has more patient customers, better tips, better sleep and a little more reputation each day.",
      },
    },
    gotIt: "Got it",
    ingredientsTitle: "Ingredients",
    trayLabel: "Tray",
    musicBox: {
      title: "Music box",
      playing: "Now playing",
      off: "Stop",
      buyMore: "More records at the supermarket",
      owned: "Owned",
      bought: "The new record is on!",
      buyAsk: "Buy this record?",
      buy: "Buy",
    },
    tour: {
      welcome:
        "Welcome to Cloud Bakery! I'm Mây. Let's bake our very first batch tonight.",
      start: "Let's go",
      skip: "Skip",
      skipped: "You can replay the guide from Settings.",
      next: "Next",
      market: "The pantry is empty. Let's go to the supermarket first!",
      shopping:
        "Tap things to put them in the basket. Cookies need flour, sugar, butter and eggs.",
      pay: "That's everything! Tap pay.",
      bake: "We have ingredients. Into the kitchen!",
      pickCookie: "Make butter cookies, the easiest one.",
      kitchen:
        "Follow the recipe card above: pick the right ingredient, measure just enough, stir the right turns, bake at the right heat.",
      display: "The cookies are in the display case, ready for tomorrow.",
      bed: "It's late. Sleep, so you have energy to sell.",
      open: "Good morning! Time to open the doors.",
      selling:
        "Customers order in their bubble. Tap cakes in the case to put them on the tray, then tap Serve.",
      done: "Well done! The bakery is yours now. Good luck!",
      thanks: "Thanks, Mây!",
      replay: "Replay the tutorial",
    },
    trayHint: "Tap a cake in the case to put it here",
    tile: {
      revenue: "Sales",
      tips: "Tips",
      boxes: "Boxes",
      ingredients: "Ingredients",
      rep: "Reputation",
      served: "Served",
      walked: "Walked off",
      wasted: "Binned",
      spoiled: "Spoiled",
    },
    fact: {
      time: (m) => `${m} min`,
      pieces: (n) => `${n} per batch`,
      price: (p) => `${p} each`,
      batch: (p) => `${p} a batch`,
      mastery: "Mastery",
    },
    stepTag: {
      mix: {
        cream: "Cream",
        whisk: "Whisk",
        fold: "Fold",
        knead: "Knead",
        stir: "Stir",
      },
      stove: { caramel: "Caramel", fry: "Fry", cook: "Cook", steam: "Steam" },
      wait: { proof: "Prove", cool: "Cool" },
      oven: "Bake",
      pipe: {
        frost: "Frost",
        glaze: "Glaze",
        fill: "Fill",
        cream: "Top",
        topping: "Top",
        dust: "Dust",
      },
    },
    stepsTitle: "Steps",
    learned: "New recipe learned!",
    tapContinue: "Tap to continue",
    displayKeep: "Cakes keep for one day, so sell them all when you open!",
    displaySpaces: (n, cap) => `${n}/${cap} spaces`,
    pausedNote:
      "The bakery takes a break. The clock, the ovens and the customers all wait.",
  },
};
