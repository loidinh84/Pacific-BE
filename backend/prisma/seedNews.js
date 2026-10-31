import prisma from "../src/lib/prisma.js";

async function main() {
  console.log("🌊 Bắt đầu gieo dữ liệu (Seeding) Tin Tức & Đại Dương...");

  // Danh mục tin tức
  const categoriesData = [
    {
      name: "Bảo tồn",
      slug: "conservation",
      description: "Các chiến dịch, nỗ lực phục hồi hệ sinh thái và bảo vệ sinh vật biển",
      icon: "ShieldCheck",
      sort_order: 1,
      is_active: true,
    },
    {
      name: "Khám phá",
      slug: "discovery",
      description: "Hành trình thám hiểm đáy biển sâu và những phát hiện sinh vật kỳ thú",
      icon: "Compass",
      sort_order: 2,
      is_active: true,
    },
    {
      name: "Biển Đông",
      slug: "east-sea",
      description: "Hệ sinh thái, đa dạng sinh học và tin tức bảo tồn vùng biển Việt Nam",
      icon: "Waves",
      sort_order: 3,
      is_active: true,
    },
    {
      name: "Sự kiện",
      slug: "events",
      description: "Hội thảo quốc tế, ngày đại dương thế giới và hoạt động cộng đồng",
      icon: "Calendar",
      sort_order: 4,
      is_active: true,
    },
    {
      name: "Nghiên cứu",
      slug: "research",
      description: "Công bố khoa học, hải dương học và công nghệ nghiên cứu biển mới",
      icon: "FlaskConical",
      sort_order: 5,
      is_active: true,
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const upserted = await prisma.news_categories.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categoryMap[cat.slug] = upserted.id;
    console.log(`  ✓ Danh mục: ${cat.name} (ID: ${upserted.id})`);
  }

  // Nguồn tin tức
  const sourcesData = [
    {
      name: "Tuổi Trẻ Online",
      slug: "tuoi-tre-online",
      url: "https://tuoitre.vn",
      logo_url: "https://static.tuoitre.vn/tto/i/s60/2023/10/09/tuoitre-logo.svg",
      is_active: true,
    },
    {
      name: "VnExpress",
      slug: "vnexpress",
      url: "https://vnexpress.net",
      logo_url: "https://s1.vnecdn.net/vnexpress/restruct/i/v9546/v2_2019/pc/graphics/logo.svg",
      is_active: true,
    },
    {
      name: "NOAA Fisheries",
      slug: "noaa-fisheries",
      url: "https://www.fisheries.noaa.gov",
      logo_url: "https://www.fisheries.noaa.gov/themes/custom/noaa_components/images/noaa-fisheries-logo.svg",
      is_active: true,
    },
    {
      name: "Ban biên tập Pacific",
      slug: "pacific-editorial",
      url: "https://pacific-ocean.vn",
      logo_url: "/logo.png",
      is_active: true,
    },
  ];

  const sourceMap = {};
  for (const src of sourcesData) {
    const upserted = await prisma.news_sources.upsert({
      where: { slug: src.slug },
      update: src,
      create: src,
    });
    sourceMap[src.slug] = upserted.id;
    console.log(`  ✓ Nguồn tin: ${src.name} (ID: ${upserted.id})`);
  }

  // Tác giả bài viết
  const adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  const defaultAuthorId = adminUser ? adminUser.id : null;

  // Bài viết tin tức đại dương
  const articlesData = [
    {
      title: "Trồng san hô dưới đáy biển: những ‘thợ vườn’ của đại dương",
      slug: "trong-san-ho-duoi-day-bien-nhung-tho-vuon-cua-dai-duong",
      excerpt: "Hàng triệu rạn san hô trên khắp các vùng biển nhiệt đới đang bị tẩy trắng. Những thợ lặn, nhà khoa học trẻ tại Việt Nam đang miệt mài ươm mầm san hô dưới đáy biển như những thợ làm vườn kiên nhẫn.",
      content: `<p>Biến đổi khí hậu và nhiệt độ nước biển tăng cao đang đe dọa nghiêm trọng đến các rạn san hô toàn cầu. Trước thực trạng này, các nhà nghiên cứu và tình nguyện viên tại Việt Nam đã triển khai các dự án ươm cấy và phục hồi san hô quy mô lớn.</p>
<p>Dưới sự hỗ trợ của các chuyên gia hải dương học, các nhánh san hô khỏe mạnh được cắt tỉa, gắn lên các giá thể nhân tạo dưới đáy biển và chăm sóc định kỳ cho đến khi hình thành các rạn san hô tự nhiên mới, tạo môi trường sống an toàn cho hàng trăm loài cá rạn.</p>`,
      cover_url: "https://cdn2.tuoitre.vn/zoom/1200_630/471584752817336320/2025/2/1/z62791105360851621435553749410145b8b9b2fc3aaf3-17383998825421975168620-73-0-638-1080-crop-1738400398614249033790.jpg",
      cover_caption: "Nhiều bạn trẻ và thợ lặn tình nguyện bắt tay vào việc tái tạo, phục hồi san hô tại vịnh Nha Trang. Ảnh: Tuổi Trẻ",
      language: "vi",
      source_type: "external",
      external_url: "https://tuoitre.vn/trong-san-ho-duoi-day-bien-nhung-tho-vuon-cua-dai-duong-20250201144023802.htm",
      status: "published",
      is_featured: true,
      view_count: 1420n,
      category_id: categoryMap["conservation"],
      source_id: sourceMap["tuoi-tre-online"],
      author_id: defaultAuthorId,
      published_at: new Date("2025-02-01T14:40:00Z"),
    },
    {
      title: "92 rùa con nở, trở về biển ở Hòn Cau",
      slug: "92-rua-con-no-tro-ve-bien-o-hon-cau",
      excerpt: "Ổ trứng rùa biển gồm 92 cá thể rùa con sau gần hai tháng ấp nở tại Khu bảo tồn biển Hòn Cau đã bò khỏe mạnh xuống đại dương trong sự bảo vệ của các tình nguyện viên.",
      content: `<p>Khu bảo tồn biển Hòn Cau vừa ghi nhận thêm một đợt thả rùa biển thành công về tự nhiên. 92 cá thể rùa con sau chu kỳ ấp trứng nghiêm ngặt đã vươn mình ra biển lớn.</p>
<p>Công tác bảo tồn rùa biển tại Hòn Cau được duy trì liên tục nhiều năm qua với sự tuần tra gắt gao của ban quản lý và các đội tình nguyện viên nhằm bảo vệ tổ rùa trước các nguy cơ thiên địch và nạn trộm trứng.</p>`,
      cover_url: "https://i2-vnexpress.vnecdn.net/2026/10/31/Ruacon-1793418515-5795-1793418526.jpg?w=1200&h=675&q=100&dpr=1&fit=crop&s=mxUPFR8MN4FsDdOICbEptg",
      cover_caption: "Rùa con nở rời ổ, bơi về mép nước cách bãi ấp 4 m tại khu bảo tồn biển Hòn Cau, sáng 31/10. Ảnh: Yến Phi",
      language: "vi",
      source_type: "external",
      external_url: "https://vnexpress.net/92-rua-con-no-tro-ve-bien-o-hon-cau-5139079.html",
      status: "published",
      is_featured: true,
      view_count: 2850n,
      category_id: categoryMap["conservation"],
      source_id: sourceMap["vnexpress"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-25T08:00:00Z"),
    },
    {
      title: "Cá heo màu hồng bơi giữa biển khiến giới khoa học bối rối",
      slug: "ca-heo-mau-hong-boi-giua-bien-khien-gioi-khoa-hoc-boi-roi",
      excerpt: "Sự xuất hiện của cá thể cá heo màu hồng bơi lội tung tăng ngoài khơi thu hút sự tò mò của các chuyên gia hải dương học về đột biến sắc tố gen hiếm gặp.",
      content: `<p>Hình ảnh một chú cá heo mang sắc hồng nổi bật vừa được các ngư dân và nhà nghiên cứu ghi lại ngoài khơi đã lan truyền mạnh mẽ trên mạng xã hội.</p>
<p>Các nhà sinh vật học biển nhận định đây có thể là hiện tượng bạch tạng một phần hoặc đột biến sắc tố hiếm ở loài cá heo mũi chai, đòi hỏi thêm các nghiên cứu và theo dõi để đảm bảo an toàn cho cá thể đặc biệt này trong tự nhiên.</p>`,
      cover_url: "https://cdn2.tuoitre.vn/zoom/1200_630/471584752817336320/2026/10/21/ezgif-23c8a0cf59bc99a0-17925847215381007538815-0-0-279-532-crop-17925852539941453564291.gif.png",
      cover_caption: "Cá heo màu hồng bơi ngoài khơi Oman gây sốt trên mạng xã hội. Ảnh: Tuổi Trẻ",
      language: "vi",
      source_type: "external",
      external_url: "https://tuoitre.vn/ca-heo-mau-hong-boi-giua-bien-khien-gioi-khoa-hoc-boi-roi-100261021194108688.htm",
      status: "published",
      is_featured: false,
      view_count: 980n,
      category_id: categoryMap["discovery"],
      source_id: sourceMap["tuoi-tre-online"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-21T19:41:00Z"),
    },
    {
      title: "12 Shark Facts That May Surprise You",
      slug: "12-shark-facts-that-may-surprise-you",
      excerpt: "Cá mập không chỉ là những kẻ săn mồi đỉnh cao mà còn là loài sinh vật cổ xưa đã tồn tại trước cả cây cối, sở hữu giác quan cảm nhận điện từ trường độc nhất vô nhị.",
      content: `<p>Cá mập thường bị hiểu lầm là những sinh vật hung dữ nguy hiểm, nhưng trên thực tế chúng đóng vai trò tối quan trọng trong việc cân bằng chuỗi thức ăn đại dương.</p>
<p>Theo công bố từ Cơ quan Khí quyển và Đại dương Quốc gia Mỹ (NOAA), cá mập đã xuất hiện trên Trái Đất hơn 400 triệu năm. Chúng có cơ quan thụ cảm ampullae of Lorenzini cho phép phát hiện xung điện cực nhỏ từ con mồi đang ẩn nấp.</p>`,
      cover_url: "https://www.fisheries.noaa.gov/s3/dam-migration/750x500-shortfin-mako-mark-conlin-swfsc.jpg",
      cover_caption: "Cá mập vây ngắn Mako (Shortfin Mako) bơi trong vùng biển khơi. Ảnh: Mark Conlin / SWFSC / NOAA Fisheries",
      language: "vi",
      source_type: "external",
      external_url: "https://www.fisheries.noaa.gov/feature-story/12-shark-facts-may-surprise-you",
      status: "published",
      is_featured: false,
      view_count: 3120n,
      category_id: categoryMap["discovery"],
      source_id: sourceMap["noaa-fisheries"],
      author_id: defaultAuthorId,
      published_at: new Date("2024-07-15T10:00:00Z"),
    },
    {
      title: "Rác từ lồng tôm hùm bủa vây bờ biển Cam Ranh",
      slug: "rac-tu-long-tom-hum-bua-vay-bo-bien-cam-ranh",
      excerpt: "Hàng trăm tấn phao xốp, lưới rách và rác thải nhựa phát sinh từ hoạt động nuôi trồng hải sản trôi dạt vào bãi tắm Cam Ranh, gióng lên hồi chuông cảnh báo về quản lý chất thải ven bờ.",
      content: `<p>Tình trạng rác thải từ nghề nuôi tôm hùm lồng bè trôi dạt phủ kín nhiều đoạn bờ biển tại vịnh Cam Ranh đang ảnh hưởng nghiêm trọng tới cảnh quan du lịch và hệ sinh thái ven biển.</p>
<p>Chính quyền địa phương và các đoàn viên thanh niên đã tổ chức nhiều chiến dịch ra quân dọn dẹp hàng chục tấn phao xốp, đồng thời kêu gọi các hộ nuôi nâng cao trách nhiệm trong việc thu gom vật liệu sau thu hoạch.</p>`,
      cover_url: "https://i2-vnexpress.vnecdn.net/2026/10/29/longbe-1793270788-5772-1793271141.jpg?w=1200&h=675&q=100&dpr=1&fit=crop&s=PGVTXV4ztoerT8WKKHwBng",
      cover_caption: "Rác từ lưới nhựa lồng nuôi tôm hùm thải ra ở bãi biển thôn Bình Lập, xã Nam Cam Ranh. Ảnh: Nguyễn Thông",
      language: "vi",
      source_type: "external",
      external_url: "https://vnexpress.net/rac-tu-long-tom-hum-bua-vay-bo-bien-cam-ranh-5138277.html",
      status: "published",
      is_featured: false,
      view_count: 1650n,
      category_id: categoryMap["east-sea"],
      source_id: sourceMap["vnexpress"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-26T09:00:00Z"),
    },
    {
      title: "Con tàu huyền thoại từng chở các tổng thống Mỹ sắp thành rạn san hô lớn nhất thế giới",
      slug: "con-tau-huyen-thoai-tung-cho-cac-tong-thong-my-sap-thanh-ran-san-ho-lon-nhat-the-gioi",
      excerpt: "Tàu viễn dương lịch sử SS United States đang được chuẩn bị để đánh chìm có kiểm soát ngoài khơi Vịnh Mexico, tạo thành cấu trúc rạn san hô nhân tạo khổng lồ cho sinh vật biển trú ngụ.",
      content: `<p>Con tàu huyền thoại SS United States từng chở nhiều đời tổng thống Mỹ sắp bước vào vòng đời mới đầy ý nghĩa dưới đáy đại dương.</p>
<p>Dự án biến xác tàu thành rạn san hô nhân tạo lớn nhất thế giới không chỉ tạo nơi trú ẩn an toàn cho hàng ngàn loài thủy sinh mà còn mở ra điểm lặn thám hiểm kỳ thú cho giới đam mê khám phá biển sâu.</p>`,
      cover_url: "https://cdn2.tuoitre.vn/zoom/1200_630/471584752817336320/2026/10/29/kh-tau-ss-united-states-179324703423648845562-84-0-503-800-crop-17932470498311317731738.jpg",
      cover_caption: "Tàu viễn dương lịch sử SS United States chuẩn bị được đánh chìm làm rạn san hô nhân tạo lớn nhất thế giới tại vịnh Mexico. Ảnh: AP / Tuổi Trẻ",
      language: "vi",
      source_type: "external",
      external_url: "https://tuoitre.vn/con-tau-huyen-thoai-tung-cho-cac-tong-thong-my-sap-thanh-ran-san-ho-lon-nhat-the-gioi-100261029111654389.htm",
      status: "published",
      is_featured: false,
      view_count: 1210n,
      category_id: categoryMap["events"],
      source_id: sourceMap["tuoi-tre-online"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-29T11:16:00Z"),
    },
    {
      title: "Phát hiện lưỡng cư cổ đại có thể sống suốt đời dưới biển",
      slug: "phat-hien-luong-cu-co-dai-co-the-song-suot-doi-duoi-bien",
      excerpt: "Hóa thạch mới được khai quật cho thấy các loài động vật lưỡng cư nguyên thủy đã thích nghi với môi trường nước mặn đại dương hàng trăm triệu năm trước khi các loài bò sát biển xuất hiện.",
      content: `<p>Nghiên cứu mới công bố trên tạp chí khoa học quốc tế vừa hé lộ một loài lưỡng cư cổ đại có khả năng sinh sống và thích nghi hoàn toàn trong môi trường nước biển mặn.</p>
<p>Phát hiện này làm thay đổi nhiều giả thuyết trước đây về lịch sử tiến hóa và khả năng điều hòa thẩm thấu của các loài động vật có xương sống thời kỳ đầu.</p>`,
      cover_url: "https://cdn2.tuoitre.vn/zoom/1200_630/471584752817336320/2026/10/27/kh-luong-cu-boc-thep-17930862571091892217145-0-0-419-800-crop-1793086289241155177689.jpg",
      cover_caption: "Hóa thạch loài lưỡng cư bọc thép cổ đại được khai quật cho thấy khả năng sinh sống trọn đời dưới biển. Ảnh: Tuổi Trẻ",
      language: "vi",
      source_type: "external",
      external_url: "https://tuoitre.vn/phat-hien-luong-cu-co-dai-co-the-song-suot-doi-duoi-bien-100261027143650793.htm",
      status: "published",
      is_featured: false,
      view_count: 870n,
      category_id: categoryMap["research"],
      source_id: sourceMap["tuoi-tre-online"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-27T14:36:00Z"),
    },
    {
      title: "Hải trình khám phá rạn san hô Hòn Mun: Lá phổi xanh dưới đáy vịnh Nha Trang",
      slug: "hai-trinh-kham-pha-ran-san-ho-hon-mun-nha-trang",
      excerpt: "Phóng sự độc quyền Pacific: Cùng đội ngũ nghiên cứu thực địa lặn sâu 25m ghi nhận quá trình hồi sinh kỳ diệu của hệ sinh thái san hô sừng và đàn cá rạn sau 2 năm đóng cửa bảo vệ nghiêm ngặt.",
      content: `<h2>Kỳ tích phục hồi sinh học sau 2 năm khoanh vùng nghiêm ngặt</h2>
<p>Nằm cách cảng Cầu Đá khoảng 10km về phía Đông Nam, đảo Hòn Mun từ lâu được xem là trung tâm đa dạng sinh học biển bậc nhất của Việt Nam. Nơi đây từng ghi nhận hơn 350 loài san hô tạo rạn cứng cùng hàng nghìn loài sinh vật tầng đáy.</p>
<p>Sau những tổn thương do bão cát và hiện tượng nhiệt độ nước biển tăng năm 2022, quyết định tạm ngưng các hoạt động lặn biển giải trí đã mang lại khoảng không gian yên tĩnh vô giá để thiên nhiên tự chữa lành.</p>
<blockquote>"Những cụm san hô cành (Acropora) và san hô khối lớn (Porites) đang phát triển với tốc độ đầy lạc quan, đạt mức tăng trưởng trung bình 2.5 - 4cm mỗi năm." — Tiến sĩ Đặng Hải Nam, Viện Hải dương học.</blockquote>
<h2>Ứng dụng công nghệ giám sát quang trắc và định danh AI</h2>
<p>Trong đợt khảo sát mới nhất vào quý 3/2026, nhóm nghiên cứu đã áp dụng thiết bị lặn điều khiển từ xa (ROV) kết hợp mô hình AI phân loại sinh vật của Pacific để lập bản đồ 3D đáy biển. Kết quả cho thấy mật độ cá con và giáp xác đã tăng gần 40% so với cùng kỳ.</p>
<p>Pacific sẽ tiếp tục đồng hành và cập nhật những dữ liệu định kỳ nhất về tiến trình phục hồi của vùng biển quý giá này.</p>`,
      cover_url: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=1200&q=80",
      cover_caption: "Rạn san hô Hòn Mun hồi sinh sau 2 năm khoanh vùng bảo vệ nghiêm ngặt. Ảnh: Viện Hải dương học & Pacific",
      language: "vi",
      source_type: "internal",
      external_url: null,
      status: "published",
      is_featured: true,
      view_count: 3410n,
      category_id: categoryMap["east-sea"],
      source_id: sourceMap["pacific-editorial"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-28T09:30:00Z"),
    },
    {
      title: "Khám phá vùng bình minh tối: Những sinh vật tự phát quang dưới rãnh Mariana",
      slug: "kham-pha-vung-binh-minh-toi-sinh-vat-tu-phat-quang-mariana",
      excerpt: "Ở độ sâu hơn 1.000 mét nơi ánh mặt trời không bao giờ chạm tới, các loài sinh vật biển sâu tạo nên màn trình diễn ánh sáng sinh học rực rỡ để săn mồi và liên lạc.",
      content: `<h2>Thế giới huyền bí ở tầng trung áp và vực thẳm</h2>
<p>Tầng trung áp (Mesopelagic zone, độ sâu từ 200m đến 1.000m) thường được mệnh danh là "vùng hoàng hôn của biển cả". Xuống sâu hơn nữa, bóng tối hoàn toàn bao trùm đáy đại dương.</p>
<p>Để sinh tồn trong điều kiện áp suất hàng trăm atmosphere và nhiệt độ xấp xỉ 2°C, hơn 75% sinh vật biển sâu đã tiến hóa khả năng phát quang sinh học (Bioluminescence). Phản ứng hóa học giữa phân tử luciferin và enzyme luciferase tạo ra ánh sáng lạnh màu lục lam xuyên thấu qua cột nước.</p>
<h2>Chức năng kỳ diệu của cơ quan phát sáng</h2>
<ul>
  <li><strong>Ngụy trang xóa bóng (Counter-illumination):</strong> Phát sáng từ bụng để hòa vào ánh sáng mờ nhạt từ trên mặt biển, khiến kẻ săn mồi bên dưới không phát hiện ra.</li>
  <li><strong>Mồi nhử con mồi:</strong> Cá vây chân (Anglerfish) sử dụng "cần câu" phát sáng nhử cá nhỏ bơi thẳng vào miệng.</li>
  <li><strong>Báo động và cảnh báo:</strong> Phun dịch lỏng phát quang làm lóa mắt kẻ thù trong tích tắc để tẩu thoát.</li>
</ul>
<p>Mỗi chuyến thám hiểm rãnh Mariana là một lần nhân loại nhận ra sự sống trên Trái Đất kiên cường và phong phú vượt xa mọi trí tưởng tượng.</p>`,
      cover_url: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80",
      cover_caption: "Sinh vật phát quang sinh học tại rãnh Mariana ở độ sâu hơn 1.000m. Ảnh: NOAA Ocean Exploration",
      language: "vi",
      source_type: "internal",
      external_url: null,
      status: "published",
      is_featured: false,
      view_count: 2150n,
      category_id: categoryMap["discovery"],
      source_id: sourceMap["pacific-editorial"],
      author_id: defaultAuthorId,
      published_at: new Date("2026-10-24T15:00:00Z"),
    },
  ];

  for (const art of articlesData) {
    const upserted = await prisma.news_articles.upsert({
      where: { slug: art.slug },
      update: art,
      create: art,
    });
    console.log(`  ✓ Bài viết: ${art.title.slice(0, 45)}... (ID: ${upserted.id})`);
  }

  console.log("🎉 Hoàn tất gieo dữ liệu Tin tức & Nguồn bài viết đại dương!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed news:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
