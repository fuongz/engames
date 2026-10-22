import type { GameManifest } from "../core/types";
import banner from "./banner.webp";
import { H, W } from "./config";
import poster from "./poster.webp";

const manifest: GameManifest = {
  slug: "tinh-tu",
  title: "Tinh Tú Phi Hành",
  tagline: "Cưỡi kiếm bay giữa dải ngân hà, bắn hạ thiên thạch và đánh bại Hắc Diệm Long!",
  description:
    "Màn chơi 60 giây giữa vũ trụ: phi thuyền bóng tối, thiên thạch lửa và đá tinh thể tím lao tới không ngừng. Đạn bắn tự động, việc của bạn là né và nhặt bong bóng nâng cấp. Tích Năng Lượng Tinh Tú để tung Tinh Tú Quang Pháo, rồi hạ Hắc Diệm Long ở giây thứ 40 để lấy đủ 10 mảnh tinh tú.",
  controls: [
    "Chơi ở màn hình ngang. Kéo joystick bên trái (hoặc WASD / phím mũi tên) để bay.",
    "Đạn bắn tự động. Bong bóng xanh nâng cấp đạn xuyên hoặc tăng số tia đạn.",
    "Hạ địch để nạp vòng năng lượng; đủ vòng là có một lần dùng chiêu.",
    "Bấm nút cam bên phải (hoặc Space) để tung Tinh Tú Quang Pháo. Nên để dành cho boss!",
    "3 sao: sống tới hết giờ, hạ boss, và không mất tim nào.",
  ],
  category: "hanh-dong",
  tags: ["bắn máy bay", "shoot 'em up", "vũ trụ", "boss"],
  poster,
  banner,
  orientation: "landscape",
  width: W,
  height: H,
  releasedAt: "2026-10-22T12:00",
  inspiredBy: "Mini game bắn tinh tú (bản quay màn hình người dùng gửi)",
};

export default manifest;
