import type { GameManifest } from "../core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "vo-dai",
  title: { vi: "Võ Đài Hoá Thú", en: "Beastform Fighters" },
  tagline: {
    vi: "Đấu tay đôi, nối combo, rồi hoá thú để lật kèo!",
    en: "One-on-one fights, chained combos, and a beast inside to turn the tide!",
  },
  description: {
    vi: "Chọn Khang (Hổ), Linh (Sói) hoặc Tấn (Gấu) và leo võ đài qua ba trận, mỗi trận thắng 2 hiệp. Đấm, đá, nối combo, tung chiêu đặc biệt bằng chuỗi phím. Đánh trúng và trúng đòn đều nạp thanh nộ; đầy thanh thì hoá thú: mạnh hơn, nhanh hơn, hồi máu và có chiêu Cuồng Nộ. Hạ gục đối thủ ở hiệp quyết định rồi nhập ↓↓ + Thú để kết liễu.",
    en: "Pick Khang (Tiger), Linh (Wolf) or Tấn (Bear) and climb the ring through three fights, best of three rounds each. Punch, kick, chain combos and throw specials with motion inputs. Landing and taking hits fills your beast meter; when it is full, transform: stronger, faster, healing, with a Frenzy attack. Win the deciding round, then enter ↓↓ + Beast for the finisher.",
  },
  controls: {
    vi: [
      "Chơi ở màn hình ngang. Joystick (hoặc [WASD] / mũi tên) để đi, nhảy [↑], ngồi [↓].",
      "Giữ hướng ngược đối thủ để đỡ. Ngồi đỡ đòn thấp, đứng đỡ đòn nhảy từ trên xuống.",
      "Đấm [J], Đá [K]. Đấm trúng thì nối được đấm/đá, đòn trúng thì nối được chiêu.",
      "Chiêu [L]: đứng yên, kèm [→] hoặc kèm [←], ra 3 chiêu khác nhau. Trên bàn phím còn có [↓→] + Đấm, [→↓→] + Đấm, [↓←] + Đá.",
      "Đầy thanh nộ, bấm Thú [I] để hoá thú. Khi đã hoá thú, bấm Thú lần nữa để Cuồng Nộ.",
      "Hạ đối thủ ở hiệp quyết định: nhập [↓↓] + Thú trong 2 giây để kết liễu.",
    ],
    en: [
      "Play in landscape. Joystick (or [WASD] / arrows) to walk, jump [↑] and crouch [↓].",
      "Hold away from your opponent to block. Crouch to block lows, stand to block jump-ins.",
      "Punch [J], Kick [K]. A landed punch chains into a punch or kick; a landed hit cancels into a special.",
      "Special [L]: alone, with [→], or with [←] for three different specials. On a keyboard [↓→] + Punch, [→↓→] + Punch and [↓←] + Kick work too.",
      "With a full beast meter, press Beast [I] to transform. Transformed, press Beast again for a Frenzy.",
      "Win the deciding round, then enter [↓↓] + Beast within 2 seconds for the finisher.",
    ],
  },
  category: "hanh-dong",
  tags: {
    vi: ["đối kháng", "võ thuật", "1 đấu 1", "combo"],
    en: ["fighting", "martial arts", "1v1", "combo"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  orientation: "landscape",
  width: W,
  height: H,
  releasedAt: "2026-10-24T10:00",
  inspiredBy: {
    vi: "Bloody Roar (biến hình thú) và Mortal Kombat (chiêu chuỗi phím, đòn kết liễu)",
    en: "Bloody Roar (beast transformations) and Mortal Kombat (motion specials, finishers)",
  },
};

export default manifest;
