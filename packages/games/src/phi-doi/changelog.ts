import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-10-23",
    title: { vi: "Song ngữ, ảnh chia sẻ", en: "Two languages, link previews" },
    changes: {
      vi: [
        "Game có đầy đủ tiếng Việt và tiếng Anh, tự theo ngôn ngữ bạn chọn.",
        "Có ảnh xem trước đẹp hơn khi chia sẻ link game.",
      ],
      en: [
        "The game now speaks Vietnamese and English, following the language you pick.",
        "A nicer preview picture when you share the game's link.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-10-23",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Game bắn máy bay kiểu 1942: phi đội của bạn bay qua Thái Bình Dương đầy đảo, máy bay địch, trực thăng và thuyền chiến.",
        "Diệt hết một đội hình sẽ rơi thùng P nâng cấp, tối đa 5 luồng đạn.",
        "Nút xanh nạp đầy nhờ hạ địch rồi cho bắn tốc độ cao 5 giây; bom xoá sạch đạn địch.",
        "Mỗi màn kết thúc bằng một chiến hạm khổng lồ; chìm nó là vào màn khó hơn.",
        "Kéo ngón tay tương đối nên tay không che máy bay.",
      ],
      en: [
        "A 1942-style shoot ’em up: your squadron flies over a Pacific of islands, fighter formations, helicopters and gunboats.",
        "Wiping out a formation drops a P crate, up to 5 streams of fire.",
        "The green button charges from kills into 5 seconds of rapid fire; bombs clear enemy fire.",
        "Every stage ends with a huge battleship; sink it and a harder stage begins.",
        "Relative drag control keeps your finger off the plane.",
      ],
    },
  },
];
