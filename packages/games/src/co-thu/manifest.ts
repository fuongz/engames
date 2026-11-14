import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { changelog } from "./changelog";
import { H, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "co-thu",
  title: { vi: "Cờ Thú", en: "Animal Chess" },
  tagline: {
    vi: "Voi, Sư tử, Hổ và cả Chuột tí hon: dẫn bầy thú băng qua đảo rừng, vào hang đối thủ là thắng.",
    en: "Elephant, Lion, Tiger and one tiny Rat: lead your animals across a jungle island and into the enemy den.",
  },
  description: {
    vi: "Cờ thú (cờ đấu thú) trên một hòn đảo rừng nổi giữa trời: bàn 7 × 9 ô đá rêu, hai ao nước có lá súng và hoa sen, mỗi bên một hang đá lót rơm và ba bẫy gai quanh hang. Mỗi bên có tám con thú xếp hạng từ Voi (8) đến Chuột (1); thú lớn ăn thú nhỏ hơn hoặc bằng mình, nhưng Chuột lại ăn được Voi. Chỉ Chuột bơi được, Sư tử và Hổ nhảy qua ao nếu không có Chuột chắn, và thú địch lọt vào bẫy của bạn thì con nào cũng ăn được. Đưa một con vào hang đối thủ, ăn hết quân hoặc làm đối thủ hết nước đi là thắng. Đấu máy ba mức Dễ, Thường, Khó, chọn phe Đỏ hoặc Xanh, hai người thay nhau trên một máy (bàn cờ tự xoay về phía người đến lượt), hoặc tạo phòng, gửi link hay mã QR và đấu online 1 chọi 1 với bạn bè.",
    en: "Jungle animal chess on a floating jungle island: a 7 × 9 board of mossy stone squares, two ponds with lily pads and lotus, and for each side a straw-lined stone den with three bramble traps round it. Each side has eight animals ranked from Elephant (8) down to Rat (1); an animal takes one of equal or lower rank, yet the Rat takes the Elephant. Only the Rat can swim, the Lion and Tiger leap across a pond unless a Rat is in the way, and an enemy caught in one of your traps can be taken by any of your animals. Walk into the enemy den, take every enemy animal, or leave your opponent without a move to win. Play the computer on Easy, Normal or Hard as Red or Blue, take turns with a friend on one phone while the board turns to face whoever moves, or make a room, send the link or QR code and play a friend 1-on-1 online.",
  },
  controls: {
    vi: [
      "Chạm một con thú của bạn để chọn, rồi chạm một ô sáng để đi.",
      "Chấm xanh là ô đi được, vòng đỏ là ô ăn được, đường cong là bước nhảy qua ao.",
      "Nút [?] mở bảng luật: thứ bậc các con thú và các luật đặc biệt.",
      "Online: chủ phòng chọn ai cầm phe Đỏ và thời gian mỗi nước (30 giây, 60 giây hoặc không giới hạn); hết giờ máy đi hộ, hết giờ 3 lượt liền hoặc rời trận quá 60 giây là thua. Nút Xin thua bấm hai lần để chịu thua.",
      "Máy tính: [H] mở bảng luật, [Esc] menu.",
    ],
    en: [
      "Tap one of your animals to pick it, then tap a lit square to move.",
      "A green dot is a free square, a red ring is a capture, and an arc is a leap across the pond.",
      "The [?] button opens the help card: animal ranks and the special rules.",
      "Online: the host picks who plays Red and the time per move (30 s, 60 s or no limit); when time runs out a move is played for you, and three timeouts in a row or 60 seconds away loses. Tap Resign twice to give up.",
      "Desktop: [H] help card, [Esc] menu.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["cờ thú", "cờ đấu thú", "cờ bàn", "đối kháng", "2 người", "online", "3D"],
    en: ["animal chess", "jungle chess", "board game", "versus", "2 players", "online", "3D"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 2, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-14T12:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Cờ thú (Dou Shou Qi), trò cờ bàn dân gian",
    en: "Jungle chess (Dou Shou Qi), the traditional board game",
  },
};

export default manifest;
