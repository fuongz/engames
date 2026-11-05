import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "meo-vu-tru",
  title: { vi: "Mèo Vũ Trụ", en: "Cosmic Cats" },
  tagline: {
    vi: "Mèo ngoài hành tinh trộm cá của Trái Đất! Lái tên lửa, bắn tan từng đợt mèo bay.",
    en: "Alien cats are stealing Earth's fish! Fly your rocket and blast them wave after wave.",
  },
  description: {
    vi: "Một bầy mèo ngoài hành tinh ngồi đĩa bay bong bóng kéo đến hút sạch cá của Trái Đất. Kéo ngón tay để lái tên lửa, súng tự bắn. Nhặt hộp cá màu để đổi súng: đỏ là đạn tỏa, xanh dương là tia laser xuyên thấu, xanh lá là sét chuỗi giật lan. Cùng màu thì súng lên cấp, tối đa cấp 10; quả cầu năng lượng cũng tăng một cấp. Cá khô rơi ra đổi được tên lửa dọn sạch màn hình. Ba chương, mỗi chương mười đợt: đội hình lắc lư, mèo bay uốn lượn, robo-mèo cảm tử, mưa rác vũ trụ, đĩa bay khổng lồ, mưa cá thưởng, và một con trùm ở cuối. Qua chương 3 thì vòng lại, khó hơn.",
    en: "A fleet of alien cats in bubble saucers has come to vacuum up Earth's fish. Drag to steer your rocket; it fires on its own. Catch coloured fish cans to change guns: red is a spread shot, blue a piercing laser, green a chain bolt that jumps between cats. The same colour powers your gun up, to level 10, and so do energy orbs. Dried fish add up to missiles that clear the whole screen. Three chapters of ten waves each: swaying formations, looping conga lines, kamikaze robo-kittens, space-junk storms, a giant saucer, a fish-rain bonus and a boss at the end. After chapter 3 it loops, tougher.",
  },
  controls: {
    vi: [
      "Kéo ngón tay ở bất kỳ đâu để lái tên lửa; súng tự bắn.",
      "Máy tính: phím mũi tên / [W][A][S][D], hoặc di chuột.",
      "Chạm nút tên lửa (hoặc [Space]) để dọn sạch đạn và quái trên màn hình.",
      "Hộp cá đỏ / xanh dương / xanh lá đổi súng; cùng màu thì lên cấp.",
      "[P] hoặc [Esc] để tạm dừng.",
    ],
    en: [
      "Drag anywhere to steer the rocket; it fires on its own.",
      "Keyboard: arrow keys / [W][A][S][D], or move the mouse.",
      "Tap the missile button (or [Space]) to wipe out bullets and cats on screen.",
      "Red / blue / green fish cans change your gun; the same colour powers it up.",
      "[P] or [Esc] to pause.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["bắn máy bay", "không gian", "mèo", "arcade"],
    en: ["shoot 'em up", "space", "cats", "arcade"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-05T09:00",
  inspiredBy: {
    vi: "dòng game bắn quái vũ trụ theo đợt kinh điển (space invaders)",
    en: "the classic arcade space-invaders wave-shooter genre",
  },
};

export default manifest;
