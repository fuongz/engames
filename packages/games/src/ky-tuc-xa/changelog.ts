import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-10-23",
    title: { vi: "Co-op online", en: "Online co-op" },
    changes: {
      vi: [
        "Chơi cùng nhau online: tối đa 6 người chung một ký túc xá chống Thợ Săn Giấc Mơ.",
        "Mời bạn bằng đường link phòng; máy chơi thay những giường còn trống.",
        "Người bị bắt chuyển sang xem tiếp, tiền thưởng khi hạ Thợ Săn được chia chung.",
        "Đăng nhập để ghi tên lên bảng xếp hạng co-op riêng.",
      ],
      en: [
        "Play together online: up to 6 people share the dorm against the Dream Hunter.",
        "Invite friends with a room link; bots take any empty bed.",
        "A player who is caught keeps watching, and the hunter bonus is shared.",
        "Sign in to get on a separate co-op leaderboard.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-10-23",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Còn 30 giây để chạy đua giành một trong 16 phòng; giường bị chiếm thì bạn không vào được.",
        "Ngủ để kiếm xu, rồi xây tháp đèn pha, máy chơi game, trạm sửa chữa và nâng cấp giường, cửa.",
        "Khi hết giờ, Thợ Săn Giấc Mơ lần lượt phá cửa; cửa bạn vỡ là hết ván.",
        "Di chuyển tự do bằng cần ảo trên điện thoại hoặc WASD trên máy tính.",
      ],
      en: [
        "30 seconds to race for one of 16 rooms; a taken bed refuses you.",
        "Sleep for gold, then build Glare Turrets, Arcade Machines, Repair Stations and upgrade your bed and door.",
        "When time is up, the Dream Hunter breaks doors one by one; when yours breaks, the run is over.",
        "Move freely with a floating joystick on touch or WASD on desktop.",
      ],
    },
  },
];
