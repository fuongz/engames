import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { DAILY_COINS, H, VERSION, W, WELCOME_COINS } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "xu-vu-tru",
  title: { vi: "Xu Vũ Trụ", en: "Cosmo Coins" },
  tagline: {
    vi: "Máy bắn xu robot & vũ trụ: canh xu rơi vào lỗ đang lắc để quay thưởng vé, mưa xu, lõi năng lượng và thẻ mèo; gom 6 lõi để quay Super.",
    en: "A robot-and-space coin machine: time your coin into the swinging hole for prize spins of tickets, coin rains, energy cores and cat cards; collect six cores for the Super spin.",
  },
  description: {
    vi: "Một cỗ máy xu trong khu trò chơi giữa không gian: bấm BẮN để phóng xu lên vòng đích dưới vòng quay. Một cái lỗ lắc qua lại và sáng xanh khi tới lúc bấm: xu rơi vào lỗ thì được một lượt quay thưởng, trượt thì xu nảy ra rơi xuống kệ. Khi quay, đèn chạy quanh vòng rồi dừng ở một ô (ô càng rộng càng dễ trúng): ô vé cộng vé ngay; ô xu làm 1 đến 8 xu rơi rải khắp kệ; ô lõi thả một viên lõi năng lượng xuống kệ và cho một lượt Mini Spin (vé hoặc xu); ô thẻ thả một thẻ mèo xuống kệ (mèo Ragdoll hiếm hơn). Tối đa 4 lượt quay chờ, nên bắn có nhịp. Thanh đẩy dồn mọi thứ ra mép trước: xu rơi xuống quay về tay bạn kèm vé, hai bên có vách chắn. Đẩy được 6 viên lõi rơi mép trước để quay Super Spin tới 500 vé. Thẻ mèo rơi mép trước vào kho thẻ, thẻ trùng cộng dồn; bạn tự chọn lúc đổi 1 thẻ hoặc cả bộ 10 giống lấy vé hay xu. Máy chạy liên tục: hết xu thì máy nghỉ, kệ xu, lõi và kho thẻ vẫn giữ nguyên chờ bạn quay lại. Đăng nhập để nhận 100 xu chào mừng, rồi 50 xu mỗi ngày; máy được lưu vào tài khoản, và vé thắng được vào ví vé dùng chung của mọi game thùng. Bảng xếp hạng tính tổng vé máy đã trả. Chưa đăng nhập thì chơi máy thử 100 xu trên thiết bị này.",
    en: "A coin machine in a space-age arcade: press SHOOT to launch a coin up the chute onto the target ring under the prize wheel. A hole swings side to side and glows green when it's time to shoot: a coin in the hole wins a prize spin, a miss bounces down onto the shelf. On a spin a light races round the wheel and stops on a slot (the wider the slot, the likelier): ticket slots pay at once; coin slots rain 1 to 8 coins across the shelf; the core slot drops an energy core onto the shelf and gives a Mini spin (tickets or coins); the card slot drops a cat card (the Ragdoll is rare). Up to four spins can wait their turn, so pace your shots. The pusher shoves everything toward the front edge, where coins come back to you with a ticket; walls guard the sides. Push six cores off the front for a Super spin worth up to 500 tickets. Cat cards pushed off the front go into your card stash, duplicates stacking; you choose when to exchange one card or a full set of all ten breeds for tickets or coins. The machine never resets: out of coins it rests, keeping its shelf, cores and cards until you come back. Sign in for 100 welcome coins and then 50 coins a day; your machine is saved to your account, and the tickets you win go to the ticket wallet every arcade game shares. The leaderboard ranks the tickets your machine has paid. Signed out, you play a 100-coin trial machine on this device.",
  },
  controls: {
    vi: [
      "Chạm nút BẮN (hoặc [Space]) để bắn 1 xu; giữ để bắn liên tục.",
      "Bấm BẮN khi lỗ sáng xanh là xu rơi trúng lỗ.",
      "[Esc] tạm dừng.",
    ],
    en: [
      "Tap SHOOT (or [Space]) to fire a coin; hold it to keep firing.",
      "Press SHOOT when the hole glows green and the coin drops right in.",
      "[Esc] pause.",
    ],
  },
  category: "arcade",
  tags: {
    vi: ["máy xu", "đẩy xu", "vòng quay", "robot", "vũ trụ", "arcade"],
    en: ["coin pusher", "coin shooter", "prize wheel", "robots", "space", "arcade"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-11-08T15:00",
  coupons: { kinds: ["coins"] },
  version: VERSION,
  // Signed in: the machine lives on the account (save.ts checks it) and the
  // allowance pays its coins; signed out it is a local trial
  accountSave: true,
  allowance: { kind: "coins", welcome: WELCOME_COINS, daily: DAILY_COINS },
  tickets: true,
  inspiredBy: {
    vi: "Máy đổi vé bắn xu và đẩy xu trong khu trò chơi",
    en: "Coin-shooter and coin-pusher redemption arcade machines",
  },
};

export default manifest;
