import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "co-lat",
  title: { vi: "Cờ Lật", en: "Reversi" },
  tagline: {
    vi: "Kẹp quân đối thủ để lật thành quân mình, ai nhiều quân hơn thắng. Đấu máy, đấu bạn cùng máy, hoặc thách đấu online.",
    en: "Trap your rival's discs to flip them to your colour; most discs wins. Play the computer, a friend on the same phone, or a friend online.",
  },
  description: {
    vi: "Cờ lật cổ điển trên bàn nỉ xanh: 8 × 8 ô, mở đầu với 4 quân ở giữa, Đen đi trước. Đặt một quân sao cho kẹp được hàng quân đối thủ giữa nó và một quân của bạn, theo hàng ngang, dọc hay chéo, và cả hàng lật sang màu của bạn. Không còn nước đi thì mất lượt; khi cả hai cùng hết nước, ai nhiều quân hơn thắng. Đấu máy ba mức Dễ, Vừa, Khó và chọn cầm Đen hay Trắng; chơi hai người trên một máy; hoặc tạo phòng, gửi link và đấu online 1 chọi 1 theo thể thức Bo1, Bo3 hoặc Bo5, đổi màu mỗi ván.",
    en: "The classic disc-flipping game on green felt: an 8 × 8 board, four discs in the middle, Black moves first. Place a disc so a line of your rival's discs is trapped between it and another of yours, across, down or on a diagonal, and the whole line flips to your colour. No legal move means you pass; when neither side can move, most discs wins. Play the computer on Easy, Normal or Hard as Black or White; take turns with a friend on one phone; or make a room, send the link and play 1-on-1 online, best of 1, 3 or 5, swapping colours each game.",
  },
  controls: {
    vi: [
      "Chạm một ô có chấm để đặt quân; chấm mờ là các ô đi được (nút Gợi ý để bật, tắt).",
      "Đấu máy: chọn cầm Đen (đi trước) hay Trắng; nút Đi lại rút lại nước vừa rồi (3 lần mỗi ván). Thắng càng đậm càng nhiều điểm.",
      "Online: chủ phòng chọn Bo1/Bo3/Bo5, đổi màu mỗi ván; mỗi lượt 30 giây, hết giờ máy đánh hộ; hết giờ 3 lần liền hoặc rời phòng quá 30 giây là thua trận.",
      "Máy tính: [H] gợi ý, [U] đi lại, [Esc] menu.",
    ],
    en: [
      "Tap a dotted square to place a disc; the faint dots show your legal moves (toggle them with Hints).",
      "Against the computer: play Black (moves first) or White; Undo takes back your last move (3 per game). Bigger wins score more.",
      "Online: the host picks best of 1, 3 or 5, and colours swap each game; 30 seconds a turn, and a move is played for you when time runs out; three timeouts in a row or 30 seconds away loses the match.",
      "Desktop: [H] hints, [U] undo, [Esc] menu.",
    ],
  },
  category: "tri-tue",
  tags: {
    vi: ["cờ lật", "reversi", "cờ trí tuệ", "đối kháng", "2 người", "online"],
    en: ["reversi", "board game", "strategy", "versus", "2 players", "online"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 2, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-08T14:00",
  inspiredBy: {
    vi: "Cờ lật (Reversi), theo luật Othello quốc tế tiêu chuẩn",
    en: "Reversi, played by the standard international Othello rules",
  },
};

export default manifest;
