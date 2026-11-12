import type { ChangelogEntry } from "@web-games/core";

export const changelog: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2026-10-26",
    title: { vi: "Tiệm Bánh Ngọt", en: "Cozy Little Bakery" },
    changes: {
      vi: [
        "Đổi tên thành Tiệm Bánh Ngọt: mỗi người tự đặt tên cho tiệm của mình, có biển hiệu trong cửa hàng.",
        "Màn hình chính là cửa tiệm đang đóng cửa: thanh xu, danh tiếng, năng lượng, tâm trạng, lịch xem dự báo, cùng nút nhạc, tua nhanh, cà phê và cài đặt.",
        "Cửa hàng nhìn từ trên xuống bằng nét sáp màu, khay bánh xếp thành từng chồng nhỏ vẽ riêng cho mỗi món.",
        "Khách và Mây sau quầy được vẽ lại thành những bé tròn xinh.",
        "Sửa thanh nút dưới bị che bởi vạch Home của iPhone và lỗi hướng dẫn bị treo ở bước cuối.",
      ],
      en: [
        "Renamed to Cozy Little Bakery: every player names their own bakery, with a sign in the shop.",
        "The home screen is now the closed shop: coins, reputation, energy and mood pills, a calendar with the forecast, and buttons for music, speed-up, coffee and settings.",
        "The shop floor is seen from above in crayon lines, with trays of little piles drawn for each recipe.",
        "Customers and Mây behind the counter are redrawn as tiny round chibis.",
        "Fixed the bottom bar hiding under the iPhone home indicator, and the tour freezing on its last step.",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "2026-10-25",
    title: { vi: "Trang trí cửa tiệm", en: "Decorate your shop" },
    changes: {
      vi: [
        "Cửa hàng là một căn phòng bạn tự bày trí: kéo thả đồ nội thất, đổi tường và sàn.",
        "Dãy Nội thất mới trong siêu thị với nhiều bộ: Hồng ngọt, Vườn hoa, Rừng xanh, Cổ điển, Tiệm hoa, Mây, Kẹo tím và Bánh mì.",
        "Đồ nội thất tạo ra sức hút, kéo thêm khách và giúp khách kiên nhẫn hơn.",
        "Khách tự đi tới kệ bánh, chọn bánh rồi xếp hàng ra quầy tính tiền.",
        "Vẽ lại 13 loại bánh theo tông pastel; thêm bánh donut sô cô la, cupcake việt quất và bánh cuộn matcha.",
        "Khách thành những bé thú mochi tròn xinh.",
      ],
      en: [
        "The shop is a room you decorate: drag furniture around and change the walls and floors.",
        "A new Furniture aisle in the supermarket with many themes: Pink Sweet, Flower Garden, Green Forest, Classic, Florist, Cloud, Candy Purple and Bread.",
        "Furniture adds charm that draws more customers and makes queuers more patient.",
        "Customers walk to a cake stand, pick what they like and queue at the checkout counter.",
        "All 13 cakes redrawn in soft pastels, plus a chocolate donut, a blueberry cupcake and a matcha roll cake.",
        "Customers are now chubby mochi animals.",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "2026-10-25",
    title: {
      vi: "Mây, nhạc và công thức mới",
      en: "Mây, music and new recipes",
    },
    changes: {
      vi: [
        "Gặp Mây, chú mèo con mascot, và buổi hướng dẫn ngày đầu có thể bỏ qua hoặc xem lại trong Cài đặt.",
        "Chợ thành siêu thị: bỏ hàng vào giỏ, xem lại danh sách trong giỏ rồi trả tiền một lần.",
        "Hộp nhạc trên kệ bếp phát đĩa nhạc mua ở dãy Đĩa nhạc; nhạc đang chạy lúc đóng cửa giúp tâm trạng tốt hơn.",
        "Bảy công thức mới: bánh mì sữa, bánh chuối, bánh bò, croissant, bánh bông lan trứng muối, macaron và tiramisu.",
        "Hộp thoại và chuyển màn mượt hơn.",
      ],
      en: [
        "Meet Mây, the bakery's kitten mascot, and a first-day tour you can skip or replay from Settings.",
        "The market becomes a supermarket: fill the basket, check its list, then pay once at the till.",
        "A music box on the kitchen shelf plays the records you buy from the Records aisle; a record playing at closing lifts the mood.",
        "Seven new recipes: sweet milk bread, banana bread, bánh bò, croissants, salted-egg sponge, macarons and tiramisu.",
        "Smoother dialogs and screen changes.",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-10-24",
    title: {
      vi: "Bếp sống động, nhiều tiệm",
      en: "A living kitchen, more bakeries",
    },
    changes: {
      vi: [
        "Đồng hồ ban đêm chạy liên tục: lò, ủ bột và để nguội diễn ra ngầm, cửa tiệm tự mở lúc 9:00.",
        "Giấc ngủ, năng lượng và tâm trạng: mệt thì tay run, có cà phê, tâm trạng ảnh hưởng tiền boa và danh tiếng.",
        "Mỗi tài khoản có ba tiệm, chọn trong màn “Chọn tiệm”.",
        "Hình vẽ tay ấm áp: bánh, nguyên liệu, dụng cụ, căn bếp; giao diện bảng kẹp giấy kem và đất nung.",
        "Mỗi bước làm bánh có một hình minh hoạ.",
      ],
      en: [
        "A free-running night clock: ovens, proving and cooling run in the background, and the shop opens by itself at 9:00.",
        "Sleep, energy and mood: tired hands shake, coffee helps, and mood affects tips and reputation.",
        "Three bakeries per account, picked on the “Choose a bakery” screen.",
        "Cosy hand-drawn art for cakes, ingredients, tools and rooms, with a cream-and-terracotta clipboard interface.",
        "A picture for every baking step.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-10-23",
    title: { vi: "Ra mắt", en: "Launch" },
    changes: {
      vi: [
        "Game quản lý tiệm bánh dọc: ban đêm lên kế hoạch, mua nguyên liệu và nướng; ban ngày mở cửa bán.",
        "Làm bánh từng bước theo thẻ công thức: cân, đếm trứng, khuấy, canh lửa, canh giờ lò và bơm trang trí.",
        "Mười vị khách thú xếp hàng với đơn riêng; chọn bánh, chọn hộp vừa vặn và thối tiền.",
        "Có đơn đặt trước, nhà phê bình khó tính và đợt khách giảm giá cuối ngày.",
        "Tiến trình được lưu vào tài khoản.",
      ],
      en: [
        "A portrait bakery sim: plan, shop and bake at night, open and sell by day.",
        "Bake by hand with the recipe card: weigh, count eggs, stir, watch the heat, time the oven and pipe the decoration.",
        "Ten animal customers queue with their own orders; pick the cake, pick a snug box and count the change.",
        "Pre-orders, a picky food critic and a late-afternoon discount rush.",
        "Your progress is saved to your account.",
      ],
    },
  },
];
