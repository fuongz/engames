import type { GameManifest } from "../core/types";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";

const manifest: GameManifest = {
  slug: "hanh-trinh",
  title: { vi: "Hành Trình Anh Hùng", en: "Hero's Journey" },
  tagline: {
    vi: "Một mình một gậy chặn cả đoàn quân đỏ. Nâng cấp kịp không?",
    en: "One hero, one club, a whole red army. Can you upgrade in time?",
  },
  description: {
    vi: "Anh hùng tự động đánh con quái đứng đầu hàng, hạ được con nào thì cả hàng bước lên và vàng rơi ra. Dùng vàng nâng cấp vũ khí (gậy, rìu, kiếm…) để đánh mạnh hơn và khiên để thêm máu, chặn đòn. Cung thủ bắn tên từ phía sau, lính mũ sắt rất trâu, cứ 20 quái lại có một Tù trưởng. Trụ được bao nhiêu quái?",
    en: "Your hero auto-attacks the foe at the front of the line; each kill drops gold and the whole line steps up. Spend gold on weapons (club, axe, sword…) to hit harder and on shields for more HP and a chance to block. Archers shoot from the back, helmet guards are tanky, and every 20th foe is a Chief. How many can you hold off?",
  },
  controls: {
    vi: [
      "Anh hùng tự đánh, bạn chỉ cần chọn lúc nâng cấp.",
      "Nút trái: vũ khí mới, tăng sát thương. Nút phải: khiên, thêm máu tối đa, hồi máu ngay và có tỉ lệ chặn đòn.",
      "Nút sáng lên khi đủ vàng. Mỗi con quái hạ được hồi một chút máu.",
      "Chí mạng gây gấp đôi sát thương (số vàng có lửa). Điểm xếp hạng là số quái hạ được.",
    ],
    en: [
      "Your hero fights on their own; you just pick when to upgrade.",
      "Left button: a new weapon for more damage. Right button: a shield for more max HP, an instant heal and a chance to block.",
      "A button lights up when you have enough gold. Every kill heals you a little.",
      "Crits deal double damage (yellow number with a flame). Your leaderboard score is your kill count.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["idle", "nhập vai", "nâng cấp", "chặn quái"],
    en: ["idle", "RPG", "upgrades", "hold the line"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-23",
  inspiredBy: {
    vi: "Epic Idle Journey: RPG Battle (FreePlay Studio) playable ad",
    en: "Epic Idle Journey: RPG Battle (FreePlay Studio) playable ad",
  },
};

export default manifest;
