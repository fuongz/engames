import type { GameManifest } from "@web-games/core";
import { changelog } from "./changelog";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "co-vua",
  title: { vi: "Cờ Vua", en: "Chess" },
  tagline: {
    vi: "Cờ vua đủ luật trên bàn gỗ ấm áp. Đấu máy ba mức, đấu bạn cùng máy, hoặc thách đấu online.",
    en: "Full-rules chess on a warm wooden board. Play the computer, a friend on the same phone, or a friend online.",
  },
  description: {
    vi: "Bàn cờ gỗ óc chó và gỗ phong dưới ánh đèn bàn, quân ngà và quân gỗ chạm khắc. Đủ luật cờ vua quốc tế: nhập thành, bắt tốt qua đường, phong cấp (chọn Hậu, Xe, Tượng hoặc Mã), chiếu hết, hoà pat, hoà khi lặp lại thế cờ 3 lần, luật 50 nước và khi không đủ quân chiếu hết. Đấu máy ba mức Dễ, Vừa, Khó và tự chọn cầm quân Trắng, Đen hoặc ngẫu nhiên; chơi hai người thay nhau trên một máy; hoặc tạo phòng, gửi link (hay cho bạn quét mã QR) và đấu online 1 chọi 1 không tính giờ, có xin thua và cầu hoà.",
    en: "A walnut-and-maple board under a desk lamp, with carved ivory and wooden pieces. Full FIDE rules: castling, en passant, promotion (pick a queen, rook, bishop or knight), checkmate, stalemate, and draws by threefold repetition, the fifty-move rule and insufficient material. Play the computer on Easy, Normal or Hard as White, Black or a random side; take turns with a friend on one phone; or make a room, send the link (or let them scan its QR code) and play 1-on-1 online with no clock, with resign and draw offers.",
  },
  controls: {
    vi: [
      "Chạm một quân để thấy các ô đi được, rồi chạm ô có chấm (hoặc kéo quân tới đó).",
      "Chạm lại quân đang chọn để bỏ chọn. Tốt đến hàng cuối: chọn quân để phong cấp.",
      "Đấu máy: nút Đi lại rút nước của bạn và nước máy vừa đi (3 lần mỗi ván). Thắng nhanh được thêm điểm.",
      "Online: không tính giờ; Xin thua (chạm hai lần), Cầu hoà; rời phòng quá 60 giây là thua.",
      "Máy tính: [U] đi lại, [F] xoay bàn, [Esc] menu.",
    ],
    en: [
      "Tap a piece to see where it can go, then tap a dotted square (or drag the piece there).",
      "Tap the chosen piece again to put it down. A pawn on the last rank: pick what it becomes.",
      "Against the computer: Undo takes back your move and its reply (3 per game). Quick wins score more.",
      "Online: no clock; Resign (tap twice) and Offer draw; being away for over 60 seconds loses.",
      "Desktop: [U] undo, [F] flip the board, [Esc] menu.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["cờ vua", "chess", "cờ", "đấu trí", "đối kháng", "2 người", "online"],
    en: ["chess", "board game", "strategy", "versus", "2 players", "online"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 2 },
  releasedAt: "2026-11-08T14:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Cờ vua theo Luật Cờ vua của FIDE",
    en: "Chess, as in the FIDE Laws of Chess",
  },
};

export default manifest;
