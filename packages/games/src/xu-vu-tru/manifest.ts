import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "xu-vu-tru",
  title: { vi: "Xu Vũ Trụ", en: "Cosmo Coins" },
  tagline: {
    vi: "Máy bắn xu robot & vũ trụ: canh vòng quay ăn vé, mưa xu, lõi năng lượng và thẻ mèo; gom 6 lõi để quay Super.",
    en: "A robot-and-space coin machine: time your shots for tickets, coin rains, energy cores and cat cards; collect six cores for the Super spin.",
  },
  description: {
    vi: "Một cỗ máy xu trong khu trò chơi giữa không gian: bấm BẮN để phóng xu lên vòng quay, ô nào đối diện ống bắn lúc xu chạm tới thì ăn ô đó. Ô vé cộng vé ngay; ô xu làm 1 đến 8 xu rơi rải khắp kệ; ô lõi thả một viên lõi năng lượng xuống kệ và cho một lượt Mini Spin (vé hoặc xu); ô thẻ thả một thẻ mèo xuống kệ. Thanh đẩy dồn mọi thứ ra mép: xu rơi mép trước quay về tay bạn kèm vé, rơi hai bên là mất. Đẩy được 6 viên lõi rơi mép trước để quay Super Spin tới 500 vé. Mỗi thẻ mèo rơi mép trước được 60 vé và vào bộ sưu tập; đủ 10 giống mèo được thêm 1000 vé. Bộ sưu tập được giữ qua các lượt. Bản thử nghiệm: mỗi lượt có 200 xu, hết xu là tính tổng vé.",
    en: "A coin machine in a space-age arcade: press SHOOT to launch a coin up the chute at the prize wheel, and whatever slot faces the chute when it lands pays out. Ticket slots pay at once; coin slots rain 1 to 8 coins across the shelf; the core slot drops an energy core onto the shelf and gives a Mini spin (tickets or coins); the card slot drops a cat card. The pusher shoves everything toward the edge: coins over the front come back to you with a ticket, over the sides they are lost. Push six cores off the front for a Super spin worth up to 500 tickets. Every cat card pushed off the front pays 60 tickets and joins your album; all ten breeds add 1000 more, and the album carries over between runs. Beta: every run starts with 200 coins, and your score is the tickets you collect.",
  },
  controls: {
    vi: [
      "Chạm nút BẮN (hoặc [Space]) để bắn 1 xu; giữ để bắn liên tục.",
      "Canh thời điểm: xu bay khoảng nửa giây mới chạm vòng quay.",
      "[Esc] tạm dừng.",
    ],
    en: [
      "Tap SHOOT (or [Space]) to fire a coin; hold it to keep firing.",
      "Time it: a coin takes about half a second to reach the wheel.",
      "[Esc] pause.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["máy xu", "đẩy xu", "vòng quay", "robot", "vũ trụ", "arcade", "beta"],
    en: ["coin pusher", "coin shooter", "prize wheel", "robots", "space", "arcade", "beta"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-08T15:00",
  coupons: { kinds: ["coins"] },
  inspiredBy: {
    vi: "Máy đổi vé bắn xu và đẩy xu trong khu trò chơi",
    en: "Coin-shooter and coin-pusher redemption arcade machines",
  },
};

export default manifest;
