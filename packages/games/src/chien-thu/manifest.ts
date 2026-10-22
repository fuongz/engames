import type { GameManifest } from "../core/types";
import { H, W } from "./config";
import banner from "./banner.webp";
import poster from "./poster.webp";

const manifest: GameManifest = {
  slug: "chien-thu",
  title: "Chiến Thú Hỗn Chiến",
  tagline: "Ghép thú, tiến hóa, chặn đàn zombie đi vòng!",
  description:
    "Zombie kéo nhau đi vòng quanh bãi cát để tấn công cậu bé. Ấp trứng để gọi Chiến Thú, đặt chúng sát mép vòng để lưỡi kiếm xoay chém trúng zombie. Kéo 2 thú cùng cấp chồng lên nhau để ghép, đủ cấp sẽ tiến hóa thành loài mới mạnh hơn.",
  controls: [
    "Bấm ẤP TRỨNG để gọi thú cấp 1 (tốn trứng 🥚).",
    "Kéo thả thú: ô trống thì di chuyển, cùng cấp thì ghép, khác cấp thì đổi chỗ.",
    "Thú ở mép vòng mới chém tới zombie, thú cấp cao chém xa hơn.",
    "Hạ zombie và đập trứng hoang trên đường để kiếm thêm trứng.",
  ],
  category: "chien-thuat",
  tags: ["ghép thú", "thủ thành", "merge", "zombie"],
  poster,
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-22",
  inspiredBy: "Clash of Critters (Chiến Thú Hỗn Chiến) playable ad",
};

export default manifest;
