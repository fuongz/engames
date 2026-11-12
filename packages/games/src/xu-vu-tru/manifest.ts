import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { changelog } from "./changelog";
import { DAILY_COINS, H, SHOP, STREAK, W, WELCOME_COINS } from "./config";
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
    vi: "Một cỗ máy xu trong khu trò chơi giữa không gian: bấm BẮN để phóng xu lên vòng đích dưới vòng quay. Một cái lỗ lắc qua lại và sáng xanh khi tới lúc bấm: xu rơi vào lỗ thì được một lượt quay thưởng, trượt thì xu nảy ra rơi xuống kệ. Khi quay, đèn chạy quanh vòng rồi dừng ở một ô (ô càng rộng càng dễ trúng): ô vé cộng vé ngay; ô xu làm 2 hoặc 4 xu rơi rải khắp kệ; ô lõi thả một viên lõi năng lượng xuống kệ và cho một lượt Mini Spin (vé hoặc xu); ô thẻ thả một thẻ mèo xuống kệ (mèo Ragdoll hiếm hơn). Tối đa 4 lượt quay chờ; khi đủ 4 lượt, nắp lỗ đóng lại và xu nảy xuống kệ, không mất xu nào. Thanh đẩy dồn mọi thứ ra mép trước: xu rơi xuống quay về tay bạn kèm vé, hai bên có vách chắn; riêng khúc giữa mép trước có hũ robot, xu rơi vào hũ thì máy giữ lại và góp vào Hũ may mắn chung của mọi game thùng. Đẩy được 6 viên lõi rơi mép trước để quay Super Spin tới 500 vé; đã đăng nhập thì mỗi lần Super Spin còn có một cơ hội trúng cả Hũ may mắn. Thẻ mèo rơi mép trước vào kho thẻ, thẻ trùng cộng dồn; bạn tự chọn lúc đổi 1 thẻ hoặc cả bộ 10 giống lấy vé. Máy chạy liên tục: hết xu thì máy nghỉ, kệ xu, lõi và kho thẻ vẫn giữ nguyên chờ bạn quay lại. Đăng nhập để nhận 100 xu chào mừng, rồi xu mỗi ngày tăng dần theo chuỗi ngày đăng nhập (50 đến 150 xu); máy được lưu vào tài khoản, vé thắng được vào ví vé dùng chung của mọi game thùng, và Quầy đổi thưởng đổi vé lấy xu hoặc thẻ mèo. Bảng xếp hạng tuần tính vé kiếm được trong tuần. Chưa đăng nhập thì chơi máy thử 100 xu trên thiết bị này.",
    en: "A coin machine in a space-age arcade: press SHOOT to launch a coin up the chute onto the target ring under the prize wheel. A hole swings side to side and glows green when it's time to shoot: a coin in the hole wins a prize spin, a miss bounces down onto the shelf. On a spin a light races round the wheel and stops on a slot (the wider the slot, the likelier): ticket slots pay at once; coin slots rain 2 or 4 coins across the shelf; the core slot drops an energy core onto the shelf and gives a Mini spin (tickets or coins); the card slot drops a cat card (the Ragdoll is rare). Up to four spins can wait their turn; with all four waiting, the hole's lid shuts and coins bounce onto the shelf, so none is wasted. The pusher shoves everything toward the front edge, where coins come back to you with a ticket; walls guard the sides, and the robot jar in the middle of the front edge keeps the coins that fall into it, feeding the Lucky Jar every arcade game shares. Push six cores off the front for a Super spin worth up to 500 tickets; signed in, every Super spin is also a chance to win the whole Lucky Jar. Cat cards pushed off the front go into your card stash, duplicates stacking; you choose when to exchange one card or a full set of all ten breeds for tickets. The machine never resets: out of coins it rests, keeping its shelf, cores and cards until you come back. Sign in for 100 welcome coins, then daily coins that grow with your login streak (50 up to 150); your machine is saved to your account, the tickets you win go to the ticket wallet every arcade game shares, and the Prize Counter trades tickets for coins or cat cards. The weekly leaderboard ranks the tickets you earn this week. Signed out, you play a 100-coin trial machine on this device.",
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
  version: changelog[0].version,
  changelog,
  // Signed in: the machine lives on the account (save.ts checks it) and the
  // allowance pays its coins; signed out it is a local trial
  accountSave: true,
  // A 7-day login streak (the server pays STREAK[(n - 1) % 7] on day n)
  allowance: { kind: "coins", welcome: WELCOME_COINS, daily: DAILY_COINS, streak: [...STREAK] },
  tickets: true,
  // The shared Lucky Jar (docs/standards/jackpot.md): coins the robot jar eats
  // feed it, and each Super spin rolls for it once (jackpot.ts, game.ts)
  jackpot: true,
  // The Prize Counter: delivered through allowance.claim() as "shop" grants (game.ts)
  shop: [
    { id: "coins10", name: { vi: "Túi 10 xu", en: "Bag of 10 coins" }, ...SHOP.coins10 },
    { id: "card1", name: { vi: "Gói 1 thẻ mèo", en: "Cat card pack (1 card)" }, ...SHOP.card1 },
  ],
  inspiredBy: {
    vi: "Máy đổi vé bắn xu và đẩy xu trong khu trò chơi",
    en: "Coin-shooter and coin-pusher redemption arcade machines",
  },
};

export default manifest;
