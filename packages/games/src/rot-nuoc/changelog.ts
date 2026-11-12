import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-11-04",
    title: { vi: "Khó hơn", en: "A tougher challenge" },
    changes: {
      vi: [
        "Màn 1 có 4 màu, cứ 3 màn thêm một màu, tối đa 12 màu từ màn 25.",
        "Từ màn 20, các màn chẵn chỉ có một ống trống.",
        "Từ màn 15, cứ ba màn lại có một màn giấu các lớp bên dưới thành dấu “?”.",
        "Có 3 lượt hoàn tác lúc đầu, cứ hai màn được thêm 1.",
        "Rót nhanh hơn (0,5 giây) và ống còn đang đầy vẫn nhận thêm lượt rót.",
      ],
      en: [
        "Level 1 starts with 4 colours, one more every 3 levels, up to 12 from level 25.",
        "From level 20, even levels have just one empty tube.",
        "From level 15, every third level hides the layers under each top as “?”.",
        "You start with 3 undos, and get 1 more every second level.",
        "Pours are quicker (0.5 s), and a tube still filling can take another pour.",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-10-23",
    title: { vi: "Giao diện gọn hơn", en: "Tidier controls" },
    changes: {
      vi: [
        "Vẽ lại các biểu tượng trên thanh nút, số lượng hiện thành huy hiệu ở góc.",
        "Nút hết lượt chuyển màu xám cho dễ nhận ra.",
        "Có ảnh xem trước đẹp hơn khi chia sẻ link game.",
      ],
      en: [
        "Redrawn icons on the control bar, with counts shown as corner badges.",
        "Buttons you can't use now turn grey so they're easy to spot.",
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
        "Rót qua rót lại cho tới khi mỗi ống chỉ còn một màu.",
        "Chạm ống để nhấc, chạm ống khác để rót: nước chỉ đổ lên cùng màu hoặc vào ống trống.",
        "Màn chơi nào cũng giải được, càng lên cao càng nhiều màu.",
        "Có hoàn tác, thêm ống trống và quà tặng sau mỗi 5 màn; bắt đầu lại miễn phí.",
      ],
      en: [
        "Pour back and forth until every tube holds a single colour.",
        "Tap a tube to lift it, tap another to pour: liquid only lands on the same colour or in an empty tube.",
        "Every level can be solved, with more colours as you climb.",
        "Undo, an extra empty tube and a gift every 5 levels; restarting is free.",
      ],
    },
  },
];
