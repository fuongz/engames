import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-11-04",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Nối hai thú giống nhau bằng đường gấp khúc không quá hai lần, dọn sạch bàn trước khi hết giờ.",
        "36 chú thú pixel dễ thương do chúng mình tự vẽ.",
        "Mỗi màn có kiểu rơi khác nhau: bảy chế độ trọng lực lần lượt luân phiên.",
        "Hết nước đi thì bàn tự xáo miễn phí; có thêm gợi ý, xáo và đóng băng thời gian.",
      ],
      en: [
        "Link two matching critters with a line of at most two bends and clear the board before time runs out.",
        "36 cute pixel-art animals, all drawn for the game.",
        "Each level pulls tiles differently: seven gravity modes take turns.",
        "When you run out of moves the board reshuffles for free; hint, shuffle and freeze boosters help too.",
      ],
    },
  },
];
