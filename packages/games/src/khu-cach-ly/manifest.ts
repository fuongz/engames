import type { GameManifest } from "@web-games/core";
import { H, W } from "./config";
import posterVi from "./poster.webp";
import posterEn from "./poster-en.webp";
import banner from "./banner.webp";
import share from "./share.jpg";
const manifest: GameManifest = {
  slug: "khu-cach-ly",
  title: { vi: "Khu Cách Ly", en: "Quarantine" },
  tagline: {
    vi: "Một người lính. Một căn cứ bị nuốt chửng. Đừng để mất tín hiệu.",
    en: "One marine. An overrun station. Keep the signal alive.",
  },
  description: {
    vi: "Bắn quái góc nhìn từ trên xuống lấy cảm hứng từ Alien Shooter. Luồn qua hành lang căn cứ, giữ khoảng cách với đàn sinh vật và để súng tự ngắm bắn. Hạ quái để mở súng chùm và plasma, nhặt túi cứu thương, tích xung nổ để thoát vòng vây. Mỗi năm đợt xuất hiện một quái đầu đàn; sống sót càng lâu, căn cứ càng nguy hiểm.",
    en: "A top-down survival shooter inspired by Alien Shooter. Weave through station corridors and keep your distance as your weapon automatically targets visible creatures. Unlock the shotgun and plasma rifle, collect medkits and charge a pulse to break out of a swarm. Every fifth wave brings a hive lord; the longer you survive, the more dangerous the station becomes.",
  },
  controls: {
    vi: [
      "Kéo ở vùng chơi để di chuyển. Máy tính: [WASD] hoặc phím mũi tên.",
      "Súng tự ngắm và bắn quái trong tầm nhìn; tường chặn cả đạn lẫn quái.",
      "Chạm ô súng hoặc [1], [2], [3] để đổi súng. Súng chùm mở ở 25 quái, plasma ở 70 quái.",
      "Chạm Xung nổ hoặc [Space] khi đầy năng lượng để đánh bật vòng vây. Hạ quái để nạp lại.",
      "Nhặt túi cứu thương để hồi 30 máu. [P] tạm dừng, [Enter] bắt đầu hoặc tiếp tục.",
    ],
    en: [
      "Drag in the play area to move. Desktop: [WASD] or arrow keys.",
      "Weapons automatically target and fire at visible enemies; walls block shots and creatures.",
      "Tap a weapon or press [1], [2], [3]. Shotgun unlocks at 25 kills, plasma at 70.",
      "Tap Pulse or press [Space] with a full charge to break out of a swarm. Kills recharge it.",
      "Medkits restore 30 HP. [P] pauses; [Enter] starts or resumes.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["bắn quái", "sinh tồn", "alien shooter", "boss"],
    en: ["shooter", "survival", "alien shooter", "boss"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-06T12:00",
  inspiredBy: {
    vi: "Alien Shooter và video quảng cáo bắn quái do người chơi cung cấp",
    en: "Alien Shooter and a player-supplied horde-shooter advertisement",
  },
};
export default manifest;
