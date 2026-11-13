import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-11-13",
    title: { vi: "Tòa tháp 3D", en: "A 3D tower" },
    changes: {
      vi: [
        "Đổi tòa tháp sang khối 3D cạnh vuông, có ánh sáng và bóng tiếp xúc nhẹ.",
        "Thêm mảnh cắt xoay khi rơi; tắt xoay khi thiết bị bật giảm chuyển động.",
        "Giữ góc nhìn, nhịp thả khối và điểm số; tự dùng đồ họa 2D khi thiết bị không hỗ trợ 3D.",
      ],
      en: [
        "Changed the tower to square-edged 3D blocks with lighting and subtle contact shadows.",
        "Added tumbling offcuts; disable their rotation when reduced motion is enabled.",
        "Kept the camera angle, drop timing and scoring; automatically use 2D graphics when 3D is unavailable.",
      ],
    },
  },
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
