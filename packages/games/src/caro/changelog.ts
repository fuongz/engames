import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-11-10",
    title: { vi: "Xoá điểm thắng thua", en: "Reset the tally" },
    changes: {
      vi: [
        "Thêm nút đặt lại bảng thắng thua ngay trong menu.",
        "Sau khi đặt lại, số ván thắng, thua và hoà của bạn bắt đầu đếm từ đầu.",
      ],
      en: [
        "Added a button in the menu to reset your win/loss tally.",
        "After a reset, your wins, losses and draws start counting from zero.",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-11-08",
    title: {
      vi: "Chọn số ván, chữ tiếng Việt rõ hơn",
      en: "Pick the match length, clearer Vietnamese text",
    },
    changes: {
      vi: [
        "Phòng online cho chủ phòng chọn đấu 1, 3 hoặc 5 ván.",
        "Sửa chữ tiếng Việt bị lỗi dấu trong game: giờ dùng phông Mali dễ đọc.",
      ],
      en: [
        "Online rooms now let the host pick a best of 1, 3 or 5.",
        "Fixed Vietnamese letters showing with broken accents: the game now uses the friendly Mali font.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-11-08",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Cờ caro 19×19 trên trang vở ô li: đủ 5 quân liền, không bị chặn hai đầu là thắng.",
        "Đấu máy ở ba mức Dễ, Thường, Khó, hoặc hai người chơi chung một máy.",
        "Thách đấu bạn online: đấu ba ván, mỗi lượt 30 giây.",
        "Chạm để chọn ô, chạm lần nữa để đánh; kẹp hai ngón hoặc bấm kính lúp để phóng to.",
      ],
      en: [
        "Five in a row on a 19×19 squared notebook page: line up 5 stones that aren't blocked at both ends to win.",
        "Play the computer on Easy, Normal or Hard, or two players on one phone.",
        "Challenge a friend online: best of three, 30 seconds a turn.",
        "Tap a cell to pick it, tap again to play; pinch or use the magnifier to zoom in.",
      ],
    },
  },
];
