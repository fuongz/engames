import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-11-08",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Chạm đúng lúc để xếp tấm lên tấm: lệch bao nhiêu, cắt bấy nhiêu.",
        "Xếp gần chuẩn thì tấm khít lại, tới lần thứ ba liền còn mọc rộng ra và vang lên tiếng chuông cao hơn.",
        "Bầu trời đổi từ bình minh sang đêm sao khi tháp lên cao.",
      ],
      en: [
        "Tap at the right moment to stack slab on slab: whatever hangs over is cut off.",
        "Near-perfect drops snap into place and, from the third in a row, grow the slab back, chiming higher each time.",
        "The sky moves from dawn to a starry night as the tower rises.",
      ],
    },
  },
];
