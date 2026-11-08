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
    vi: "Máy bắn xu robot & vũ trụ: canh vòng quay ăn vé, đẩy 6 lõi năng lượng rơi khỏi kệ để nổ Super Bonus.",
    en: "A robot-and-space coin machine: time your shots at the prize wheel and push six energy cores off the shelf for the Super Bonus.",
  },
  description: {
    vi: "Một cỗ máy xu trong khu trò chơi giữa không gian: bấm BẮN để phóng xu lên vòng quay, ô nào đối diện ống bắn lúc xu chạm tới thì ăn ô đó — vé, LÕI năng lượng hay BONUS. Xu rơi xuống kệ, thanh đẩy dồn cả đống xu ra mép: rơi mép trước thì xu quay về tay bạn kèm vé, rơi hai bên là mất. Sáu viên lõi năng lượng nằm trên kệ; đẩy được một viên ra mép trước là lõi sáng và được một lượt Bonus Spin (10 đến 100 vé). Sáng đủ cả sáu lõi: SUPER BONUS 250 vé và một trận mưa xu. Bản thử nghiệm: mỗi lượt có 200 xu, hết xu là tính tổng vé.",
    en: "A coin machine in a space-age arcade: press SHOOT to launch a coin up the chute at the prize wheel, and whatever slot faces the chute when it lands pays out — tickets, an energy CORE or BONUS. The coin drops onto the shelf, where the pusher shoves the pile toward the edge: coins over the front come back to you with a ticket, coins over the sides are lost. Six energy cores sit on the shelf; push one off the front to light it and win a Bonus Spin (10 to 100 tickets). Light all six for the SUPER BONUS: 250 tickets and a shower of coins. Beta: every run starts with 200 coins, and your score is the tickets you collect.",
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
  inspiredBy: {
    vi: "Máy đổi vé bắn xu và đẩy xu trong khu trò chơi",
    en: "Coin-shooter and coin-pusher redemption arcade machines",
  },
};

export default manifest;
