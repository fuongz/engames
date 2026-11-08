import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, MAX_PLAYERS, MIN_PLAYERS, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "co-ty-phu",
  title: { vi: "Cờ Tỷ Phú", en: "Tycoon" },
  tagline: {
    vi: "Mua đất khắp Việt Nam, xây nhà, thu tiền thuê và giao dịch cho đủ bộ. Đấu máy, chuyền máy cho bạn bè, hoặc chơi online 2–4 người.",
    en: "Buy land across Vietnam, build houses, collect rent and trade for full sets. Play the computer, pass the phone, or play online with 2–4 people.",
  },
  description: {
    vi: "Bàn cờ tỷ phú 40 ô với tám bộ màu từ Hà Giang đến Hà Nội, bến xe, ga tàu, cảng biển, sân bay, điện và nước. Đổ xúc xắc đi quanh bàn, mua đất hoặc cho mọi người đấu giá, đủ bộ màu thì xây nhà rồi lên khách sạn, cầm cố khi cần tiền, giao dịch đất và tiền với người khác. Đổ đôi được đổ tiếp, ba lần đôi là vào trại giam; rút thẻ Cơ hội và Khí vận. Hết tiền thì phá sản, người cuối cùng trụ lại thắng — hoặc đặt giới hạn 30 / 60 phút, hết giờ ai giàu nhất thắng. Chơi với máy ba mức Dễ, Vừa, Khó, chuyền máy cho tối đa 4 người, hoặc mở phòng online 2–4 người, máy chơi thay ghế trống.",
    en: "A 40-square property board with eight colour sets from Ha Giang to Hanoi, a bus station, rail station, seaport and airport, plus power and water. Roll round the board, buy land or send it to auction, build houses and then hotels on full sets, mortgage when you need cash, and trade land and money with the others. Doubles roll again, three doubles send you to jail; draw Chance and Fortune cards. Run out of money and you're bankrupt — the last player standing wins, or set a 30 / 60 minute limit and the richest wins when time is up. Play the computer on Easy, Normal or Hard, pass the phone among up to 4 people, or open a room online for 2–4 players with the computer in empty seats.",
  },
  controls: {
    vi: [
      "Bảng dưới cùng luôn hiện việc cần làm: đổ xúc xắc, mua / đấu giá, trả giá, trả lời giao dịch, hết lượt.",
      "Tài sản: xây hoặc bán nhà, cầm cố, chuộc đất. Giao dịch: chọn người, chọn đất và tiền hai bên rồi gửi.",
      "Chạm một ô để xem thẻ đất. Kéo để xem quanh bàn, chụm hai ngón để phóng to; nút Cả bàn hoặc bản đồ nhỏ để xem toàn bàn.",
      "Chạm thẻ người chơi để xem tài sản của họ; Nhật ký ghi lại mọi việc đã xảy ra.",
      "Online: mỗi quyết định 30 giây, hết giờ máy quyết định giúp; mất kết nối thì máy chơi thay đến khi bạn quay lại.",
      "Máy tính: [Space] đổ xúc xắc / hết lượt, [Esc] menu.",
    ],
    en: [
      "The bottom panel always shows what to do now: roll, buy or auction, bid, answer a trade, end your turn.",
      "Assets: build or sell houses, mortgage, redeem. Trade: pick a player, pick land and cash on both sides, send.",
      "Tap a square for its deed card. Drag to look around, pinch to zoom; Board or the mini-map shows the whole board.",
      "Tap a player's card to see their assets; the Log keeps everything that happened.",
      "Online: 30 seconds per decision, then the computer decides for you; if you drop, the computer plays your seat until you're back.",
      "Desktop: [Space] roll / end turn, [Esc] menu.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["cờ tỷ phú", "mua bán đất", "bàn cờ", "xúc xắc", "giao dịch", "2-4 người", "online"],
    en: ["property", "board game", "dice", "trading", "2-4 players", "online", "vietnam"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, bots: true, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-08T14:00",
  inspiredBy: {
    vi: "Thể loại cờ tỷ phú (mua bán đất) với luật quốc tế quen thuộc; bàn cờ, thẻ và giá là của riêng Engames",
    en: "The property-trading board game genre and its usual rules; the board, cards and prices are Engames' own",
  },
};

export default manifest;
