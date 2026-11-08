import type { GameManifest } from "@web-games/core";
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
    vi: "Cờ cá ngựa của cả nhà, giờ nằm gọn trên điện thoại: mỗi người 4 chú ngựa, mỗi lượt gieo hai xí ngầu và đi từng xí ngầu một, ra 6 mới xuất chuồng, đổ đôi được gieo thêm; chạy hết một vòng bàn cờ rồi rẽ vào đường về đích. Đứng trúng ô của ngựa đối thủ là đá nó về chuồng, trừ ô xuất phát và ô ngôi sao. Ai đưa đủ 4 ngựa về đích trước thì về nhất, những người còn lại chơi tiếp tranh hạng. Chọn 2, 3 hoặc 4 người; đấu máy ba mức Dễ, Vừa, Khó; thay nhau gieo trên cùng một máy; hoặc tạo phòng online, gửi link cho bạn bè, ghế trống để máy chơi.",
    en: "The family board game, on your phone: four horses each, two dice a turn spent one at a time, a 6 brings a horse out and doubles roll again; race a full lap of the board and turn up your own home path. Land on a rival to send it back to its stable, except on start and star squares. First to bring all four home wins, and everyone else plays on for the places. Choose 2, 3 or 4 players; play the computer on Easy, Normal or Hard; pass one phone around; or open an online room, send friends the link, and let the computer take any empty seat.",
  },
  controls: {
    vi: [
      "Chạm xí ngầu để gieo cả hai. Đổ đôi được gieo thêm; ba lần đôi liền thì mất lượt.",
      "Chạm một xí ngầu để chọn, rồi chạm con ngựa đang sáng (có mũi tên); vòng nét đứt là ô nó sẽ tới. Xong thì đi xí ngầu còn lại.",
      "Online: mỗi lượt 20 giây, hết giờ máy đi thay; mất kết nối thì máy chơi hộ đến khi bạn quay lại.",
      "Máy tính: [Space] gieo, [D] đổi xí ngầu, [1]–[4] chọn ngựa, [Esc] menu.",
    ],
    en: [
      "Tap the dice to roll both. Doubles roll again; three doubles in a row lose the turn.",
      "Tap a die to pick it, then a glowing horse (with an arrow); the dashed ring shows where it lands. Then play the other die.",
      "Online: 20 seconds a turn, then the computer moves for you; if you drop, it plays your seat until you're back.",
      "Desktop: [Space] roll, [D] switch die, [1]–[4] pick a horse, [Esc] menu.",
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
  inspiredBy: {
    vi: "Cờ cá ngựa (Ludo) truyền thống",
    en: "Traditional Ludo (cờ cá ngựa)",
  },
};

export default manifest;
