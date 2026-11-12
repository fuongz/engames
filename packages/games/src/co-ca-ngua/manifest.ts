import type { GameManifest } from "@web-games/core";
import { changelog } from "./changelog";
import banner from "./banner.webp";
import { H, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "co-ca-ngua",
  title: { vi: "Cờ Cá Ngựa", en: "Ludo" },
  tagline: {
    vi: "Gieo hai xí ngầu, xuất ngựa, đá nhau về chuồng. 2–4 người: đấu máy, chơi chung một máy, hoặc online với bạn bè.",
    en: "Roll two dice, ride out and knock rivals back to the stable. 2–4 players: the computer, friends on one phone, or friends online.",
  },
  description: {
    vi: "Cờ cá ngựa của cả nhà, giờ nằm gọn trên điện thoại: mỗi người 4 chú ngựa, mỗi lượt gieo hai xí ngầu, cộng lại cho một con ngựa đi; đổ đôi hoặc 1-6 mới xuất chuồng và được gieo thêm; chạy hết một vòng bàn cờ rồi rẽ vào đường về đích. Không được nhảy qua đầu ngựa khác, dừng đúng ô ngựa đối thủ là đá nó về chuồng. Ai đưa đủ 4 ngựa về đích trước thì về nhất, những người còn lại chơi tiếp tranh hạng. Chọn 2, 3 hoặc 4 người; đấu máy ba mức Dễ, Vừa, Khó; thay nhau gieo trên cùng một máy; hoặc tạo phòng online, gửi link cho bạn bè, ghế trống để máy chơi.",
    en: "The family board game, on your phone: four horses each, two dice a turn, added up and moved by one horse; doubles or a 1 and a 6 bring a horse out and roll again; race a full lap of the board and turn up your own home path. No jumping over other horses, and stopping on a rival sends it back to its stable. First to bring all four home wins, and everyone else plays on for the places. Choose 2, 3 or 4 players; play the computer on Easy, Normal or Hard; pass one phone around; or open an online room, send friends the link, and let the computer take any empty seat.",
  },
  controls: {
    vi: [
      "Chạm xí ngầu để gieo cả hai. Đổ đôi hoặc 1-6 được gieo thêm; ba lần liền thì mất lượt.",
      "Chạm con ngựa đang sáng (có mũi tên) để đi tổng hai xí ngầu; vòng nét đứt là ô nó sẽ tới.",
      "Online: mỗi lượt 20 giây, hết giờ máy đi thay; mất kết nối thì máy chơi hộ đến khi bạn quay lại.",
      "Máy tính: [Space] gieo, [1]–[4] chọn ngựa, [Esc] menu.",
    ],
    en: [
      "Tap the dice to roll both. Doubles or a 1 and a 6 roll again; three in a row lose the turn.",
      "Tap a glowing horse (with an arrow) to move it the total of both dice; the dashed ring shows where it lands.",
      "Online: 20 seconds a turn, then the computer moves for you; if you drop, it plays your seat until you're back.",
      "Desktop: [Space] roll, [1]–[4] pick a horse, [Esc] menu.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["cờ cá ngựa", "ludo", "xí ngầu", "board game", "2-4 người", "online"],
    en: ["ludo", "board game", "dice", "family", "2-4 players", "online"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 4, bots: true, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-08T13:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Cờ cá ngựa (Ludo) truyền thống",
    en: "Traditional Ludo (cờ cá ngựa)",
  },
};

export default manifest;
