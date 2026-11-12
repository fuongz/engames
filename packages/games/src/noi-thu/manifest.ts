import type { GameManifest } from "@web-games/core";
import { changelog } from "./changelog";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "noi-thu",
  title: { vi: "Nối Thú", en: "Critter Connect" },
  tagline: {
    vi: "Nối hai thú giống nhau bằng đường gấp khúc không quá hai lần. Dọn sạch bàn trước khi hết giờ!",
    en: "Link two matching critters with a line of at most two bends. Clear the board before time runs out!",
  },
  description: {
    vi: "Bàn chơi 8 × 12 ô đầy thú cưng pixel. Chạm hai con giống nhau: nếu nối được bằng một đường gấp khúc tối đa hai lần, đi qua ô trống hoặc vòng ra ngoài mép bàn, cả hai biến mất. Dọn sạch bàn để qua màn, trước khi thanh thời gian cầu vồng cạn. Mỗi màn các thú dịch chuyển theo một kiểu khác nhau sau mỗi cặp: rơi xuống, bay lên, dồn trái, dồn phải, tách đôi… và thời gian ngắn dần. Nối nhanh liên tiếp để ăn điểm liên hoàn. Kẹt thì dùng gợi ý, đổi chỗ hoặc đóng băng đồng hồ.",
    en: "An 8 × 12 board full of pixel critters. Tap two that match: if a line with at most two bends can join them, through empty cells or around the edge of the board, both vanish. Clear the board to finish the level before the rainbow timer runs dry. Each level the critters shift a different way after every pair: falling, floating up, sliding left or right, splitting apart… and the clock gets shorter. Match quickly in a row for combo points. Stuck? Use a hint, a shuffle or freeze the clock.",
  },
  controls: {
    vi: [
      "Chạm một thú để chọn, chạm thú giống nó để nối. Chạm lại thú đang chọn để bỏ chọn.",
      "Đường nối gấp khúc tối đa 2 lần, chỉ đi qua ô trống, và được vòng ra ngoài mép bàn.",
      "Nút dưới cùng: gợi ý một cặp, đổi chỗ các thú, đóng băng đồng hồ 10 giây (có giới hạn lượt).",
      "Hết đường nối thì bàn tự đổi chỗ miễn phí. Mỗi màn qua được +1 gợi ý; cứ 3 màn thêm +1 đổi chỗ và +1 đóng băng.",
      "Máy tính: [H] gợi ý, [S] đổi chỗ, [F] đóng băng.",
    ],
    en: [
      "Tap a critter to pick it, then tap its twin to connect. Tap the picked one again to drop it.",
      "The line may bend at most twice, crosses only empty cells, and may run around the edge of the board.",
      "Bottom buttons: hint a pair, shuffle the critters, freeze the clock for 10 seconds (limited uses).",
      "No moves left? The board shuffles for free. Each cleared level gives +1 hint; every 3 levels also +1 shuffle and +1 freeze.",
      "Desktop: [H] hint, [S] shuffle, [F] freeze.",
    ],
  },
  category: "tri-tue",
  tags: {
    vi: ["nối thú", "nối hình", "giải đố", "tìm cặp", "pixel"],
    en: ["onet", "connect", "puzzle", "matching", "pixel"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-04T20:30",
  version: changelog[0].version,
  changelog,
  inspiredBy: {
    vi: "Thể loại nối hình Onet, ở Việt Nam quen gọi là “Pikachu cổ điển”",
    en: "The classic Onet connect-tile genre, known in Vietnam as “classic Pikachu”",
  },
};

export default manifest;
