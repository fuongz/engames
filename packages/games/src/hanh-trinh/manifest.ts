import type { GameManifest } from "../core/types";
import banner from "./banner.webp";
import { H, W } from "./config";
import poster from "./poster.webp";

const manifest: GameManifest = {
  slug: "hanh-trinh",
  title: "Hành Trình Anh Hùng",
  tagline: "Một mình một gậy chặn cả đoàn quân đỏ. Nâng cấp kịp không?",
  description:
    "Anh hùng tự động đánh con quái đứng đầu hàng, hạ được con nào thì cả hàng bước lên và vàng rơi ra. Dùng vàng nâng cấp vũ khí (gậy, rìu, kiếm…) để đánh mạnh hơn và khiên để thêm máu, chặn đòn. Cung thủ bắn tên từ phía sau, lính mũ sắt rất trâu, cứ 20 quái lại có một Tù trưởng. Trụ được bao nhiêu quái?",
  controls: [
    "Anh hùng tự đánh, bạn chỉ cần chọn lúc nâng cấp.",
    "Nút trái: vũ khí mới, tăng sát thương. Nút phải: khiên, thêm máu tối đa, hồi máu ngay và có tỉ lệ chặn đòn.",
    "Nút sáng lên khi đủ vàng. Mỗi con quái hạ được hồi một chút máu.",
    "Chí mạng gây gấp đôi sát thương (số vàng có lửa). Điểm xếp hạng là số quái hạ được.",
  ],
  category: "chien-thuat",
  tags: ["idle", "nhập vai", "nâng cấp", "chặn quái"],
  poster,
  banner,
  width: W,
  height: H,
  releasedAt: "2026-10-23",
  inspiredBy: "Epic Idle Journey: RPG Battle (FreePlay Studio) playable ad",
};

export default manifest;
