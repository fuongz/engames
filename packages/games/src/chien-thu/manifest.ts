import type { GameManifest } from "../core";
import { H, W } from "./config";
import banner from "./banner.webp";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";

const manifest: GameManifest = {
  slug: "chien-thu",
  title: { vi: "Chiến Thú Hỗn Chiến", en: "Critter Brawl" },
  tagline: {
    vi: "Ghép thú, tiến hóa, chặn đàn zombie đi vòng!",
    en: "Merge critters, evolve them, stop the zombie horde!",
  },
  description: {
    vi: "Zombie kéo nhau đi vòng quanh bãi cát để tấn công cậu bé. Ấp trứng để gọi Chiến Thú, đặt chúng sát mép vòng để lưỡi kiếm xoay chém trúng zombie. Kéo 2 thú cùng cấp chồng lên nhau để ghép, đủ cấp sẽ tiến hóa thành loài mới mạnh hơn.",
    en: "Zombies march around the sand ring to reach the kid. Hatch eggs to summon battle critters and place them near the edge of the field so their spinning blades slash the passing zombies. Drag two critters of the same level together to merge them; at certain levels they evolve into a new, stronger species.",
  },
  controls: {
    vi: [
      "Bấm ẤP TRỨNG để gọi thú cấp 1 (tốn trứng 🥚).",
      "Kéo thả thú: ô trống thì di chuyển, cùng cấp thì ghép, khác cấp thì đổi chỗ.",
      "Thú ở mép vòng mới chém tới zombie, thú cấp cao chém xa hơn.",
      "Hạ zombie và đập trứng hoang trên đường để kiếm thêm trứng.",
    ],
    en: [
      "Tap HATCH to summon a level 1 critter (costs eggs 🥚).",
      "Drag a critter: onto an empty slot to move, onto the same level to merge, onto a different level to swap.",
      "Only critters near the edge reach the zombies; higher levels reach further.",
      "Defeat zombies and smash wild eggs on the path to earn more eggs.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["ghép thú", "thủ thành", "merge", "zombie"],
    en: ["merge", "tower defense", "critters", "zombie"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-22",
  inspiredBy: {
    vi: "Clash of Critters (Chiến Thú Hỗn Chiến) playable ad",
    en: "Clash of Critters playable ad",
  },
};

export default manifest;
