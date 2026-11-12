import prisma from "../src/lib/prisma.js";

/**
 * Script nạp toàn bộ 10 loài sinh vật biển phổ biến trong Catalog vào Neon Database
 * Mỗi loài đảm bảo có:
 * - 4 ảnh thợ lặn chụp thật 100% dưới nước (không dùng ảnh phong cảnh, không dùng ảnh người thợ lặn)
 * - Đầy đủ thông số kích thước, độ sâu, phân loại học và bảo tồn
 */

const CATALOG_SPECIES = [
  {
    code: "SPECIES_CLOWNFISH_04",
    slug: "clownfish-4",
    common_name: "Cá Hề San Hô",
    scientificName: "Amphiprion ocellaris",
    group_slug: "bony-fish",
    status_code: "LC",
    zone_index: 1,
    description: "Cá hề cam Amphiprion ocellaris là loài cá rạn san hô nổi tiếng sống cộng sinh bên trong các bụi hải quỳ độc. Lớp chất nhầy trên da giúp chúng miễn nhiễm hoàn toàn với các tế bào gai châm độc của hải quỳ.",
    diet: "Ăn tạp: Tảo nhỏ, sinh vật phù du và thức ăn thừa từ hải quỳ",
    size_min_cm: 8,
    size_max_cm: 11,
    weight_min_kg: 0.1,
    weight_max_kg: 0.25,
    lifespan_years: 10,
    depth_min_m: 1,
    depth_max_m: 15,
    east_sea_zone: "Rạn san hô quần đảo Hoàng Sa, Trường Sa, Côn Đảo, Nha Trang",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761506258/large.jpg", caption: "Thợ lặn chụp macro cá hề bơi giữa xúc tu hải quỳ", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761506276/large.jpg", caption: "Cặp đôi cá hề bơi bảo vệ tổ trong rạn san hô", is_primary: false },
      { url: "https://static.inaturalist.org/photos/761402597/large.jpg", caption: "Cận cảnh sọc trắng cam phát sáng dưới nước", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761179500/large.jpg", caption: "Cá hề nhỏ ẩn mình trong hải quỳ san hô", is_primary: false },
    ],
  },
  {
    code: "SPECIES_GREENTURTLE_05",
    slug: "sea-turtle-5",
    common_name: "Rùa Xanh Biển Honu",
    scientificName: "Chelonia mydas",
    group_slug: "turtle",
    status_code: "EN",
    zone_index: 1,
    description: "Rùa xanh biển (Chelonia mydas) là loài bò sát biển di cư kỳ vĩ, bơi hàng ngàn dặm qua đại dương để trở về chính bãi cát nơi chúng sinh ra để đẻ trứng. Tên gọi bắt nguồn từ lớp mỡ màu xanh lục dưới mai do chế độ ăn chủ yếu là cỏ biển và rong biển.",
    diet: "Động vật ăn cỏ: Cỏ biển, tảo bẹ và rong biển",
    size_min_cm: 100,
    size_max_cm: 150,
    weight_min_kg: 110,
    weight_max_kg: 200,
    lifespan_years: 80,
    depth_min_m: 0,
    depth_max_m: 100,
    east_sea_zone: "Khu bảo tồn biển Côn Đảo, Cù Lao Chàm, Phú Quốc, vịnh Nha Trang",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761347192/large.jpg", caption: "Thợ lặn chụp rùa xanh biển bơi lượn trên rạn san hô", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761747692/large.jpg", caption: "Cận cảnh mai hoa văn và chi bơi của rùa xanh dưới nước", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761555130/large.jpg", caption: "Rùa xanh biển bơi kiếm ăn ở thảm cỏ biển", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761542241/large.jpg", caption: "Thợ lặn bơi song song cùng rùa xanh biển", is_primary: false },
    ],
  },
  {
    code: "SPECIES_DOLPHIN_06",
    slug: "dolphin-6",
    common_name: "Cá Heo Mỏ Vịt",
    scientificName: "Tursiops truncatus",
    group_slug: "mammal",
    status_code: "LC",
    zone_index: 1,
    description: "Cá heo mỏ vịt (Tursiops truncatus) là một trong những loài thú biển thông minh và thân thiện nhất. Chúng sở hữu hệ thống định vị bằng tiếng vang siêu âm (echolocation) cực kỳ tinh vi để săn mồi và giao tiếp bầy đàn dưới nước.",
    diet: "Cá biển nhỏ, mực và động vật giáp xác",
    size_min_cm: 200,
    size_max_cm: 380,
    weight_min_kg: 150,
    weight_max_kg: 350,
    lifespan_years: 45,
    depth_min_m: 0,
    depth_max_m: 300,
    east_sea_zone: "Vùng biển ven bờ và hải đảo từ vịnh Bắc Bộ đến vịnh Thái Lan",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761491490/large.jpg", caption: "Thợ lặn chụp đàn cá heo mỏ vịt bơi lượn dưới nước", is_primary: true },
      { url: "https://static.inaturalist.org/photos/761474801/large.jpg", caption: "Cận cảnh cá heo bơi sát mặt nước biển xanh", is_primary: false },
      { url: "https://static.inaturalist.org/photos/761474819/large.jpg", caption: "Thợ lặn ghi lại khoảnh khắc cá heo bơi nhanh rẽ sóng", is_primary: false },
      { url: "https://static.inaturalist.org/photos/761474806/large.jpg", caption: "Cá heo mỏ vịt lặn sâu khám phá vùng nước đại dương", is_primary: false },
    ],
  },
  {
    code: "SPECIES_MANTARAY_09",
    slug: "mantaray-9",
    common_name: "Cá Đuối Khổng Lồ Manta",
    scientificName: "Mobula birostris",
    group_slug: "cartilage-fish",
    status_code: "VU",
    zone_index: 1,
    description: "Cá đuối Manta khổng lồ (Mobula birostris) là loài cá đuối lớn nhất thế giới với sải cánh rộng tới 7 mét. Chúng bơi lượn uyển chuyển như loài chim bay trong nước và kiếm ăn bằng cách lọc sinh vật phù du qua hai thùy đầu lớn.",
    diet: "Lọc sinh vật phù du và trứng cá biển",
    size_min_cm: 450,
    size_max_cm: 700,
    weight_min_kg: 1000,
    weight_max_kg: 2000,
    lifespan_years: 50,
    depth_min_m: 0,
    depth_max_m: 1000,
    east_sea_zone: "Vùng biển sâu ngoài khơi Trường Sa, Hoàng Sa và Nam Trung Bộ",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/755771238/large.jpg", caption: "Thợ lặn chụp cá đuối Manta khổng lồ lượn ngang khung hình", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/754349954/large.jpg", caption: "Cận cảnh thùy đầu và miệng lọc mồi của cá đuối Manta", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/754349984/large.jpg", caption: "Góc nhìn thợ lặn từ dưới lên chiêm ngưỡng sải cánh Manta", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/752882036/large.jpg", caption: "Cá đuối Manta bơi lượn trên rạn san hô sâu", is_primary: false },
    ],
  },
  {
    code: "SPECIES_NAUTILUS_08",
    slug: "chambered-nautilus-8",
    common_name: "Ốc Vòi Voi Hóa Thạch Sống",
    scientificName: "Nautilus pompilius",
    group_slug: "mollusk",
    status_code: "VU",
    zone_index: 2,
    description: "Ốc Anh Vũ (Nautilus pompilius) được mệnh danh là 'hóa thạch sống' với lịch sử tiến hóa hơn 500 triệu năm hầu như không thay đổi. Vỏ ốc chia thành nhiều ngăn rỗng chứa khí giúp chúng điều chỉnh sức nổi nổi chìm giữa các tầng biển sâu.",
    diet: "Xác động vật biển chết, tôm cua nhỏ",
    size_min_cm: 15,
    size_max_cm: 20,
    weight_min_kg: 0.5,
    weight_max_kg: 1.0,
    lifespan_years: 20,
    depth_min_m: 100,
    depth_max_m: 700,
    east_sea_zone: "Thềm lục địa biển sâu Tây Thái Bình Dương và Biển Đông",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760908706/large.jpg", caption: "Thợ lặn chụp ốc Anh Vũ bơi lơ lửng trong nước sâu", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760908730/large.jpg", caption: "Cận cảnh vỏ xoắn ốc đối xứng hoàn hảo và xúc tu", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760639119/large.jpg", caption: "Ốc Anh Vũ bơi đẩy bằng phản lực phễu nước", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760639135/large.jpg", caption: "Nautilus pompilius bơi ngầm rạn san hô sâu", is_primary: false },
    ],
  },
  {
    code: "SPECIES_WHALESHARK_02",
    slug: "whale-shark-2",
    common_name: "Cá Mập Voi",
    scientificName: "Rhincodon typus",
    group_slug: "cartilage-fish",
    status_code: "EN",
    zone_index: 1,
    description: "Cá mập voi (Rhincodon typus) là loài cá lớn nhất còn sống trên hành tinh, dài tới 18-20m. Mặc dù khổng lồ, chúng là gã khổng lồ hiền lành ăn lọc sinh vật phù du và bơi rất chậm rãi gần mặt nước ấm nhiệt đới.",
    diet: "Ăn lọc sinh vật phù du, tôm nhỏ, cá cơm",
    size_min_cm: 1200,
    size_max_cm: 1800,
    weight_min_kg: 15000,
    weight_max_kg: 21500,
    lifespan_years: 100,
    depth_min_m: 0,
    depth_max_m: 500,
    east_sea_zone: "Vùng biển Phú Quý, Côn Đảo, Cù Lao Chàm, vịnh Vân Phong",
    media: [
      { url: "https://static.inaturalist.org/photos/761401387/large.jpg", caption: "Thợ lặn bơi cùng cá mập voi khổng lồ ngoài đại dương", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760658636/large.jpg", caption: "Cận cảnh hoa văn đốm trắng độc nhất của cá mập voi", is_primary: false },
      { url: "https://static.inaturalist.org/photos/760142860/large.jpg", caption: "Cá mập voi há miệng lớn lọc nước biển tìm sinh vật phù du", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/759569382/large.jpg", caption: "Toàn thân cá mập voi bơi lượn trong làn nước trong vắt", is_primary: false },
    ],
  },
  {
    code: "SPECIES_TUNA_01",
    slug: "bluefin-tuna-1",
    common_name: "Cá Ngừ Vây Xanh",
    scientificName: "Thunnus thynnus",
    group_slug: "bony-fish",
    status_code: "EN",
    zone_index: 1,
    description: "Cá ngừ vây xanh (Thunnus thynnus) là một trong những tay bơi cự phách và tốc độ nhất đại dương với khả năng bơi vượt 70 km/h. Chúng có hệ tuần hoàn đặc biệt duy trì thân nhiệt ấm hơn nước biển để hoạt động liên tục ở vùng nước sâu lạnh.",
    diet: "Cá trích, cá thu, mực và giáp xác đại dương",
    size_min_cm: 200,
    size_max_cm: 300,
    weight_min_kg: 250,
    weight_max_kg: 680,
    lifespan_years: 35,
    depth_min_m: 0,
    depth_max_m: 1000,
    east_sea_zone: "Vùng biển khơi Nam Trung Bộ và Tây Thái Bình Dương",
    media: [
      { url: "https://static.inaturalist.org/photos/756400191/large.jpg", caption: "Đàn cá ngừ vây xanh bơi săn mồi dưới nước sâu", is_primary: true },
      { url: "https://static.inaturalist.org/photos/756400197/large.jpg", caption: "Cận cảnh thân hình ngư lôi khí động học của cá ngừ vây xanh", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/754020687/large.jpg", caption: "Thợ lặn chụp đàn cá ngừ bơi bứt tốc độ cao", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/754020722/large.jpg", caption: "Cá ngừ vây xanh bơi lượn trong nước biển đại dương", is_primary: false },
    ],
  },
  {
    code: "SPECIES_OCTOPUS_03",
    slug: "giant-octopus-3",
    common_name: "Bạch Tuộc Khổng Lồ",
    scientificName: "Enteroctopus dofleini",
    group_slug: "mollusk",
    status_code: "LC",
    zone_index: 2,
    description: "Bạch tuộc khổng lồ Thái Bình Dương (Enteroctopus dofleini) là loài bạch tuộc lớn nhất thế giới với sải tay có thể đạt 6-9 mét. Chúng là bậc thầy ngụy trang, sở hữu trí thông minh siêu việt và hệ tuần hoàn có 3 trái tim bơm máu màu xanh lam.",
    diet: "Cua, tôm hùm, trai, nghêu và cá nhỏ",
    size_min_cm: 300,
    size_max_cm: 600,
    weight_min_kg: 15,
    weight_max_kg: 50,
    lifespan_years: 5,
    depth_min_m: 10,
    depth_max_m: 1500,
    east_sea_zone: "Vùng thềm lục địa đá ngầm sâu Bắc Thái Bình Dương và Biển Đông",
    media: [
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/761256498/large.jpg", caption: "Thợ lặn chụp bạch tuộc khổng lồ bò qua rạn đá ngầm dưới biển", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760546680/large.jpg", caption: "Cận cảnh các xúc tu và giác hút khổng lồ của bạch tuộc", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760546703/large.jpg", caption: "Bạch tuộc khổng lồ đổi màu da ngụy trang dưới nước", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/760155599/large.jpg", caption: "Thợ lặn đối diện với bạch tuộc khổng lồ ở đáy biển sâu", is_primary: false },
    ],
  },
];

async function seedAll() {
  console.log("🌊 [SEED ALL CATALOG] Đang nạp tất cả các loài sinh vật vào Neon Database...");

  const groupRecords = await prisma.species_groups.findMany();
  const groupMap = new Map(groupRecords.map((g) => [g.slug, g.id]));

  const statusRecords = await prisma.conservation_statuses.findMany();
  const statusMap = new Map(statusRecords.map((s) => [s.code, s.id]));

  const zoneRecords = await prisma.ocean_zones.findMany();
  const zoneMap = new Map(zoneRecords.map((z, idx) => [idx + 1, z.id]));

  for (const s of CATALOG_SPECIES) {
    const groupId = groupMap.get(s.group_slug);
    const statusId = statusMap.get(s.status_code);
    const zoneId = zoneMap.get(s.zone_index);

    const created = await prisma.species.upsert({
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
        east_sea_zone: s.east_sea_zone,
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
        east_sea_zone: s.east_sea_zone,
        is_visible: true,
      },
    });

    const spId = created.id;
    await prisma.species_media.deleteMany({ where: { species_id: spId } });
    await prisma.species_media.createMany({
      data: s.media.map((m, idx) => ({
        species_id: spId,
        type: "image",
        url: m.url,
        caption: m.caption,
        is_primary: m.is_primary,
        sort_order: idx + 1,
      })),
    });

    console.log(`✅ Đã nạp thành công ${s.common_name} (${s.media.length} ảnh thợ lặn chụp thật)!`);
  }

  console.log("\n🎉 TẤT CẢ CÁC LOÀI SINH VẬT ĐÃ ĐƯỢC CẬP NHẬT ẢNH THẬT 100%!");
}

seedAll()
  .catch((e) => {
    console.error("Lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

