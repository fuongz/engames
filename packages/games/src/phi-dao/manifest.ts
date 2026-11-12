import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { COSMETICS, H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "phi-dao",
  title: { vi: "Phi Dao", en: "Knife Bloom" },
  tagline: {
    vi: "Canh nhịp bia quay, phóng dao cùng bạn giữa vườn cam đêm.",
    en: "Time your throws and team up in a moonlit orange orchard.",
  },
  description: {
    vi: "Phóng hết số dao vào bia quay mà không chạm dao đã cắm. Cùng vượt 15 màn trong 3 phút với 3 mạng; mỗi màn thứ 5 là bia cam đặc biệt. Chơi một mình, phối hợp hai người trên cùng máy, hoặc mời bạn vào phòng bằng QR. Hai người dùng chung bia, mạng và điểm, nên hãy canh nhịp cùng nhau! Chế độ cùng máy hiển thị điểm chung; bảng xếp hạng cá nhân chỉ nhận ván chơi đơn.",
    en: "Land every knife on the rotating target without hitting another blade. Clear 15 stages in three minutes with three lives; every fifth stage brings a special orange target. Play solo, team up on one device, or invite a friend by QR. Two players share a target, lives and score, so coordinate your throws! Same-device play shows a shared score; only solo runs enter the solo leaderboard.",
  },
  controls: {
    vi: [
      "Chơi đơn / online: chạm màn hình hoặc [Space] để phóng dao.",
      "Cùng máy: người 1 chạm bên trái / [A]; người 2 chạm bên phải / [L].",
      "Co-op QR: chọn Chơi co-op online, tạo phòng và chia sẻ mã QR cho bạn.",
      "Mở Xưởng dao bằng [B]. Dao Cổ điển miễn phí; Rồng sét cần mua bằng 2.000 vé trước khi trang bị.",
    ],
    en: [
      "Solo / online: tap the screen or press [Space] to throw.",
      "Same device: player 1 taps the left / [A]; player 2 taps the right / [L].",
      "QR co-op: select Play online co-op, create a room and share its QR code.",
      "Open the workshop with [B]. Classic is free; buy Storm Dragon for 2,000 tickets before equipping it.",
    ],
  },
  category: "arcade",
  cosmetics: COSMETICS,
  tags: {
    vi: ["phi dao", "một chạm", "2 người", "co-op", "QR"],
    en: ["knife", "one tap", "2 players", "co-op", "QR"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-12",
  version: "1.0.0",
  online: { modes: ["coop"], minPlayers: 1, maxPlayers: 2 },
  changelog: [
    {
      version: "1.0.0",
      date: "2026-11-12",
      changes: {
        vi: [
          "Thêm Phi Dao với 15 màn, bia cam đặc biệt và hình nền vườn cam đêm.",
          "Thêm chơi đơn, phối hợp hai người cùng máy và co-op QR tối đa hai người.",
          "Thêm dao bay nhanh và phóng liên tiếp với thời gian chờ ngắn.",
          "Thêm dao Cổ điển cán đen-vàng miễn phí và Rồng sét tím giá 2.000 vé trong Xưởng dao.",
          "Lưu dao đã mua và dao đang dùng theo tài khoản; mua một lần, dùng lại trong chơi đơn và co-op.",
          "Thêm vệt bay, rung khi cắm và bật rơi khi va chạm; Rồng sét có luồng điện trên lưỡi, dư ảnh sét và hoạt ảnh va chạm 16 khung hình.",
        ],
        en: [
          "Added Knife Bloom with 15 stages, special orange targets and a moonlit orchard.",
          "Added solo, same-device teamwork and QR co-op for up to two players.",
          "Added fast-flying knives and rapid throws with a short cooldown.",
          "Added the free black-and-gold Classic knife and Storm Dragon for 2,000 tickets in the workshop.",
          "Saved purchased and equipped knives to the account; buy once and use them in solo and co-op.",
          "Added flight trails, impact wobble and bouncing misses; Storm Dragon adds a live blade current, lightning afterimages and a 16-frame animated impact.",
        ],
      },
    },
  ],
  inspiredBy: {
    vi: "Thể loại phóng dao vào bia quay trong video tham khảo.",
    en: "The rotating-target knife throwing genre in the reference video.",
  },
};
export default manifest;
