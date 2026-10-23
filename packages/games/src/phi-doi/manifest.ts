import type { GameManifest } from "../core/types";
import banner from "./banner.webp";
import { H, W } from "./config";
import poster from "./poster.webp";

const manifest: GameManifest = {
  slug: "phi-doi",
  title: "Phi Đội 1945",
  tagline:
    "Một phi đội, cả bầu trời Thái Bình Dương. Né đạn và đánh chìm chiến hạm!",
  description:
    "Bắn máy bay kiểu 1942 trên màn hình dọc. Máy bay cánh vàng cùng hai máy bay hộ tống tự động nhả đạn, việc của bạn là kéo ngón tay để luồn qua làn đạn đỏ. Hạ trọn một tốp tiêm kích để nhận thùng P tăng hỏa lực, nhặt xu, tích đầy nút xanh để bắn dồn, và giữ bom cho lúc bị dồn vào góc. Hết mỗi màn là một chiến hạm khổng lồ với những chuỗi đạn và tên lửa rơi từ trên xuống.",
  controls: [
    "Kéo ngón tay ở bất kỳ đâu: máy bay đi theo hướng kéo, ngón tay không che máy bay. Máy tính: WASD hoặc phím mũi tên.",
    "Đạn bắn tự động. Hạ hết cả một tốp máy bay xanh để nhận thùng P (tăng hỏa lực, tối đa 5 cấp).",
    "Nút xanh (hoặc J) đầy khi hạ đủ địch: 5 giây bắn dồn, nhiều tia hơn.",
    "Nút bom (hoặc Space) xóa toàn bộ đạn địch và gây sát thương cả màn hình.",
    "Tên lửa của chiến hạm bắn hạ được. Hết máu là kết thúc; điểm xếp hạng là tổng điểm.",
  ],
  category: "hanh-dong",
  tags: ["bắn máy bay", "shoot 'em up", "1942", "boss"],
  poster,
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-23T12:00",
  inspiredBy:
    "1945 Air Force: Airplane Shooter (quảng cáo TikTok, bản quay màn hình người dùng gửi)",
};

export default manifest;
