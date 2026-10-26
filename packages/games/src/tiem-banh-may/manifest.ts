import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "tiem-banh-may",
  title: { vi: "Tiệm Bánh Ngọt", en: "Cozy Little Bakery" },
  tagline: {
    vi: "Mở tiệm bánh của riêng bạn: đặt tên, trang trí, làm bánh và đón những vị khách lông xù!",
    en: "Run a bakery of your own: name it, decorate it, bake, and welcome fluffy customers!",
  },
  description: {
    vi: "Mỗi ngày có hai ca. Tối sau giờ đóng cửa, bạn đi chợ, mua công thức và tự tay làm bánh: cân đúng, trộn vừa, nướng đúng nhiệt và đúng giờ, sai công thức là bánh cháy, sống hoặc xẹp. Từ 9:00 đến 16:30 tiệm mở cửa: khách tự chọn bánh trên các quầy rồi xếp hàng, Mây tính tiền ở quầy thu ngân. Đặt tên tiệm, mua bàn ghế, quầy bánh, tường và sàn để tiệm thêm Cuốn hút và đông khách. Tiệm được lưu theo tài khoản, lời lãi ra sao là do bạn.",
    en: "Every day has two shifts. After closing you shop for ingredients, buy recipes and bake by hand: weigh right, mix just enough, bake at the right heat for the right time, or end up with a burnt, raw or flat batch. From 9:00 to 16:30 the shop is open: customers pick from your cake stands and queue, and Mây rings them up at the counter. Name your bakery and furnish it with tables, stands, walls and floors to raise its Charm and draw a bigger crowd. Your bakery is saved to your account; profit or loss is up to you.",
  },
  controls: {
    vi: [
      "Cần đăng nhập: tiệm bánh được lưu theo tài khoản của bạn.",
      "Ca tối: mỗi việc tốn giờ làm (đi chợ 30 phút, mỗi mẻ bánh tuỳ công thức). Xem dự báo để biết mai đông hay vắng.",
      "Làm bánh: chọn đúng nguyên liệu, giữ để đổ lên cân, xoay ngón tay quanh tô để trộn, canh màu trên bếp, chỉnh nhiệt rồi lấy bánh ra đúng phút.",
      "Ca bán: khách tự lấy bánh trên quầy. Chạm quầy thu ngân để Mây tính nhanh hơn, khách mua nhiều thì chọn hộp vừa khít.",
      "Trang trí: kéo thả đồ trên sàn, đổi tường và sàn. Tiệm càng Cuốn hút càng đông khách.",
      "Từ 15:30 có thể giảm giá 30% để xả hàng. Nhà phê bình chỉ nhận bánh 3★.",
    ],
    en: [
      "Sign-in required: your bakery is saved to your account.",
      "Night shift: every job takes working time (market 30 min, each batch depends on the recipe). Check the forecast for tomorrow's crowd.",
      "Baking: pick the right ingredient, hold to pour onto the scale, circle the bowl to mix, watch the colour on the stove, set the oven and take it out on the minute.",
      "Opening hours: customers serve themselves from the stands. Tap the counter to help Mây ring up faster, and pick the snuggest box for big orders.",
      "Decorate: drag furniture around the floor and change the walls and floor. The more Charm, the bigger the crowd.",
      "From 15:30 you can put everything 30% off. The food critic only accepts 3★ cakes.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["quản lý", "làm bánh", "trang trí", "nấu ăn", "thú cưng", "online"],
    en: [
      "management",
      "baking",
      "decorating",
      "cooking",
      "cute animals",
      "online",
    ],
  },
  poster: { vi: posterVi, en: posterEn },
  banner,
  share,
  width: W,
  height: H,
  releasedAt: "2026-10-25T09:00",
  inspiredBy: {
    vi: "Good Pizza, Great Pizza (quản lý tiệm) và Cooking Mama (làm món theo từng bước)",
    en: "Good Pizza, Great Pizza (running the shop) and Cooking Mama (cooking step by step)",
  },
  requiresAccount: true,
  saveSlots: 3,
};

export default manifest;
