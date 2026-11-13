import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { changelog } from "./changelog";
import { COSMETICS, H, RACE_MAX, RACE_MIN, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "qua-duong",
  title: { vi: "Qua Đường", en: "Cross the Street" },
  tagline: {
    vi: "Chú vịt con đội nón lá băng qua phố xá, sông nước và đường ray. Đi được bao xa?",
    en: "A duckling in a conical hat crosses streets, rivers and railways. How far can it go?",
  },
  description: {
    vi: "Mỗi lần chạm, vịt nhảy lên một ô. Đường phố đầy xe máy, xe buýt và xe ba gác chạy đủ tốc độ; sông chỉ qua được khi đứng trên ghe, bè tre hoặc đám bèo tây trôi theo dòng, và trôi ra khỏi màn hình là mất lượt. Đèn đường ray nhấp nháy, chuông kêu là tàu sắp tới! Nhặt xu vàng dọc đường, đừng đứng yên hay lùi lại quá lâu kẻo chú dân phòng thổi còi chạy tới bắt. Càng đi xa xe càng đông và nhanh, còn phố xá dần chuyển sang hoàng hôn đèn lồng rồi lại về ban ngày.",
    en: "Every tap hops the duckling one square. The streets are full of motorbikes, buses and cargo carts at every speed; rivers can only be crossed on boats, bamboo rafts or clumps of water hyacinth drifting with the current, and drifting off screen ends the run. When the rail light blinks and the bell rings, a train is coming! Pick up gold coins on the way, and don't stand still or go back too long, or the ward officer will whistle and run in to catch you. The further you go, the busier and faster the traffic, while the streets drift into a lantern-lit dusk and back to day.",
  },
  controls: {
    vi: [
      "Chạm để nhảy lên; vuốt lên, xuống, trái, phải để đổi hướng.",
      "Máy tính: [↑] [↓] [←] [→] hoặc [W] [A] [S] [D]; [Space] để chơi lại.",
      "Màn hình bắt đầu: chạm hai mũi tên để chọn áo vịt đã sở hữu; mua thêm áo bằng vé ở Quầy đổi thưởng.",
      "Đua online: tạo phòng, gửi link hoặc mã QR cho 1–3 người bạn; ai đi xa nhất khi hết giờ hoặc khi mọi người bị loại thì thắng.",
    ],
    en: [
      "Tap to hop forward; swipe up, down, left or right to turn.",
      "Desktop: [↑] [↓] [←] [→] or [W] [A] [S] [D]; [Space] to play again.",
      "Start screen: tap the arrows to pick a duck outfit you own; buy more with tickets at the Prize Counter.",
      "Online race: make a room and send the link or QR code to 1–3 friends; whoever gets furthest when time runs out or everyone is out wins.",
    ],
  },
  category: "arcade",
  // Solo runs pay shared arcade tickets: rows + coins (docs/standards/tickets.md)
  tickets: true,
  cosmetics: COSMETICS,
  online: { modes: ["versus"], minPlayers: RACE_MIN, maxPlayers: RACE_MAX },
  tags: {
    vi: ["vượt đường", "vô tận", "khối 3D", "vịt con", "một chạm", "đua online", "QR"],
    en: ["crossing", "endless", "voxel 3D", "duckling", "one tap", "online race", "QR"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-13T12:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Thể loại nhảy qua làn đường vô tận với đồ họa khối",
    en: "The endless voxel lane-hopping genre",
  },
};

export default manifest;
