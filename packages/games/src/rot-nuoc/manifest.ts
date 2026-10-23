import type { GameManifest } from "../core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "rot-nuoc",
  title: { vi: "Rót Nước Màu", en: "Water Sort" },
  tagline: {
    vi: "Rót qua rót lại cho tới khi mỗi ống chỉ còn một màu. Dễ chơi, khó dừng!",
    en: "Pour back and forth until every tube holds a single colour. Easy to start, hard to stop!",
  },
  description: {
    vi: "Mỗi ống chứa bốn lớp nước nhiều màu lẫn lộn. Chạm một ống rồi chạm ống khác để rót: nước chỉ chảy lên lớp cùng màu hoặc vào ống trống, và chỉ rót được tới khi ống đầy. Xếp mọi màu về đúng ống của nó để qua màn. Màn càng cao càng nhiều màu, tới tối đa 12 màu. Mọi màn đều giải được. Kẹt thì dùng hoàn tác, thêm một ống trống, hoặc chơi lại từ đầu.",
    en: "Every tube holds four layers of mixed colours. Tap a tube, then another one to pour: liquid only flows onto the same colour or into an empty tube, and only until the tube is full. Sort every colour into its own tube to clear the level. Higher levels bring more colours, up to twelve. Every level can be solved. Stuck? Undo, add an empty tube, or restart.",
  },
  controls: {
    vi: [
      "Chạm một ống để nhấc lên, chạm ống khác để rót. Chạm lại ống đang nhấc để đặt xuống.",
      "Nước chỉ rót lên lớp cùng màu hoặc vào ống trống; cả khối cùng màu trên cùng sẽ chảy sang nếu còn chỗ.",
      "Nút vàng: chơi lại màn, hoàn tác (có giới hạn lượt), thêm một ống trống (mỗi màn một lần).",
      "Mỗi màn qua được +1 lượt hoàn tác; hộp quà mở được sau mỗi 5 màn.",
      "Máy tính: [Z] hoàn tác, [R] chơi lại, [T] thêm ống, [1]–[9] và [0] để chọn ống.",
    ],
    en: [
      "Tap a tube to lift it, then tap another one to pour. Tap the lifted tube again to put it down.",
      "Liquid only pours onto the same colour or into an empty tube; the whole matching top block flows over if there's room.",
      "Yellow buttons: restart the level, undo (limited), add one empty tube (once per level).",
      "Each cleared level gives +1 undo; the gift box opens every 5 levels.",
      "Desktop: [Z] undo, [R] restart, [T] add a tube, [1]–[9] and [0] to pick a tube.",
    ],
  },
  category: "tri-tue",
  tags: {
    vi: ["xếp màu", "giải đố", "thư giãn", "rót nước"],
    en: ["colour sort", "puzzle", "relaxing", "liquid"],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-10-23T17:00",
  inspiredBy: {
    vi: "Water Sort Puzzle, quảng cáo người dùng quay màn hình",
    en: "Water Sort Puzzle, an ad from a screen recording a player sent in",
  },
};

export default manifest;
