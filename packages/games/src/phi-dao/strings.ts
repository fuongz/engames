import type { Localized } from "@web-games/core/i18n";
interface Copy {
  title: string;
  subtitle: string;
  solo: string;
  duo: string;
  hint: string;
  duoHint: string;
  stage: string;
  boss: string;
  left: string;
  score: string;
  over: string;
  won: string;
  again: string;
  menu: string;
  resume: string;
  paused: string;
  throw: string;
  team: string;
  clear: string;
  miss: string;
  waiting: string;
  lobby: string;
  onlineHint: string;
  tryKnives: string;
  classicKnife: string;
  dragonKnife: string;
  classicEffect: string;
  dragonEffect: string;
}
export const STRINGS: Localized<Copy> = {
  vi: {
    tryKnives: "Chọn dao · phím 1 / 2",
    classicKnife: "Cổ điển",
    dragonKnife: "Rồng sét",
    classicEffect: "Vệt gió nhẹ",
    dragonEffect: "Sét tím · vòng điện",
    title: "PHI DAO",
    subtitle: "VƯỜN CAM ĐÊM",
    solo: "Chơi cá nhân",
    duo: "2 người · cùng máy",
    hint: "Chạm hoặc Space để phóng · Né dao đã cắm",
    duoHint: "Người 1: A / bên trái · Người 2: L / bên phải",
    stage: "MÀN",
    boss: "BIA ĐẶC BIỆT",
    left: "DAO CÒN",
    score: "ĐIỂM",
    over: "Hẹn ván sau!",
    won: "Vườn cam chúc mừng!",
    again: "Chơi lại",
    menu: "Đổi chế độ",
    resume: "Chạm để tiếp tục",
    paused: "Tạm nghỉ",
    throw: "PHÓNG",
    team: "CÙNG VƯỢT 15 MÀN · CHUNG 3 MẠNG",
    clear: "Đẹp lắm!",
    miss: "Chạm dao rồi!",
    waiting: "Đang chờ trạng thái phòng…",
    lobby: "Về phòng chờ",
    onlineHint: "Co-op QR: chọn Chơi co-op online ở màn trước.",
  },
  en: {
    tryKnives: "Choose a knife · keys 1 / 2",
    classicKnife: "Classic",
    dragonKnife: "Storm dragon",
    classicEffect: "Soft wind trail",
    dragonEffect: "Violet arcs · rings",
    title: "KNIFE BLOOM",
    subtitle: "THE MIDNIGHT ORCHARD",
    solo: "Solo play",
    duo: "2 players · same device",
    hint: "Tap or Space to throw · Avoid other knives",
    duoHint: "Player 1: A / left · Player 2: L / right",
    stage: "STAGE",
    boss: "SPECIAL TARGET",
    left: "KNIVES LEFT",
    score: "SCORE",
    over: "Another round?",
    won: "The orchard is yours!",
    again: "Play again",
    menu: "Change mode",
    resume: "Tap to continue",
    paused: "Taking a breath",
    throw: "THROW",
    team: "CLEAR 15 STAGES TOGETHER · 3 SHARED LIVES",
    clear: "Beautiful!",
    miss: "Knife collision!",
    waiting: "Waiting for the room…",
    lobby: "Back to lobby",
    onlineHint: "QR co-op: choose Play online co-op on the previous screen.",
  },
};

export const SHOP_STRINGS = {
  vi: {
    title: "XƯỞNG DAO",
    balance: "VÉ CỦA BẠN",
    tickets: "vé",
    free: "Miễn phí",
    locked: "Chưa sở hữu",
    owned: "Đã sở hữu",
    equipped: "Đang dùng",
    equip: "Trang bị",
    buy: "Mua · 2.000 vé",
    confirm: "Mua Rồng sét?",
    confirmHint: "Trừ 2.000 vé · Sở hữu vĩnh viễn",
    confirmBuy: "Xác nhận mua",
    cancel: "Để sau",
    close: "Về game",
    loading: "Đang tải cửa hàng…",
    busy: "Đang xử lý…",
    error: "Chưa kết nối được. Thử lại nhé.",
    retry: "Thử lại",
    insufficient: "Chưa đủ 2.000 vé. Hãy tích thêm vé nhé.",
    signIn: "Đăng nhập để mua",
    unavailable: "Mở game trên Engames để mua dao.",
    bought: "Đã mở khóa Rồng sét! Chọn Trang bị để dùng.",
    online: "Mua dao trước khi vào phòng online.",
    hint: "Chọn dao: 1 / 2 · Xác nhận: Enter · Trở lại: Esc",
    basic: "Vệt gió nhẹ · tia lửa nhỏ",
    premium: "Sét tím · đuôi điện · vòng sáng",
    cosmetic: "Cùng tốc độ và va chạm · Khác hình dáng, hiệu ứng",
  },
  en: {
    title: "KNIFE WORKSHOP",
    balance: "YOUR TICKETS",
    tickets: "tickets",
    free: "Free",
    locked: "Locked",
    owned: "Owned",
    equipped: "Equipped",
    equip: "Equip",
    buy: "Buy · 2,000 tickets",
    confirm: "Buy Storm Dragon?",
    confirmHint: "Spend 2,000 tickets · Yours permanently",
    confirmBuy: "Confirm purchase",
    cancel: "Not now",
    close: "Back to game",
    loading: "Loading workshop…",
    busy: "Working…",
    error: "Could not connect. Please try again.",
    retry: "Try again",
    insufficient: "You need 2,000 tickets. Collect a few more first.",
    signIn: "Sign in to buy",
    unavailable: "Open this game on Engames to buy knives.",
    bought: "Storm Dragon unlocked! Select Equip to use it.",
    online: "Buy knives before joining an online room.",
    hint: "Choose: 1 / 2 · Confirm: Enter · Back: Esc",
    basic: "Soft wind trail · small sparks",
    premium: "Violet arcs · electric trail · light rings",
    cosmetic: "Same speed and hitbox · Different looks and effects",
  },
};
