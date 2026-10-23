import type { GameManifest } from "../core/types";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";

const manifest: GameManifest = {
  slug: "phi-doi",
  title: { vi: "Phi Đội 1945", en: "Squadron 1945" },
  tagline: {
    vi: "Một phi đội, cả bầu trời Thái Bình Dương. Né đạn và đánh chìm chiến hạm!",
    en: "One squadron, the whole Pacific sky. Dodge the fire and sink the battleship!",
  },
  description: {
    vi: "Bắn máy bay kiểu 1942 trên màn hình dọc. Máy bay cánh vàng cùng hai máy bay hộ tống tự động nhả đạn, việc của bạn là kéo ngón tay để luồn qua làn đạn đỏ. Hạ trọn một tốp tiêm kích để nhận thùng P tăng hỏa lực, nhặt xu, tích đầy nút xanh để bắn dồn, và giữ bom cho lúc bị dồn vào góc. Hết mỗi màn là một chiến hạm khổng lồ với những chuỗi đạn và tên lửa rơi từ trên xuống.",
    en: "A 1942-style vertical shooter. Your yellow-winged fighter and two wingmen fire on their own; your job is to drag through the red bullet streams. Wipe out a whole fighter formation for a P crate that boosts your firepower, grab coins, fill the green button for a burst of rapid fire, and save your bombs for when you're cornered. Every stage ends with a giant battleship firing bead chains and dropping missiles from above.",
  },
  controls: {
    vi: [
      "Kéo ngón tay ở bất kỳ đâu: máy bay đi theo hướng kéo, ngón tay không che máy bay. Máy tính: WASD hoặc phím mũi tên.",
      "Đạn bắn tự động. Hạ hết cả một tốp máy bay xanh để nhận thùng P (tăng hỏa lực, tối đa 5 cấp).",
      "Nút xanh (hoặc J) đầy khi hạ đủ địch: 5 giây bắn dồn, nhiều tia hơn.",
      "Nút bom (hoặc Space) xóa toàn bộ đạn địch và gây sát thương cả màn hình.",
      "Tên lửa của chiến hạm bắn hạ được. Hết máu là kết thúc; điểm xếp hạng là tổng điểm.",
    ],
    en: [
      "Drag anywhere: the plane follows your finger's movement, so your finger never covers it. Desktop: WASD or arrow keys.",
      "Firing is automatic. Shoot down an entire green formation for a P crate (more firepower, up to level 5).",
      "The green button (or J) fills as you score kills: 5 seconds of rapid fire with extra streams.",
      "The bomb button (or Space) clears every enemy bullet and damages the whole screen.",
      "The battleship's missiles can be shot down. The run ends when your HP runs out; your leaderboard score is your total points.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["bắn máy bay", "shoot 'em up", "1942", "boss"],
    en: ["plane shooter", "shoot 'em up", "1942", "boss"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-23T12:00",
  inspiredBy: {
    vi: "1945 Air Force: Airplane Shooter (quảng cáo TikTok, bản quay màn hình người dùng gửi)",
    en: "1945 Air Force: Airplane Shooter (a TikTok ad, from a screen recording a player sent in)",
  },
};

export default manifest;
