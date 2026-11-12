import type { GameManifest } from "@web-games/core";
import { changelog } from "./changelog";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "dao-vang",
  title: { vi: "Đào Vàng", en: "Gold Dig" },
  tagline: {
    vi: "Canh móc, thả dây, kéo vàng lên! Đủ tiền trước khi hết 60 giây.",
    en: "Time the swing, drop the claw, haul up the gold! Make the goal before 60 seconds run out.",
  },
  description: {
    vi: "Cô thợ mỏ đội nón lá quay tời bên bờ cỏ, móc sắt đung đưa qua lại. Chạm đúng lúc để thả móc: móc lao xuống, gắp món đầu tiên nó chạm và kéo về. Vàng to, đá to thì nặng, kéo rất chậm; kim cương nhỏ mà quý. Túi “?” có thể là tiền, thuốc nổ hay sức mạnh. Chuột chũi đeo kính phi công chạy qua chạy lại, có con ôm cả kim cương. Mỗi màn có 60 giây và một mục tiêu tiền tăng dần. Đủ tiền thì vào tiệm mua thuốc nổ, thuốc khoẻ, cỏ bốn lá… cho màn sau. Thiếu là thua!",
    en: "A miner in a conical hat cranks her winch on the grass while the claw swings back and forth. Tap at the right moment: the claw shoots down, grabs the first thing it touches and reels it in. Big gold and big rocks are heavy and slow; diamonds are small and precious. A “?” sack may hold money, dynamite or super strength. Goggled moles scurry to and fro, and some carry diamonds. Each level gives you 60 seconds and a rising money goal. Make it and visit the shop for dynamite, a strength tonic, a lucky clover and more. Miss it and the run is over!",
  },
  controls: {
    vi: [
      "Chạm màn hình (hoặc [Space] / [↓]) để thả móc khi nó chỉ vào món muốn lấy.",
      "Đang kéo món nặng vô giá trị? Chạm nút thuốc nổ (hoặc [↑]) để phá bỏ và kéo móc về nhanh.",
      "Đủ tiền mục tiêu khi hết giờ là qua màn. Tiền dồn sang màn sau.",
      "Trong tiệm: chạm món để mua, [1]–[4] trên máy tính. Đồ mua dùng cho màn kế tiếp.",
      "[P] hoặc [Esc] để tạm dừng.",
    ],
    en: [
      "Tap the screen (or [Space] / [↓]) to drop the claw when it points at what you want.",
      "Reeling in something heavy and worthless? Tap the dynamite button (or [↑]) to blow it up and snap back.",
      "Have the goal in the bank when time runs out to clear the level. Money carries over.",
      "In the shop: tap an item to buy it, or [1]–[4] on a keyboard. Purchases work next level.",
      "[P] or [Esc] to pause.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["đào vàng", "móc câu", "kim cương", "arcade"],
    en: ["gold mining", "claw", "diamonds", "arcade"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-04T20:00",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "dòng game arcade đào vàng bằng móc câu kinh điển",
    en: "the classic gold-miner claw arcade genre",
  },
};

export default manifest;
