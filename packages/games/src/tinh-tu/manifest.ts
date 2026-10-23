import type { GameManifest } from "../core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "tinh-tu",
  title: { vi: "Tinh Tú Phi Hành", en: "Starlight Flight" },
  tagline: {
    vi: "Cưỡi kiếm bay giữa dải ngân hà, bắn hạ thiên thạch và đánh bại Hắc Diệm Long!",
    en: "Ride a flying blade through the galaxy, blast meteors and defeat the Black Flame Dragon!",
  },
  description: {
    vi: "Màn chơi 60 giây giữa vũ trụ: phi thuyền bóng tối, thiên thạch lửa và đá tinh thể tím lao tới không ngừng. Đạn bắn tự động, việc của bạn là né và nhặt bong bóng nâng cấp. Tích Năng Lượng Tinh Tú để tung Tinh Tú Quang Pháo, rồi hạ Hắc Diệm Long ở giây thứ 40 để lấy đủ 10 mảnh tinh tú.",
    en: "A 60-second run through space: shadow fighters, flaming meteors and purple crystal rocks keep coming. You fire automatically, so your job is to dodge and grab upgrade bubbles. Build up Star Energy to unleash the Starlight Cannon, then take down the Black Flame Dragon at the 40-second mark to collect all 10 star shards.",
  },
  controls: {
    vi: [
      "Chơi ở màn hình ngang. Kéo joystick bên trái (hoặc [WASD] / phím mũi tên) để bay.",
      "Đạn bắn tự động. Bong bóng xanh nâng cấp đạn xuyên hoặc tăng số tia đạn.",
      "Hạ địch để nạp vòng năng lượng; đủ vòng là có một lần dùng chiêu.",
      "Bấm nút cam bên phải (hoặc [Space]) để tung Tinh Tú Quang Pháo. Nên để dành cho boss!",
      "3 sao: sống tới hết giờ, hạ boss, và không mất tim nào.",
    ],
    en: [
      "Play in landscape. Drag the joystick on the left (or [WASD] / arrow keys) to fly.",
      "You fire automatically. Blue bubbles give piercing shots or extra bullet streams.",
      "Defeat enemies to fill the energy ring; a full ring is one skill charge.",
      "Tap the orange button on the right (or [Space]) to fire the Starlight Cannon. Save it for the boss!",
      "3 stars: survive to the end, beat the boss, and lose no hearts.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["bắn máy bay", "shoot 'em up", "vũ trụ", "boss"],
    en: ["shooter", "shoot 'em up", "space", "boss"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  orientation: "landscape",
  width: W,
  height: H,
  releasedAt: "2026-10-22T12:00",
  inspiredBy: {
    vi: "Mini game bắn tinh tú (bản quay màn hình người dùng gửi)",
    en: "A star-shooting mini game (from a screen recording a player sent in)",
  },
};

export default manifest;
