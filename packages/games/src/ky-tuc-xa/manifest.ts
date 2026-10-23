import type { GameManifest } from "../core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "ky-tuc-xa",
  title: { vi: "Ký Túc Xá Đêm", en: "Night Dorm" },
  tagline: {
    vi: "Còn 30 giây để lên giường. Ngủ kiếm xu, xây tháp, giữ cửa trước Thợ Săn Giấc Mơ!",
    en: "30 seconds to get into bed. Sleep for gold, build turrets, hold the door against the Dream Hunter!",
  },
  description: {
    vi: "Đồng hồ đỏ bắt đầu đếm ngược: chạy vào một phòng trống và lên giường trước khi hết giờ, nhưng đừng giành phòng đã có người. Ngủ để kiếm Xu Vàng, nâng cấp giường cho thu nhập cao hơn, xây Tháp Chói cạnh cửa và nâng cấp cửa. Khi Thợ Săn Giấc Mơ xuất hiện, nó lần lượt phá cửa từng phòng, mạnh dần theo thời gian và rút về sảnh hồi máu khi yếu. Sau ba lần rút lui nó nổi điên. Hạ gục nó trước khi cửa phòng bạn vỡ.",
    en: "The red countdown starts: run into an empty room and get into bed before time runs out, but don't take a room that's already taken. Sleep to earn Gold, upgrade your bed for more income, build Glare Turrets by the door and reinforce the door itself. When the Dream Hunter arrives it breaks down doors one by one, grows stronger over time and retreats to the hall to heal when it's hurt. After three retreats it goes berserk. Take it down before your door gives way.",
  },
  controls: {
    vi: [
      "Trong 30 giây đầu, chạm vào một phòng để chạy tới giường. Phòng có người thì phải chọn phòng khác.",
      "Đã lên giường: chạm ô trống để mở Kiến Trúc, chạm giường hoặc cửa để nâng cấp, chạm tháp để nâng cấp tháp.",
      "Tháp chỉ bắn khi Thợ Săn ở trong tầm, nên xây sát cửa. Máy Chơi Game tạo ⚡ để xây đồ ở Xưởng.",
      "Cửa bị đánh thì bấm Sửa (hoặc phím [R]), có thời gian hồi.",
      "Thắng khi hạ được Thợ Săn; thua khi cửa phòng bạn vỡ. Điểm là xu kiếm được, thời gian sống và thưởng hạ Thợ Săn.",
    ],
    en: [
      "In the first 30 seconds, tap a room to run to its bed. If it's taken, pick another.",
      "Once in bed: tap an empty tile to open Build, tap your bed or door to upgrade it, tap a turret to upgrade it.",
      "Turrets only fire when the Hunter is in range, so build them by the door. Arcade Machines make ⚡ for Workshop builds.",
      "When your door is under attack, press Repair (or [R]); it has a cooldown.",
      "You win by taking the Hunter down and lose when your door breaks. Score is gold earned, time survived and a bonus for the kill.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["thủ thành", "kinh dị", "xây tháp", "sinh tồn"],
    en: ["tower defense", "horror", "base building", "survival"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  online: { modes: ["coop"], minPlayers: 1, maxPlayers: 6 },
  releasedAt: "2026-10-23T15:00",
  inspiredBy: {
    vi: "Haunted Dorm (Mihuan Games), quảng cáo TikTok người dùng quay màn hình",
    en: "Haunted Dorm (Mihuan Games), a TikTok ad from a screen recording a player sent in",
  },
};

export default manifest;
