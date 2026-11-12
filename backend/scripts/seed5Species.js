import prisma from "../src/lib/prisma.js";

/**
 * Script nạp 5 loài sinh vật biển tiêu biểu vào cơ sở dữ liệu Neon
 * Bao gồm:
 * 1. Đảm bảo nhóm loài (species_groups)
 * 2. Thông số sinh học chi tiết (kích thước, cân nặng, độ sâu, phân loại)
 * 3. Hình ảnh bản quyền mở HD (species_media)
 * 4. Hệ thống giải phẫu sinh học chuyên sâu (species_anatomy)
 * 5. Sự thật thú vị (species_facts)
 * 6. Bản dịch đa ngôn ngữ vi/en (species_translations)
 */

async function seedFiveSpecies() {
  console.log("🌊 [PACIFIC SEED] Đang chuẩn bị nạp 5 loài sinh vật biển...");

  // 1. Tạo các nhóm sinh vật biển (species_groups)
  const groupsData = [
    { name: "Cá sụn", slug: "cartilage-fish", description: "Các loài cá có bộ xương cấu tạo từ sụn thay vì xương cứng (Cá mập, cá đuối)." },
    { name: "Động vật biển có vú", slug: "mammal", description: "Các loài thú sinh sống trong môi trường biển, thở bằng phổi và nuôi con bằng sữa (Cá voi, cá heo, bò biển)." },
    { name: "Cá xương", slug: "bony-fish", description: "Nhóm cá đông đảo nhất với bộ xương cứng và bong bóng cá điều chỉnh độ nổi." },
    { name: "Bò sát & Rùa biển", slug: "turtle", description: "Các loài rùa biển và rắn biển thích nghi với môi trường đại dương nhiệt đới." },
    { name: "Thân mềm", slug: "mollusk", description: "Nhóm động vật không xương sống bao gồm bạch tuộc, mực, ốc và sò biển." },
  ];

  const groupMap = new Map();
  for (const g of groupsData) {
    const record = await prisma.species_groups.upsert({
      where: { slug: g.slug },
      update: { name: g.name, description: g.description },
      create: { name: g.name, slug: g.slug, description: g.description },
    });
    groupMap.set(g.slug, record.id);
  }
  console.log("✅ Đã sẵn sàng 5 nhóm sinh vật biển.");

  // Lấy danh sách trạng thái bảo tồn
  const statuses = await prisma.conservation_statuses.findMany();
  const statusMap = new Map(statuses.map((s) => [s.code, s.id]));

  // Lấy danh sách tầng biển (1: Mặt, 2: Trung, 3: Sâu, 4: Thẳm, 5: Vực)
  const zones = await prisma.ocean_zones.findMany();
  const zoneMap = new Map(zones.map((z, idx) => [idx + 1, z.id]));

  // 2. Dữ liệu chi tiết 5 loài
  const speciesData = [
    {
      code: "SPECIES_GWS_01",
      slug: "great-white-shark-1",
      scientificName: "Carcharodon carcharias",
      common_name: "Cá Mập Trắng Lớn",
      group_slug: "cartilage-fish",
      status_code: "VU",
      zone_index: 1, // Tầng mặt (0 - 250m)
      description: "Carcharodon carcharias là loài cá săn mồi ăn thịt lớn nhất còn sinh tồn trên Trái Đất. Được mệnh danh là 'hung thần đại dương', chúng có khứu giác siêu việt và hệ thống cảm biến điện trường định vị con mồi chính xác.",
      diet: "Động vật ăn thịt đỉnh cao: Hải cẩu, cá heo nhỏ, rùa biển, cá ngừ đại dương",
      size_min_cm: 340,
      size_max_cm: 640,
      weight_min_kg: 680,
      weight_max_kg: 2270,
      lifespan_years: 70,
      depth_min_m: 0,
      depth_max_m: 250,
      temperature_min_c: 12,
      temperature_max_c: 24,
      model_3d_url: "/models/shark.glb",
      vietnam_red_list_status: "VU",
      vietnam_protection_group: "Nhóm IIB - Hạn chế khai thác",
      cites_appendix: "Phụ lục II",
      east_sea_zone: "Vùng biển Hoàng Sa, Trường Sa và vùng khơi Nam Trung Bộ",
      local_distribution: "Vùng biển Khánh Hòa, Bình Thuận, Ninh Thuận, Côn Đảo",
      media: [
        {
          url: "https://inaturalist-open-data.s3.amazonaws.com/photos/755951225/large.jpg",
          caption: "Cá mập trắng lớn bơi tuần tra ngoài tự nhiên (iNaturalist Verified)",
          is_primary: true,
        },
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/5/56/White_shark.jpg",
          caption: "Cận cảnh Carcharodon carcharias với hàm răng hình tam giác đặc trưng",
          is_primary: false,
        },
      ],
      facts: [
        "Có thể phát hiện một giọt máu hòa tan trong 100 lít nước biển từ khoảng cách hàng trăm mét.",
        "Sở hữu hơn 300 chiếc răng hình tam giác xếp thành nhiều hàng, tự động thay thế liên tục trong suốt cuộc đời.",
        "Nhiệt độ cơ thể cá mập trắng có thể duy trì ấm hơn nước biển xung quanh nhờ hệ thống mạch máu trao đổi nhiệt kỳ diệu.",
      ],
      anatomy: [
        {
          part_name: "Gan dầu giàu Squalene",
          latin_name: "Hepar",
          system: "digestive",
          description: "Chiếm tới 25-30% trọng lượng cơ thể, chứa hàm lượng dầu squalene cao giúp cá mập duy trì sức nổi trung tính do chúng không có bong bóng cá.",
          hotspot_x: 48,
          hotspot_y: 52,
          sort_order: 1,
        },
        {
          part_name: "Khe mang thở",
          latin_name: "Branchiae",
          system: "respiratory",
          description: "Gồm 5 đôi khe mang riêng biệt. Nước giàu oxy chảy qua mang khi cá bơi về phía trước để trao đổi khí trực tiếp vào máu.",
          hotspot_x: 28,
          hotspot_y: 44,
          sort_order: 2,
        },
        {
          part_name: "Túi cảm ứng điện trường Lorenzini",
          latin_name: "Ampullae of Lorenzini",
          system: "nervous",
          description: "Mạng lưới các lỗ chân lông chứa đầy chất gel dẫn điện xung quanh mõm, cho phép phát hiện xung điện phát ra từ nhịp tim của con mồi.",
          hotspot_x: 12,
          hotspot_y: 38,
          sort_order: 3,
        },
        {
          part_name: "Van xoắn ruột",
          latin_name: "Valvula spiralis",
          system: "digestive",
          description: "Cấu trúc ruột hình xoắn ốc độc đáo giúp tăng tối đa diện tích bề mặt hấp thụ dinh dưỡng trong một khoang bụng ngắn.",
          hotspot_x: 58,
          hotspot_y: 56,
          sort_order: 4,
        },
        {
          part_name: "Vây đuôi dị hình hình trăng khuyết",
          latin_name: "Pinna caudalis",
          system: "muscular",
          description: "Khối cơ vây đuôi cực khỏe hình lưỡi liềm tạo lực đẩy bứt tốc tức thì lên tới 56 km/h khi tấn công con mồi.",
          hotspot_x: 88,
          hotspot_y: 45,
          sort_order: 5,
        },
      ],
    },
    {
      code: "SPECIES_BW_02",
      slug: "ca-voi-xanh",
      scientificName: "Balaenoptera musculus",
      common_name: "Cá Voi Xanh",
      group_slug: "mammal",
      status_code: "EN",
      zone_index: 1, // Tầng mặt (0 - 200m)
      description: "Cá voi xanh là sinh vật lớn nhất từng tồn tại trên Trái Đất, vượt qua cả những loài khủng long khổng lồ nhất trong quá khứ. Mặc dù có kích thước đồ sộ, thức ăn chủ yếu của chúng lại là những loài nhuyễn thể giáp xác nhỏ bé.",
      diet: "Ăn lọc sinh vật phù du: Nhuyễn thể (Krill), giáp xác nhỏ",
      size_min_cm: 2400,
      size_max_cm: 3000,
      weight_min_kg: 100000,
      weight_max_kg: 190000,
      lifespan_years: 90,
      depth_min_m: 0,
      depth_max_m: 200,
      temperature_min_c: 5,
      temperature_max_c: 20,
      vietnam_red_list_status: "EN",
      vietnam_protection_group: "Nhóm IB - Nghiêm cấm khai thác",
      cites_appendix: "Phụ lục I",
      east_sea_zone: "Vùng biển sâu Đông Nam Biển Đông và Tây Thái Bình Dương",
      local_distribution: "Thỉnh thoảng di cư qua vùng biển sâu ngoài khơi miền Trung Việt Nam",
      media: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/1/1c/Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg",
          caption: "Cá voi xanh khổng lồ nổi trên mặt biển (NOAA Fisheries Photo)",
          is_primary: true,
        },
        {
          url: "https://static.inaturalist.org/photos/194385336/large.jpg",
          caption: "Quan sát thực địa Balaenoptera musculus ngoài đại dương",
          is_primary: false,
        },
      ],
      facts: [
        "Trái tim của cá voi xanh có kích thước tương đương một chiếc xe ô tô nhỏ và nặng khoảng 180 kg.",
        "Tiếng kêu hạ âm của chúng đạt tới 188 dB, có thể truyền xa hơn 1.600 km dưới lòng đại dương.",
        "Một con cá voi xanh trưởng thành có thể tiêu thụ tới 4 tấn nhuyễn thể mỗi ngày.",
      ],
      anatomy: [
        {
          part_name: "Tấm sừng hàm lọc mồi",
          latin_name: "Baleen",
          system: "digestive",
          description: "Gồm hàng trăm tấm sừng rủ xuống từ hàm trên, hoạt động như một chiếc lưới khổng lồ lọc giữ hàng triệu con tôm nhuyễn thể khi nuốt nước biển.",
          hotspot_x: 20,
          hotspot_y: 40,
          sort_order: 1,
        },
        {
          part_name: "Tim khổng lồ 4 ngăn",
          latin_name: "Cor",
          system: "circulatory",
          description: "Bơm khoảng 10 tấn máu qua toàn bộ cơ thể khổng lồ. Nhịp tim khi lặn sâu có thể giảm xuống chỉ còn 2 nhịp/phút để tiết kiệm oxy.",
          hotspot_x: 42,
          hotspot_y: 50,
          sort_order: 2,
        },
        {
          part_name: "Lớp mỡ dưới da",
          latin_name: "Blubber",
          system: "muscular",
          description: "Lớp mỡ dày tới 30-50 cm giúp cách nhiệt hoàn hảo trước cái lạnh buốt của đại dương và là kho năng lượng dự trữ khi di cư.",
          hotspot_x: 60,
          hotspot_y: 45,
          sort_order: 3,
        },
      ],
    },
    {
      code: "SPECIES_ANGLER_03",
      slug: "ca-quy-bien-sau",
      scientificName: "Melanocetus johnsonii",
      common_name: "Cá Quỷ Biển Sâu",
      group_slug: "bony-fish",
      status_code: "LC",
      zone_index: 3, // Tầng sâu (1000 - 4000m)
      description: "Melanocetus johnsonii (Humpback Anglerfish) là biểu tượng huyền bí của tầng biển tối hoàn toàn (Midnight Zone). Loài cá này sở hữu chiếc cần câu phát quang sinh học nhô ra từ đầu để dẫn dụ con mồi giữa bóng đêm vĩnh cửu.",
      diet: "Cá biển sâu phát quang, giáp xác và mực nhỏ",
      size_min_cm: 15,
      size_max_cm: 20,
      weight_min_kg: 0.5,
      weight_max_kg: 1.5,
      lifespan_years: 15,
      depth_min_m: 1000,
      depth_max_m: 4000,
      temperature_min_c: 1,
      temperature_max_c: 4,
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Chưa có danh mục",
      cites_appendix: "Không thuộc CITES",
      east_sea_zone: "Vùng trũng đại dương sâu trung tâm Biển Đông (>2000m)",
      local_distribution: "Vùng biển sâu ngoài khơi Trường Sa và Hoàng Sa",
      media: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Humpback_anglerfish.png",
          caption: "Hình thái chuẩn xác của Cá quỷ Humpback Anglerfish với cần phát quang (NOAA)",
          is_primary: true,
        },
        {
          url: "https://inaturalist-open-data.s3.amazonaws.com/photos/468285045/large.jpg",
          caption: "Tiêu bản quan sát thực địa Melanocetus johnsonii (iNaturalist)",
          is_primary: false,
        },
      ],
      facts: [
        "Sống ở độ sâu không có ánh sáng mặt trời, chịu áp suất nước gấp hàng trăm lần so với áp suất trên cạn.",
        "Ánh sáng trên cần câu là do hàng triệu vi khuẩn phát quang sinh học phát xạ ánh sáng màu xanh lơ sống cộng sinh.",
        "Dạ dày và da có tính đàn hồi cực cao, cho phép nuốt trọn những con mồi có kích thước gấp đôi cơ thể nó.",
      ],
      anatomy: [
        {
          part_name: "Cần câu phát quang sinh học",
          latin_name: "Illicium & Esca",
          system: "nervous",
          description: "Biến dị từ gai vây lưng trước, đầu cần chứa túi vi khuẩn phát quang Esca tạo ánh sáng thu hút con mồi trong bóng tối tuyệt đối.",
          hotspot_x: 22,
          hotspot_y: 28,
          sort_order: 1,
        },
        {
          part_name: "Dạ dày co giãn cực đại",
          latin_name: "Ventriculus distensibilis",
          system: "digestive",
          description: "Khả năng mở rộng gấp đôi thể tích bình thường giúp cá quỷ tích trữ thức ăn khi săn được một bữa no giữa vùng biển sâu khan hiếm mồi.",
          hotspot_x: 52,
          hotspot_y: 60,
          sort_order: 2,
        },
      ],
    },
    {
      code: "SPECIES_TURTLE_04",
      slug: "rua-da-doi-moi-dua",
      scientificName: "Dermochelys coriacea",
      common_name: "Rùa Da (Đồi Mồi Dứa)",
      group_slug: "turtle",
      status_code: "CR",
      zone_index: 1, // Tầng mặt & trung (0 - 1280m)
      description: "Rùa Da là loài rùa biển lớn nhất thế giới. Khác biệt với mọi loài rùa khác, mai của chúng không phải là chất sừng cứng mà là một lớp da dày dẻo dai bọc lấy các phiến xương nhỏ, giúp chúng lặn sâu kỷ lục tới hơn 1.200 mét.",
      diet: "Chuyên ăn các loài sinh vật thân mềm dạng keo: Sứa biển, hải tiêu",
      size_min_cm: 180,
      size_max_cm: 220,
      weight_min_kg: 300,
      weight_max_kg: 700,
      lifespan_years: 50,
      depth_min_m: 0,
      depth_max_m: 1280,
      temperature_min_c: 8,
      temperature_max_c: 28,
      vietnam_red_list_status: "CR",
      vietnam_protection_group: "Nhóm IB - Bảo vệ nghiêm ngặt",
      cites_appendix: "Phụ lục I",
      east_sea_zone: "Vùng biển ven bờ và hải đảo từ vịnh Bắc Bộ đến vịnh Thái Lan",
      local_distribution: "Khu bảo tồn biển Côn Đảo, Cù Lao Chàm, Phú Quốc, vịnh Nha Trang",
      media: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/8/84/Leatherback_sea_turtle_eating_a_jellyfish.jpg",
          caption: "Rùa da Dermochelys coriacea đang săn sứa ngoài tự nhiên",
          is_primary: true,
        },
        {
          url: "https://inaturalist-open-data.s3.amazonaws.com/photos/244918310/large.jpg",
          caption: "Ảnh chụp thực địa Rùa da lặn biển (iNaturalist)",
          is_primary: false,
        },
      ],
      facts: [
        "Là loài bò sát di chuyển nhanh nhất trong môi trường nước, đạt tốc độ bơi lên tới 35 km/h.",
        "Có khả năng lặn sâu kỷ lục tới 1.280 mét, sâu hơn bất kỳ loài bò sát hay rùa biển nào khác.",
        "Trong cổ họng chứa hàng trăm gai nhọn Papillae hướng ngược vào trong giúp giữ chặt sứa trơn trượt không bị trôi ngược ra ngoài.",
      ],
      anatomy: [
        {
          part_name: "Mai da linh hoạt cách nhiệt",
          latin_name: "Carapax coriacius",
          system: "skeletal",
          description: "Cấu tạo từ da dày bọc dầu và sụn xốp giúp chịu áp lực nước khủng khiếp khi lặn sâu mà không bị nứt vỡ như mai xương cứng.",
          hotspot_x: 50,
          hotspot_y: 40,
          sort_order: 1,
        },
        {
          part_name: "Gai thực quản giữ mồi",
          latin_name: "Papillae esophageae",
          system: "digestive",
          description: "Các gai sừng nhọn chỉa ngược về phía dạ dày ngăn con mồi sứa trơn tuột khỏi miệng khi rùa ợ bớt nước biển ra ngoài.",
          hotspot_x: 25,
          hotspot_y: 35,
          sort_order: 2,
        },
      ],
    },
    {
      code: "SPECIES_OCTOPUS_05",
      slug: "bach-tuoc-dom-xanh",
      scientificName: "Hapalochlaena lunulata",
      common_name: "Bạch Tuộc Đốm Xanh",
      group_slug: "mollusk",
      status_code: "LC",
      zone_index: 1, // Tầng mặt (0 - 50m)
      description: "Bạch tuộc đốm xanh tuy kích thước nhỏ bé như quả bóng golf nhưng là một trong những loài sinh vật biển mang nọc độc nguy hiểm nhất thế giới. Chất độc Tetrodotoxin trong tuyến nước bọt của nó có thể làm tê liệt cơ bắp và ngừng thở chỉ trong vài phút.",
      diet: "Cua nhỏ, tôm và cá nhỏ sống ẩn nấp trong rạn san hô",
      size_min_cm: 10,
      size_max_cm: 20,
      weight_min_kg: 0.05,
      weight_max_kg: 0.1,
      lifespan_years: 2,
      depth_min_m: 0,
      depth_max_m: 50,
      temperature_min_c: 22,
      temperature_max_c: 30,
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Động vật có độc tính",
      cites_appendix: "Không thuộc CITES",
      east_sea_zone: "Các rạn san hô ven biển miền Trung và các đảo nhiệt đới Biển Đông",
      local_distribution: "Rạn san hô Ninh Thuận, Khánh Hòa, Côn Đảo, Phú Quốc",
      media: [
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/f/f2/Hapalochlaena_lunulata2.JPG",
          caption: "Bạch tuộc đốm xanh Hapalochlaena lunulata với các vòng lam cảnh báo đặc trưng",
          is_primary: true,
        },
        {
          url: "https://inaturalist-open-data.s3.amazonaws.com/photos/340386429/large.jpg",
          caption: "Ảnh lặn biển thực địa ghi nhận tại rạn san hô (iNaturalist)",
          is_primary: false,
        },
      ],
      facts: [
        "Kích thước chỉ khoảng 10-20 cm nhưng mang lượng nọc độc đủ làm tê liệt 26 người trưởng thành trong vài phút.",
        "Các đốm tròn màu xanh neon trên thân chỉ phát sáng rực rỡ khi nó cảm thấy bị đe dọa hoặc chuẩn bị tấn công.",
        "Sở hữu tới 3 quả tim và dòng máu màu xanh lam do chứa gốc đồng (Hemocyanin) để vận chuyển oxy.",
      ],
      anatomy: [
        {
          part_name: "Túi nọc độc thần kinh Tetrodotoxin",
          latin_name: "Glandula venenosa",
          system: "digestive",
          description: "Chứa chất độc thần kinh cực mạnh được tạo ra bởi vi khuẩn cộng sinh trong tuyến nước bọt sau, có tác dụng khóa kênh natri của màng tế bào thần kinh.",
          hotspot_x: 35,
          hotspot_y: 42,
          sort_order: 1,
        },
        {
          part_name: "Hệ thống 3 quả tim",
          latin_name: "Tria corda",
          system: "circulatory",
          description: "Gồm 2 tim mang (Branchial hearts) bơm máu qua mang để lấy oxy và 1 tim hệ thống (Systemic heart) bơm máu đi khắp cơ thể.",
          hotspot_x: 48,
          hotspot_y: 50,
          sort_order: 2,
        },
        {
          part_name: "Mỏ sừng dạng mỏ vẹt",
          latin_name: "Rostrum corneum",
          system: "skeletal",
          description: "Bộ phận cứng duy nhất trên cơ thể không xương, có thể cắn thủng vỏ cua tôm cứng trước khi tiêm nọc độc hóa lỏng con mồi.",
          hotspot_x: 30,
          hotspot_y: 48,
          sort_order: 3,
        },
      ],
    },
  ];

  // 3. Tiến hành lưu vào CSDL
  for (const s of speciesData) {
    const groupId = groupMap.get(s.group_slug);
    const statusId = statusMap.get(s.status_code);
    const zoneId = zoneMap.get(s.zone_index);

    console.log(`⏳ Đang xử lý: ${s.common_name} (${s.scientificName})...`);

    // Upsert bảng Species
    const createdSpecies = await prisma.species.upsert({
      where: { code: s.code },
      update: {
        scientificName: s.scientificName,
        common_name: s.common_name,
        slug: s.slug,
        group_id: groupId,
        conservation_status_id: statusId,
        ocean_zone_id: zoneId,
        description: s.description,
        diet: s.diet,
        size_min_cm: s.size_min_cm,
        size_max_cm: s.size_max_cm,
        weight_min_kg: s.weight_min_kg,
        weight_max_kg: s.weight_max_kg,
        lifespan_years: s.lifespan_years,
        depth_min_m: s.depth_min_m,
        depth_max_m: s.depth_max_m,
        temperature_min_c: s.temperature_min_c,
        temperature_max_c: s.temperature_max_c,
        model_3d_url: s.model_3d_url || null,
        vietnam_red_list_status: s.vietnam_red_list_status,
        vietnam_protection_group: s.vietnam_protection_group,
        cites_appendix: s.cites_appendix,
        east_sea_zone: s.east_sea_zone,
        local_distribution: s.local_distribution,
        is_visible: true,
      },
      create: {
        code: s.code,
        scientificName: s.scientificName,
        common_name: s.common_name,
        slug: s.slug,
        group_id: groupId,
        conservation_status_id: statusId,
        ocean_zone_id: zoneId,
        description: s.description,
        diet: s.diet,
        size_min_cm: s.size_min_cm,
        size_max_cm: s.size_max_cm,
        weight_min_kg: s.weight_min_kg,
        weight_max_kg: s.weight_max_kg,
        lifespan_years: s.lifespan_years,
        depth_min_m: s.depth_min_m,
        depth_max_m: s.depth_max_m,
        temperature_min_c: s.temperature_min_c,
        temperature_max_c: s.temperature_max_c,
        model_3d_url: s.model_3d_url || null,
        vietnam_red_list_status: s.vietnam_red_list_status,
        vietnam_protection_group: s.vietnam_protection_group,
        cites_appendix: s.cites_appendix,
        east_sea_zone: s.east_sea_zone,
        local_distribution: s.local_distribution,
        is_visible: true,
      },
    });

    const spId = createdSpecies.id;

    // Xóa media cũ và thêm media mới
    await prisma.species_media.deleteMany({ where: { species_id: spId } });
    if (s.media && s.media.length > 0) {
      await prisma.species_media.createMany({
        data: s.media.map((m, idx) => ({
          species_id: spId,
          type: "image",
          url: m.url,
          caption: m.caption,
          is_primary: m.is_primary ?? idx === 0,
          sort_order: idx + 1,
        })),
      });
    }

    // Xóa facts cũ và thêm facts mới
    await prisma.species_facts.deleteMany({ where: { species_id: spId } });
    if (s.facts && s.facts.length > 0) {
      await prisma.species_facts.createMany({
        data: s.facts.map((f, idx) => ({
          species_id: spId,
          content: f,
          sort_order: idx + 1,
        })),
      });
    }

    // Xóa anatomy cũ và thêm anatomy mới
    await prisma.species_anatomy.deleteMany({ where: { species_id: spId } });
    if (s.anatomy && s.anatomy.length > 0) {
      await prisma.species_anatomy.createMany({
        data: s.anatomy.map((a, idx) => ({
          species_id: spId,
          part_name: a.part_name,
          latin_name: a.latin_name,
          system: a.system,
          description: a.description,
          hotspot_x: a.hotspot_x,
          hotspot_y: a.hotspot_y,
          sort_order: a.sort_order ?? idx + 1,
        })),
      });
    }

    // Bản dịch tiếng Việt / Anh
    await prisma.species_translations.upsert({
      where: { species_id_language_code: { species_id: spId, language_code: "vi" } },
      update: { common_name: s.common_name, description: s.description, diet: s.diet },
      create: { species_id: spId, language_code: "vi", common_name: s.common_name, description: s.description, diet: s.diet },
    });

    console.log(`✨ Đã nạp thành công: ${s.common_name} (ID: ${spId})`);
  }

  console.log("\n🎉 HOÀN TẤT NẠP 5 LOÀI SINH VẬT BIỂN ĐẦU TIÊN VÀO NEON DATABASE!");
}

seedFiveSpecies()
  .catch((err) => {
    console.error("❌ Lỗi khi seed sinh vật:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
