import prisma from "../lib/prisma.js";

async function seedNews() {
  console.log("🌱 Bắt đầu nạp dữ liệu mẫu cho Chuyên mục và Tin tức biển...");

  // 1. Chuyên mục tin tức
  const categoriesData = [
    {
      name: "Bảo tồn biển",
      slug: "conservation",
      description: "Các chiến dịch, nỗ lực phục hồi san hô và bảo tồn sinh vật biển quý hiếm.",
      icon: "Shield",
      sort_order: 1,
    },
    {
      name: "Khám phá & Kỳ quan",
      slug: "discovery",
      description: "Những phát hiện sinh vật biển sâu và chuyến thám hiểm đại dương kỳ bí.",
      icon: "Compass",
      sort_order: 2,
    },
    {
      name: "Sinh thái Biển Đông",
      slug: "east-sea",
      description: "Tin tức và nghiên cứu về chủ quyền và tài nguyên sinh thái Biển Đông.",
      icon: "Waves",
      sort_order: 3,
    },
    {
      name: "Có thể bạn chưa biết",
      slug: "fun-facts",
      description: "Những kiến thức và sự thật kỳ thú, bất ngờ về đại dương và Trái Đất.",
      icon: "Sparkles",
      sort_order: 4,
    },
    {
      name: "Sự kiện & Hoạt động",
      slug: "events",
      description: "Hoạt động tình nguyện, ngày hội làm sạch bãi biển và hội thảo môi trường.",
      icon: "Calendar",
      sort_order: 5,
    },
    {
      name: "Nghiên cứu & Khoa học",
      slug: "research",
      description: "Báo cáo hải dương học, phân tích tác động biến đổi khí hậu đến hệ sinh thái biển.",
      icon: "Microscope",
      sort_order: 6,
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const upserted = await prisma.news_categories.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sort_order: cat.sort_order,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        sort_order: cat.sort_order,
        is_active: true,
      },
    });
    categoryMap[cat.slug] = upserted.id;
  }
  console.log("✅ Đã khởi tạo 6 chuyên mục tin tức thành công!");

  // 2. Bài viết tin tức mẫu (bao gồm cả các bài Có thể bạn chưa biết)
  const articlesData = [
    {
      title: "Mùa rùa nở tại Côn Đảo: hàng nghìn rùa con trở về đại dương",
      slug: "mua-rua-no-con-dao-2026",
      excerpt:
        "Đêm nào cũng vậy, các tình nguyện viên lại túc trực bên những hố ấp trứng cát trắng để đón chào từng lứa rùa con khỏe mạnh trở về với sóng biếc quê hương.",
      content: `Vườn Quốc gia Côn Đảo (Bà Rịa - Vũng Tàu) là bãi đẻ quan trọng bậc nhất của loài Rùa Xanh (Chelonia mydas) tại Việt Nam. Mỗi năm, hàng trăm cá thể rùa mẹ vượt hàng ngàn hải lý tìm về các bãi cát quen thuộc như Bãi Cát Lớn (hòn Bảy Cạnh), Hòn Tre Lớn, Hòn Cau để đẻ trứng.

Nhờ sự nỗ lực không ngừng nghỉ của lực lượng kiểm lâm và hàng trăm tình nguyện viên bảo tồn biển, tỷ lệ ấp nở thành công đạt trên 87%. Những chú rùa con vừa chào đời sẽ nhanh chóng hướng về ánh trăng trên mặt biển để bắt đầu hành trình sinh tồn đầy kỳ diệu giữa lòng đại dương.`,
      cover_url:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
      cover_caption: "Rùa biển con chập chững những bước đi đầu tiên ra biển tại Côn Đảo",
      category_id: categoryMap["conservation"],
      is_featured: true,
      status: "published",
      view_count: 1420n,
      published_at: new Date(Date.now() - 3600 * 1000 * 12),
    },
    {
      title: "Biển Đông – Vùng biển đa dạng sinh học hàng đầu thế giới",
      slug: "bien-dong-vung-bien-da-dang-sinh-hoc-hang-dau",
      excerpt:
        "Biển Đông có diện tích khoảng 3.5 triệu km², là một trong những vùng biển nửa kín lớn nhất hành tinh, nuôi dưỡng hơn 3.000 loài sinh vật biển và hệ sinh thái rạn san hô vô cùng phong phú.",
      content: `Biển Đông là vùng biển nửa kín có diện tích khoảng 3.5 triệu km², trải dài từ xích đạo lên đến chí tuyến Bắc. Với cấu trúc địa hình đáy biển đa dạng từ thềm lục địa thoái thoải ven bờ tới lòng chảo vực thẳm sâu hơn 5.000 mét ở rãnh Manila, Biển Đông được mệnh danh là một trong những cái nôi đa dạng sinh thái biển hàng đầu thế giới.

Nơi đây là môi trường sinh sống của hơn 3.000 loài cá, hơn 400 loài san hô tạo rạn, hàng trăm loài động vật giáp xác, thân mềm và động vật biển có vú quý hiếm như bò biển (Dugong), rùa da, và cá heo trắng Indo-Thái Bình Dương. Hệ sinh thái rạn san hô và thảm cỏ biển tại Hoàng Sa, Trường Sa, Côn Đảo và Phú Quốc đóng vai trò xung yếu trong việc duy trì an ninh dinh dưỡng biển cho toàn bộ Đông Nam Á.`,
      cover_url:
        "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1200&auto=format&fit=crop&q=80",
      cover_caption: "Rạn san hô rực rỡ sắc màu đặc trưng của các vùng biển đảo Việt Nam",
      category_id: categoryMap["fun-facts"],
      is_featured: true,
      status: "published",
      view_count: 2850n,
      published_at: new Date(Date.now() - 3600 * 1000 * 24),
    },
    {
      title: "Point Nemo – nơi xa đất liền nhất và gần Trạm Vũ Trụ ISS hơn cả con người",
      slug: "point-nemo-noi-xa-dat-lien-nhat-trai-dat",
      excerpt:
        "Vùng biển Point Nemo là nơi xa đất liền nhất trên Trái Đất, cách bờ gần nhất tới 2,688 km. Nơi kỳ lạ đến mức con người ở gần nó nhất chính là các phi hành gia trên trạm vũ trụ khi bay ngang qua phía trên.",
      content: `Nằm ở tọa độ 48°52.6′ Nam và 123°23.6′ Tây ở Nam Thái Bình Dương, Point Nemo là 'Cực bất khả tiếp cận đại dương' (Oceanic Pole of Inaccessibility). Điểm đất liền gần nhất cách nơi này tới 2.688 km (quần đảo Pitcairn về phía bắc, đảo Easter về phía đông bắc và đảo Maher của Nam Cực về phía nam).

Điều thú vị nhất là: khi Trạm Vũ trụ Quốc tế (ISS) bay qua vùng trời phía trên Point Nemo ở độ cao khoảng 400 km, các phi hành gia ngoài không gian chính là những con người ở gần điểm này nhất trên toàn vũ trụ. Do dòng hải lưu Nam Thái Bình Dương xoáy vòng cô lập dinh dưỡng, vùng nước tại đây có sinh khối cực thấp, khiến nó trở thành 'bãi tha ma' lý tưởng để các cơ quan hàng không vũ trụ điều khiển tàu vũ trụ hết niên hạn lao xuống tiêu hủy an toàn.`,
      cover_url:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
      cover_caption: "Trái Đất nhìn từ quỹ đạo không gian và sự tĩnh lặng của đại dương",
      category_id: categoryMap["fun-facts"],
      is_featured: true,
      status: "published",
      view_count: 3120n,
      published_at: new Date(Date.now() - 3600 * 1000 * 36),
    },
    {
      title: "Vành đai Lửa Thái Bình Dương: Nơi 75% núi lửa đang hoạt động",
      slug: "vanh-dai-lua-thai-binh-duong-75-phan-tram-nui-lua",
      excerpt:
        "Bao quanh lòng chảo đại dương là một vòng cung núi lửa dài 40,000 km gọi là Vành đai Lửa, tập trung 75% núi lửa đang hoạt động và 90% các trận động đất mạnh nhất thế giới đều xảy ra tại đây.",
      content: `Vành đai Lửa (Ring of Fire) là dải cung địa chất hình móng ngựa dài hơn 40.000 km bao quanh rìa Thái Bình Dương, kéo dài từ New Zealand, Indonesia, Philippines qua Nhật Bản, Alaska và dọc theo bờ Tây châu Mỹ.

Đây là nơi tiếp giáp giữa mảng kiến tạo Thái Bình Dương với các mảng thạch quyển xung quanh. Quá trình hút chìm (subduction) liên tục nung chảy đá ngầm tạo thành các túi magma khổng lồ phun trào thành núi lửa ngầm và khe thủy nhiệt (hydrothermal vents). Đáy biển sâu tại đây cũng sản sinh ra các loài sinh vật chịu nhiệt dị dưỡng phi thường như giun ống khổng lồ, cua tuyết và vi khuẩn hóa tự dưỡng.`,
      cover_url:
        "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&auto=format&fit=crop&q=80",
      cover_caption: "Hẻm vực biển sâu và hoạt động kiến tạo địa chất ngầm dưới đại dương",
      category_id: categoryMap["fun-facts"],
      is_featured: true,
      status: "published",
      view_count: 2490n,
      published_at: new Date(Date.now() - 3600 * 1000 * 48),
    },
    {
      title: "Phục hồi 500 cụm rạn san hô tại vùng biển Nha Trang",
      slug: "phuc-hoi-500-cum-ran-san-ho-nha-trang",
      excerpt:
        "Viện Hải dương học phối hợp cùng các tổ chức phi chính phủ đã hoàn tất giai đoạn 1 của dự án cấy ghép và phục hồi san hô nhánh tại khu bảo tồn Hòn Mun.",
      content: `Sau những đợt tẩy trắng do hiện tượng El Niño, rạn san hô tại Hòn Mun (vịnh Nha Trang) đang dần hồi sinh nhờ phương pháp nuôi cấy vườn ươm san hô nhân tạo (coral nursery).

Hơn 500 giá thể san hô cứng thuộc chi Acropora và Pocillopora đã được cấy ghép thành công xuống đáy biển ở độ sâu 6-8 mét. Tỷ lệ sống sót sau 6 tháng theo dõi đạt hơn 82%, thu hút đàn cá con và các loài giáp xác quay trở lại làm tổ.`,
      cover_url:
        "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1200&auto=format&fit=crop&q=80",
      cover_caption: "San hô nhánh phát triển khỏe mạnh trên các giá thể nhân tạo",
      category_id: categoryMap["conservation"],
      is_featured: false,
      status: "published",
      view_count: 980n,
      published_at: new Date(Date.now() - 3600 * 1000 * 72),
    },
  ];

  for (const art of articlesData) {
    await prisma.news_articles.upsert({
      where: { slug: art.slug },
      update: {
        title: art.title,
        excerpt: art.excerpt,
        content: art.content,
        cover_url: art.cover_url,
        cover_caption: art.cover_caption,
        category_id: art.category_id,
        is_featured: art.is_featured,
        status: art.status,
      },
      create: {
        title: art.title,
        slug: art.slug,
        excerpt: art.excerpt,
        content: art.content,
        cover_url: art.cover_url,
        cover_caption: art.cover_caption,
        category_id: art.category_id,
        is_featured: art.is_featured,
        status: art.status,
        view_count: art.view_count,
        published_at: art.published_at,
      },
    });
  }

  console.log("✅ Đã nạp 5 bài viết tin tức và kiến thức đại dương mẫu thành công!");
}

seedNews()
  .catch((e) => {
    console.error("❌ Lỗi khi nạp dữ liệu tin tức:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

