import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "xep-tang",
  title: { vi: "Xếp Tầng", en: "Stack Up" },
  tagline: {
    vi: "Chạm đúng lúc để xếp tấm lên tấm. Lệch bao nhiêu, cắt bấy nhiêu: tòa tháp cao được tới đâu?",
    en: "Tap at the right moment to stack slab on slab. Whatever hangs over is cut off: how high can you build?",
  },
  description: {
    vi: "Mỗi tấm mới trượt qua lại trên đỉnh tháp, lần lượt theo hai hướng. Chạm để thả: phần thò ra ngoài bị cắt rơi xuống, phần chồng khít ở lại thành đỉnh mới nhỏ hơn. Thả trượt hẳn ra ngoài là hết lượt. Thả thật khít được tính “hoàn hảo”, vang một nốt cao dần; hoàn hảo từ 3 lần liên tiếp thì tấm nở rộng trở lại. Càng lên cao tấm trượt càng nhanh, màu tháp đổi dần và bầu trời chuyển từ bình minh, ban ngày, hoàng hôn tới đêm sao.",
    en: "Each new slab slides back and forth over the top of the tower, switching direction every floor. Tap to drop it: the part hanging over is cut off and falls, the overlap stays as a new, smaller top. Miss the tower completely and the run is over. A spot-on drop counts as perfect and rings a rising note; three or more perfects in a row grow the slab back. The higher you go, the faster it slides, while the tower shifts colour and the sky turns from dawn to day, sunset and a starry night.",
  },
  controls: {
    vi: ["Chạm bất kỳ đâu để thả tấm đang trượt.", "Máy tính: [Space] hoặc [Enter] để thả, và để chơi lại."],
    en: ["Tap anywhere to drop the sliding slab.", "Desktop: [Space] or [Enter] to drop, and to play again."],
  },
  category: "arcade",
  tags: {
    vi: ["xếp tầng", "xếp khối", "một chạm", "giải trí", "tối giản"],
    en: ["stack", "blocks", "one tap", "casual", "minimal"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-08T14:30",
  inspiredBy: {
    vi: "Thể loại xếp khối một chạm, nổi tiếng nhờ “Stack” của Ketchapp",
    en: "The one-tap stacking genre made famous by Ketchapp's “Stack”",
  },
};

export default manifest;
