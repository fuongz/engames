import type { GameManifest } from "@web-games/core";
import banner from "./banner.webp";
import { H, W } from "./config";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";
import share from "./share.jpg";

const manifest: GameManifest = {
  slug: "tiem-banh-may",
  title: { vi: "Tiệm Bánh Mây", en: "Cloud Bakery" },
  tagline: {
    vi: "Đi chợ, làm bánh đúng công thức, rồi mở cửa bán cho những vị khách lông xù!",
    en: "Shop, bake by the recipe, then open up for your fluffy customers!",
  },
  description: {
    vi: "Mỗi ngày có hai ca. Tối sau giờ đóng cửa, bạn đi chợ, mua công thức và tự tay làm bánh: cân đúng, trộn vừa, nướng đúng nhiệt và đúng giờ, sai công thức là bánh cháy, sống hoặc xẹp. Từ 9:00 đến 16:30 tiệm mở cửa: khách gọi món, bạn lấy bánh trong tủ kính, xếp hộp và thối tiền. Bánh chỉ để được trong ngày, cuối ngày bánh thừa phải bỏ. Tiệm được lưu theo tài khoản, lời lãi ra sao là do bạn.",
    en: "Every day has two shifts. After closing you shop for ingredients, buy recipes and bake by hand: weigh right, mix just enough, bake at the right heat for the right time, or end up with a burnt, raw or flat batch. From 9:00 to 16:30 the shop is open: customers order, you pick from the display, box it up and count the change. Cakes only keep for the day, so whatever is left gets binned. Your bakery is saved to your account; profit or loss is up to you.",
  },
  controls: {
    vi: [
      "Cần đăng nhập: tiệm bánh được lưu theo tài khoản của bạn.",
      "Ca tối: mỗi việc tốn giờ làm (đi chợ 30 phút, mỗi mẻ bánh tuỳ công thức). Xem dự báo để biết mai đông hay vắng.",
      "Làm bánh: chọn đúng nguyên liệu, giữ để đổ lên cân, xoay ngón tay quanh tô để trộn, canh màu trên bếp, chỉnh nhiệt rồi lấy bánh ra đúng phút.",
      "Làm thành công 3 mẻ một loại bánh thì mở khoá Làm nhanh (bánh 2★).",
      "Ca bán: chạm bánh trong tủ kính đúng món khách gọi, bấm Giao bánh, chọn hộp vừa khít và đếm tiền thối.",
      "Từ 15:30 có thể giảm giá 30% để xả hàng. Nhà phê bình chỉ nhận bánh 3★.",
    ],
    en: [
      "Sign-in required: your bakery is saved to your account.",
      "Night shift: every job takes working time (market 30 min, each batch depends on the recipe). Check the forecast for tomorrow's crowd.",
      "Baking: pick the right ingredient, hold to pour onto the scale, circle the bowl to mix, watch the colour on the stove, set the oven and take it out on the minute.",
      "Bake one recipe well 3 times to unlock Quick bake (2★ cakes).",
      "Opening hours: tap the cakes each customer asks for, press Hand over, pick the snuggest box and count the change.",
      "From 15:30 you can put everything 30% off. The food critic only accepts 3★ cakes.",
    ],
  },
  category: "chien-thuat",
  tags: {
    vi: ["quản lý", "làm bánh", "nấu ăn", "thú cưng"],
    en: ["management", "baking", "cooking", "cute animals"],
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
