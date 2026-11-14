import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { changelog } from "./changelog";
import { H, MIN_PLAYERS, SEATS, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "noi-la-co",
  title: { vi: "Nói Là Có", en: "Say It, Survive It" },
  tagline: {
    vi: "Viết một chữ, cả bãi cùng chịu. Ai trụ lại cuối cùng?",
    en: "Write one word and everyone lives with it. Who is left standing?",
  },
  description: {
    vi: "Tám người chạy nhảy trên một bãi bồi rộng giữa sông, có đồi, cây và bờ cát, nhìn từ sau lưng nhân vật của bạn. Mỗi lượt, một người được chọn viết đúng một chữ, và chữ đó lập tức thành thật: “lũ” thì nước dâng ngập bãi cát, “trâu điên” thì có con trâu lao tới, “vỏ chuối” thì cả bãi trơn trượt. Chữ của bạn cũng hại chính bạn, nên hãy viết thứ mình né được. Sự kiện cũ chưa tắt thì chữ mới đã rơi xuống, càng về sau càng loạn. Mỗi người có ba tim; hết tim thì hóa hồn ma, nhưng hồn ma vẫn được viết chữ để trả đũa người còn sống. Người cuối cùng còn đứng trên bãi thắng.",
    en: "Eight players run and jump around a wide sandbank in the middle of a river, with hills, trees and a sandy shore, seen from behind your own villager. Each turn one of them is picked to write exactly one word, and it comes true at once: “flood” and the water covers the sand, “mad buffalo” and one comes charging, “banana peel” and the whole bank turns slippery. Your word hits you too, so write something you can dodge. New words land before the old events end, and it only gets wilder. Everyone has three hearts; lose them and you become a ghost, but ghosts still write, to get back at the living. The last one standing wins.",
  },
  controls: {
    vi: [
      "Điện thoại: kéo nửa trái màn hình để chạy, vuốt nửa phải để xoay camera; nút Nhảy để nhảy lên đồi hoặc qua dung nham, sóng, trâu; nút Lướt để chạy nhanh một đoạn.",
      "Tới lượt viết: chạm một trong bốn chữ gợi ý, hoặc gõ chữ bất kỳ rồi bấm Viết.",
      "Máy tính: [W] [A] [S] [D] hoặc phím mũi tên để chạy, kéo chuột hoặc [Q] [E] để xoay camera, [Space] để nhảy, [Shift] để lướt, [Enter] để gõ chữ, [1]–[4] để chọn gợi ý.",
      "Online: tạo phòng, gửi link hoặc mã QR cho bạn bè (2–8 người); máy sẽ ngồi vào ghế trống.",
    ],
    en: [
      "Phone: drag on the left half to run, swipe the right half to turn the camera; Jump to get up a hill or over lava, a wave or a buffalo; Dash for a short burst.",
      "On your turn to write: tap one of the four suggestions, or type any word and press Write.",
      "Desktop: [W] [A] [S] [D] or the arrow keys to run, drag the mouse or [Q] [E] to turn the camera, [Space] to jump, [Shift] to dash, [Enter] to type, [1]–[4] to pick a suggestion.",
      "Online: make a room and send the link or QR code to friends (2–8 players); bots take the empty seats.",
    ],
  },
  category: "hanh-dong",
  online: { modes: ["versus"], minPlayers: MIN_PLAYERS, maxPlayers: SEATS, bots: true },
  tags: {
    vi: ["sinh tồn", "viết chữ", "khối 3D", "góc nhìn thứ ba", "tiệc tùng", "nhiều người", "online", "QR"],
    en: ["survival", "word", "voxel 3D", "third person", "party", "multiplayer", "online", "QR"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-14T12:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Thể loại sinh tồn tiệc tùng “gõ một chữ thành thảm họa”",
    en: "The “type a word, survive the disaster” party survival genre",
  },
};

export default manifest;
