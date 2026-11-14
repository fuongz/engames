import type { ChangelogEntry } from "@web-games/core";

// Newest first. The in-game What's new card shows the entry for the current version.
export const changelog: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2026-11-14",
    title: { vi: "Vòng quay Super", en: "The Super wheel" },
    changes: {
      vi: [
        "Đủ 6 lõi năng lượng là mở vòng quay SUPER khổng lồ chiếm cả màn hình: bấm QUAY! rồi ngồi xem kim dừng ở ô nào.",
        "Vòng quay chạy thật nhanh rồi phanh dần, kim rung qua từng vạch; ô trúng sáng lên rồi hiện vé thưởng lớn với mưa xu.",
        "Đang bật Tự động thì vòng Super tự quay sau một chút.",
        "Đã đăng nhập, lượt Hũ may mắn của mỗi Super hiện ngay trên màn này; máy chạy tiếp khi bạn chạm để đóng.",
        "Vé Super được cộng ngay khi bấm quay, nên tải lại trang giữa chừng cũng không mất vé.",
      ],
      en: [
        "Six energy cores now open a giant full-screen SUPER wheel: press SPIN! and watch where the pointer stops.",
        "The wheel races, then brakes, the pointer flicking at every peg; the winning slot lights up, then a big ticket prize with a coin shower.",
        "With Auto on, the Super wheel spins by itself after a moment.",
        "Signed in, each Super's Lucky Jar chance plays right on this screen; the machine carries on when you tap to close.",
        "Super tickets are paid the moment you spin, so reloading mid-spin never loses them.",
      ],
    },
  },
  {
    version: "1.3.1",
    date: "2026-11-12",
    title: { vi: "Số vé rõ ràng hơn", en: "Clearer ticket numbers" },
    changes: {
      vi: [
        "Thẻ bắt đầu giờ hiện số vé trong ví (cùng số với ô VÉ), không còn dòng tổng vé máy đã trả dễ nhầm với vé bị mất.",
        "Ô VÉ có nhãn nhỏ Ví chung khi đã đăng nhập; chơi khách vẫn là Vé thử.",
        "Xem thẻ lớn trên máy tính toàn màn hình không còn bị tràn: thẻ luôn vừa khung.",
      ],
      en: [
        "The start card now shows your ticket wallet (the same number as the TICKETS counter) instead of the machine's all-time payout, which read like lost tickets.",
        "The ticket counter carries a small Shared caption when signed in; guests still see Trial tickets.",
        "The big card viewer no longer overflows a full-screen desktop window: the card always fits.",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "2026-11-11",
    title: { vi: "Hũ may mắn", en: "Lucky Jar" },
    changes: {
      vi: [
        "Hũ may mắn: một hũ vé dùng chung cho mọi game thùng. Xu rơi vào hũ robot giúp hũ đầy thêm, máy góp thay bạn.",
        "Mỗi lần Super Spin trả thưởng xong là một cơ hội trúng cả hũ (cần đăng nhập). Hũ càng đầy càng dễ nổ; vé trúng vào thẳng ví vé.",
        "Bảng đèn trên máy hiện số vé đang có trong hũ. Người trúng được báo trên thanh trên cùng của trang.",
        "Chưa đăng nhập vẫn xem được hũ; đăng nhập để Super Spin của bạn có thể trúng.",
      ],
      en: [
        "The Lucky Jar: one ticket jar shared by every arcade game. Coins the robot jar eats help fill it, paid by the machine, not you.",
        "Every Super spin that pays is a chance to win the whole jar (signed in). The fuller it is, the likelier it tips; the tickets go straight to your wallet.",
        "The marquee shows how many tickets are in the jar. Winners are announced on the site's top bar.",
        "Signed out you can watch the jar; sign in so your Super spins can win it.",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "2026-11-11",
    title: {
      vi: "Hũ robot & Quầy đổi thưởng",
      en: "Robot jar & Prize Counter",
    },
    changes: {
      vi: [
        "Hũ robot: giữa mép trước có một bé robot hũ, xu rơi vào hũ thì máy giữ. Quay thưởng giờ trả nhiều xu hơn, nên ngắm giỏi chỉ được thêm vé.",
        "Không phí xu nào: đủ 4 lượt quay thì nắp lỗ đóng, xu nảy xuống kệ.",
        "Thẻ mèo đổi lấy vé: 60 vé một thẻ, 300 vé thẻ Ragdoll, 1000 vé cả bộ.",
        "Quầy đổi thưởng: bấm ô vé ngoài trang để đổi vé lấy xu hoặc gói thẻ mèo.",
        "Chuỗi ngày đăng nhập: xu mỗi ngày tăng từ 50 tới 150 xu ở ngày thứ 7.",
        "Bảng xếp hạng tuần: xếp theo vé kiếm được trong tuần, mỗi thứ Hai bắt đầu lại.",
      ],
      en: [
        "The robot jar: a little jar robot sits in the middle of the front edge and keeps the coins that fall in. Prize spins now pay more coins, so good aim only adds tickets.",
        "Never a wasted coin: with 4 spins waiting the hole's lid shuts and coins bounce onto the shelf.",
        "Cards for tickets: 60 tickets a card, 300 for the Ragdoll, 1000 for a full set.",
        "The Prize Counter: tap your ticket count outside the game to trade tickets for coins or cat card packs.",
        "Login streak: daily coins grow from 50 up to 150 on day 7.",
        "Weekly leaderboard: ranked by the tickets you earn this week, starting over every Monday.",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-11-11",
    title: { vi: "Bắn dễ hơn, kho thẻ", en: "Easier aiming, card stash" },
    changes: {
      vi: [
        "Bắn dễ hơn: xu luôn rơi vào vòng đích, lỗ to hơn và sáng xanh khi tới lúc bấm.",
        "Thêm nhiều ô xu: quay thưởng ra xu thường hơn, vòng quay 11 ô to rõ.",
        "Mèo Ragdoll hiếm: khó gặp hơn các bé mèo khác, có huy hiệu Hiếm.",
        "Kho thẻ: thẻ trùng được cộng dồn; tự chọn lúc đổi 1 thẻ hoặc cả bộ lấy vé hay xu.",
        "Xem thẻ: chạm thẻ trong kho để xem to, nghiêng và lật thẻ.",
        "Chơi liền mạch: hết xu không còn bảng chắn, bảng xếp hạng tự cập nhật.",
      ],
      en: [
        "Easier aiming: every coin lands on the target ring, the hole is bigger and glows green when it's time to shoot.",
        "More coin prizes: prize spins pay coins more often, on a bigger, clearer 11-slot wheel.",
        "The rare Ragdoll: harder to find than the other cats, with a Rare badge.",
        "Card stash: duplicates stack; you choose when to exchange one card or a full set, for tickets or coins.",
        "Card viewer: tap a card in your stash to see it big, tilt it and flip it over.",
        "Nonstop play: no more out-of-coins panel, and the leaderboard updates by itself.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-11-11",
    title: { vi: "Bản chính thức", en: "Full release" },
    changes: {
      vi: [
        "Cổng lắc có lỗ: canh xu rơi vào lỗ để được lượt quay thưởng.",
        "Hình mới: tủ máy, vòng quay, xu, lõi năng lượng và robot vẽ lại.",
        "Xu mỗi ngày: đăng nhập nhận 100 xu chào mừng, rồi 50 xu mỗi ngày.",
        "Lưu đám mây: máy, kệ xu và bộ thẻ theo tài khoản, chơi tiếp ở thiết bị nào cũng được.",
        "Vé chung: vé thắng được vào ví vé dùng chung cho các game thùng.",
      ],
      en: [
        "A swinging gate with a hole: time your coin into it for a prize spin.",
        "New art: the cabinet, wheel, coins, energy cores and robots, all redrawn.",
        "Daily coins: sign in for 100 welcome coins, then 50 coins every day.",
        "Cloud save: your machine, shelf and cards follow your account to any device.",
        "Shared tickets: the tickets you win go to the arcade wallet every arcade game shares.",
      ],
    },
  },
  {
    version: "0.2.0",
    date: "2026-11-10",
    title: { vi: "Beta: thẻ mèo & mã quà", en: "Beta: cat cards & coupons" },
    changes: {
      vi: [
        "Sửa lỗi bắn liên tục sau khi chạm nhanh, thêm nút Tự động bật/tắt.",
        "Vòng quay có ô mới: vé, xu rải trên kệ, lõi năng lượng kèm Mini Spin và thẻ sưu tầm.",
        "10 thẻ mèo chibi cùng màn xem bộ sưu tập; đủ bộ 10 thẻ đổi được 1000 vé.",
        "Gom đủ 6 lõi để quay Super Spin tới 500 vé.",
        "Nhập mã quà để nhận thêm xu.",
        "Vách chắn chạy suốt kệ nên mọi thứ chỉ rơi ra ở mép trước.",
      ],
      en: [
        "Fixed the shoot button that kept firing after quick taps, and added an Auto on/off toggle.",
        "New wheel slots: tickets, coins spread over the shelf, an energy core with a Mini spin, and a collectible card.",
        "10 chibi cat cards and an album to browse them; a full set of 10 pays 1000 tickets.",
        "Collect six cores for a Super spin worth up to 500 tickets.",
        "Redeem coupon codes for extra coins.",
        "Walls now run the whole shelf, so things only fall off the front edge.",
      ],
    },
  },
  {
    version: "0.1.0",
    date: "2026-11-08",
    title: { vi: "Beta đầu tiên", en: "First beta" },
    changes: {
      vi: [
        "Máy bắn xu và đẩy xu theo chủ đề robot và vũ trụ: canh nút BẮN theo vòng quay đích để nhận vé, lõi hoặc Bonus Spin.",
        "Xu rơi xuống kệ đẩy; xu rơi qua mép trước quay về tay bạn.",
        "Gom 6 lõi năng lượng để thắp sáng đồng hồ và nhận Super Bonus 250 vé.",
        "Bản thử: mỗi ván có 200 xu.",
      ],
      en: [
        "A robot-and-space coin shooter and coin pusher: time SHOOT against the spinning target wheel for tickets, cores or a Bonus spin.",
        "Coins land on the pusher shelf; coins that go over the front edge come back to you.",
        "Collect six energy cores to light the gauge for a 250-ticket Super Bonus.",
        "Beta: 200 coins a run.",
      ],
    },
  },
];
