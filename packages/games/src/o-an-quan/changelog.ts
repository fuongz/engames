import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-11-08",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Trò chơi dân gian Ô Ăn Quan: rải dân theo hai chiều, ăn quan, ai nhiều điểm hơn thắng.",
        "Đấu máy ba mức, chơi chung một máy hoặc thách đấu online (chọn 1, 3 hoặc 5 ván).",
        "Hết dân thì được rải lại từ phần ăn được, nếu thiếu thì mượn của đối thủ và trả lại cuối ván.",
        "Tuỳ chọn luật “không ăn quan non”.",
        "Ba giao diện đổi được: sân gạch, khay sơn mài và tranh khắc gỗ dân gian.",
      ],
      en: [
        "The Vietnamese folk game Ô Ăn Quan: sow the pebbles either way, take the quan, most points wins.",
        "Play the computer on three levels, share one phone, or challenge a friend online (best of 1, 3 or 5).",
        "An empty row refills from your captures, borrowing from your opponent when short and repaying at the end.",
        "An optional “no young quan” rule.",
        "Three themes to switch between: a brick courtyard, a lacquer tray and a folk woodblock print.",
      ],
    },
  },
];
