import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-11-08",
    title: {
      vi: "Bàn cờ ngang toàn màn hình",
      en: "A full-screen landscape board",
    },
    changes: {
      vi: [
        "Cờ Tỷ Phú chuyển sang màn hình ngang: 40 ô nằm quanh viền, hiện tên, giá, chủ đất, nhà và đất đang cầm cố.",
        "Giữa bàn là bảng thông tin: người đang đi, hai xí ngầu, tiền của mọi người và khung quyết định.",
        "Chạm vào bất kỳ ô nào để xem thẻ đất.",
        "Gọi là “xí ngầu” cho thân quen, giống Cờ Cá Ngựa.",
      ],
      en: [
        "Cờ Tỷ Phú now plays in landscape: the 40 squares ring the screen, showing name, price, owner, houses and mortgaged land.",
        "The middle is a dashboard with the current player, the two dice, everyone's cash and a decision panel.",
        "Tap any square to see its deed card.",
        "The dice are now called “xí ngầu”, as in Cờ Cá Ngựa.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-11-08",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Mua đất khắp Việt Nam, xây nhà, thu tiền thuê và giao dịch cho đủ bộ.",
        "Có đấu giá, cầm cố đất và trao đổi với người chơi khác; có thể đặt giới hạn thời gian.",
        "Đấu máy ba mức, chuyền máy cho bạn bè hoặc chơi online 2 đến 4 người.",
        "Địa danh và thẻ cơ hội thuần Việt, do chúng mình tự vẽ.",
      ],
      en: [
        "Buy land across Vietnam, build houses, collect rent and trade for full sets.",
        "Auctions, mortgages and trading with other players, plus an optional time limit.",
        "Play the computer on three levels, pass the phone, or play online with 2 to 4 people.",
        "Vietnamese places and cards, all original.",
      ],
    },
  },
];
