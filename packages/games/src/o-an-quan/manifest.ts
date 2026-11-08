import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, ROOM_SETTINGS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "o-an-quan",
  title: { vi: "Ô Ăn Quan", en: "Ô Ăn Quan" },
  tagline: {
    vi: "Trò chơi dân gian: rải dân, ăn quan, ai nhiều điểm hơn thắng. Đấu máy, đấu bạn cùng máy, hoặc thách đấu online.",
    en: "The Vietnamese folk game: sow the pebbles, take the quan, most points wins. Play the computer, a friend on the same phone, or a friend online.",
  },
  description: {
    vi: "Trò ô ăn quan của sân đình, sân gạch tuổi thơ: hai hàng năm ô dân, mỗi ô 5 viên sỏi, hai đầu là hai ô quan. Bốc một ô bên mình, chọn chiều và rải mỗi ô một viên; gặp ô có dân thì bốc rải tiếp, gặp ô trống thì ăn ô sau nó, cứ trống một ô lại ăn tiếp một ô. Hết dân thì rải lại, thiếu thì vay đối thủ. Hết cả hai quan, ai nhiều điểm hơn thắng (dân 1 điểm, quan 10 điểm). Đấu máy ba mức Dễ, Vừa, Khó; chơi hai người thay nhau trên một máy; hoặc tạo phòng, gửi link (hay cho bạn quét mã QR) và đấu online 1 chọi 1. Ba giao diện để chọn: sân gạch phấn trắng, khay sơn mài, tranh Đông Hồ; tuỳ chọn luật cấm ăn quan non.",
    en: "The pebble game of every Vietnamese courtyard: two rows of five small pits with five pebbles each, and a big quan pit at each end. Take every pebble from one of your pits, pick a way round and drop one in each pit; land before a full pit and you pick it up and carry on, land before an empty one and you capture the pit after it, again and again while the pattern holds. Run out and you refill, borrowing from your opponent if you must. When both quan are gone, most points wins (a pebble is 1, a quan 10). Play the computer on Easy, Normal or Hard; take turns with a friend on one phone; or make a room, send the link (or let them scan its QR code) and play 1-on-1 online. Three looks to choose from: chalk on a brick courtyard, a lacquer tray or a folk woodblock print; and an optional young-quan rule.",
  },
  controls: {
    vi: [
      "Chạm một ô bên bạn rồi chạm mũi tên trái hoặc phải để chọn chiều rải.",
      "Hoặc vuốt ngang trên ô đó để rải luôn theo chiều vuốt.",
      "Nút Giao diện đổi giữa Sân gạch, Sơn mài và Đông Hồ.",
      "Online: chủ phòng chọn Bo1/Bo3/Bo5 và luật ăn quan non; mỗi lượt 30 giây, hết giờ máy đi giúp; hết giờ 3 lần liền hoặc rời phòng quá 30 giây là thua trận.",
      "Máy tính: [1]–[5] chọn ô, [←][→] rải, [T] đổi giao diện, [Esc] menu.",
    ],
    en: [
      "Tap one of your pits, then the left or right arrow to pick which way to sow.",
      "Or swipe sideways on the pit to sow that way at once.",
      "The Theme button switches between Courtyard, Lacquer and Folk print.",
      "Online: the host picks best of 1, 3 or 5 and the young-quan rule; 30 seconds a turn, and a move is played for you when time runs out; three timeouts in a row or 30 seconds away loses the match.",
      "Desktop: [1]–[5] pick a pit, [←][→] sow, [T] theme, [Esc] menu.",
    ],
  },
  category: "tri-tue",
  tags: {
    vi: ["ô ăn quan", "dân gian", "trò chơi dân gian", "đối kháng", "2 người", "online"],
    en: ["o an quan", "mancala", "folk game", "Vietnamese", "versus", "2 players", "online"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["versus"], minPlayers: 2, maxPlayers: 2, settings: ROOM_SETTINGS },
  releasedAt: "2026-11-08T18:00",
  inspiredBy: {
    vi: "Trò chơi dân gian Ô ăn quan; luật tham khảo oanquan.online",
    en: "The Vietnamese folk game Ô ăn quan; rules as on oanquan.online",
  },
};

export default manifest;
