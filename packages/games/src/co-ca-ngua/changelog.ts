import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-11-08",
    title: {
      vi: "Luật Việt Nam, bàn cờ vẽ tay",
      en: "Vietnamese rules, a painted board",
    },
    changes: {
      vi: [
        "Đổi sang luật Cờ Cá Ngựa Việt Nam: cộng hai xí ngầu rồi đi một con ngựa.",
        "Đôi hoặc 1-6 để xuất ngựa và gieo tiếp; ba lần liền thì mất lượt.",
        "Không nhảy qua ngựa khác, đá được ngựa đối thủ ở bất kỳ ô nào, không còn ô an toàn.",
        "Bàn cờ mới nền xanh đậm vẽ tay, mỗi chuồng có một cảnh Việt Nam nhỏ (Hội An, ruộng bậc thang, chùa, vịnh).",
        "Chân dung người chơi tròn ở các góc cùng nút gieo xí ngầu to.",
      ],
      en: [
        "Switched to the Vietnamese ludo rules: the two dice are added up and moved by one horse.",
        "Doubles or a 1-6 bring a horse out and roll again; three in a row lose the turn.",
        "No jumping over horses, landing on a rival captures it anywhere on the loop, and there are no safe squares.",
        "A new hand-drawn deep-blue board, with a small Vietnamese scene by each stable (Hội An, rice terraces, a pagoda, the bay).",
        "Round player portraits at the corners and a big roll button holding the two dice.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-11-08",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Gieo hai xí ngầu, xuất ngựa và đá nhau về chuồng.",
        "2 đến 4 người chơi: đấu máy, chơi chung một máy hoặc online với bạn bè.",
        "Máy chơi thay những ghế còn trống, ba mức Dễ, Thường, Khó.",
        "Mời bạn vào phòng bằng mã QR.",
      ],
      en: [
        "Roll two dice, ride out and knock rivals back to the stable.",
        "2 to 4 players: the computer, friends on one phone, or friends online.",
        "The computer fills any empty seats, on Easy, Normal or Hard.",
        "Invite friends to your room with a QR code.",
      ],
    },
  },
];
