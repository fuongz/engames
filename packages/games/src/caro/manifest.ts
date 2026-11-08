import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "caro",
  title: { vi: "Caro", en: "Caro" },
  tagline: {
    vi: "Cờ caro trên trang vở ô li: 5 ô liền là thắng. Đấu máy, đấu bạn cùng máy, hoặc thách đấu online.",
    en: "Five in a row on a squared notebook page. Play the computer, a friend on the same phone, or a friend online.",
  },
  description: {
    vi: "Trò caro giờ ra chơi, giờ nằm gọn trên điện thoại: bàn 19 × 19 ô kẻ trên trang vở, X bút đỏ đi trước, O bút xanh theo sau. Ai có 5 dấu liền nhau theo hàng ngang, dọc hoặc chéo là thắng, theo luật chặn hai đầu: hàng bị đối thủ chặn cả hai đầu thì không tính. Đấu máy ba mức Dễ, Vừa, Khó; chơi hai người thay nhau trên một máy; hoặc tạo phòng, gửi link (hay cho bạn quét mã QR) và đấu online 1 chọi 1 theo thể thức Bo1, Bo3 hoặc Bo5.",
    en: "The pen-and-paper classic from every school break, on your phone: a 19 × 19 grid on a notebook page, red X goes first and blue O follows. Five of your marks in a row across, down or on a diagonal wins, under the Vietnamese rule that a row capped by your opponent at both ends doesn't count. Play the computer on Easy, Normal or Hard; take turns with a friend on one phone; or make a room, send the link (or let them scan its QR code) and play 1-on-1 online, best of 1, 3 or 5.",
  },
  controls: {
    vi: [
      "Chạm một ô để chọn, chạm lần nữa để đánh.",
      "Kéo một ngón để di chuyển bàn khi đang phóng to; chụm hai ngón hoặc bấm nút kính lúp để phóng to, thu nhỏ.",
      "Đấu máy: nút Đi lại rút lại nước vừa rồi (3 lần mỗi ván). Thắng nhanh được thêm điểm.",
      "Online: chủ phòng chọn Bo1/Bo3/Bo5; mỗi lượt 30 giây, hết giờ máy đánh hộ; hết giờ 3 lần liền hoặc rời phòng quá 30 giây là thua trận.",
      "Máy tính: [Z] phóng to, [U] đi lại, [Esc] menu.",
    ],
    en: [
      "Tap a square to pick it, then tap it again to play.",
      "Drag one finger to move the board when zoomed in; pinch or use the magnifier button to zoom.",
      "Against the computer: Undo takes back your last move (3 per game). Quick wins score more.",
      "Online: the host picks best of 1, 3 or 5; 30 seconds a turn, and a move is played for you when time runs out; three timeouts in a row or 30 seconds away loses the match.",
      "Desktop: [Z] zoom, [U] undo, [Esc] menu.",
    ],
  },
  category: "tri-tue",
  tags: {
    vi: ["caro", "cờ caro", "5 ô", "đối kháng", "2 người", "online"],
    en: ["gomoku", "five in a row", "tic-tac-toe", "versus", "2 players", "online"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 2, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-08T12:00",
  inspiredBy: {
    vi: "Cờ caro (gomoku) trên giấy, luật theo trang learnplaywin.net/caro",
    en: "Pen-and-paper caro (gomoku), rules as on learnplaywin.net/caro",
  },
};

export default manifest;
