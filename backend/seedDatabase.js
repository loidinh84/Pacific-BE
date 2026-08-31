/**
 * seedDatabase.js
 * Comprehensive Seed Script for Master & Reference Data
 * - species_groups
 * - conservation_statuses
 * - ocean_zones
 * - locations
 * - languages
 */

import prisma from "./src/lib/prisma.js";

async function seed() {
  console.log("🌱 Starting Comprehensive Master Data Seeding...");

  // 1. LANGUAGES
  console.log("1. Seeding Languages...");
  const languages = [
    { code: "vi", name: "Tiếng Việt", is_active: true, is_default: true },
    { code: "en", name: "English", is_active: true, is_default: false },
  ];
  for (const lang of languages) {
    await prisma.languages.upsert({
      where: { code: lang.code },
      update: { name: lang.name, is_active: lang.is_active, is_default: lang.is_default },
      create: lang,
    });
  }

  // 2. CONSERVATION STATUSES (IUCN 9 Standard Categories)
  console.log("2. Seeding Conservation Statuses...");
  const statuses = [
    { id: 1, code: "LC", name: "Least Concern - Ít lo ngại" },
    { id: 2, code: "NT", name: "Near Threatened - Sắp bị đe dọa" },
    { id: 3, code: "VU", name: "Vulnerable - Sắp nguy cấp" },
    { id: 4, code: "EN", name: "Endangered - Nguy cấp" },
    { id: 5, code: "CR", name: "Critically Endangered - Cực kỳ nguy cấp" },
    { id: 6, code: "EW", name: "Extinct in the Wild - Tuyệt chủng trong tự nhiên" },
    { id: 7, code: "EX", name: "Extinct - Tuyệt chủng" },
    { id: 8, code: "DD", name: "Data Deficient - Thiếu dữ liệu" },
    { id: 9, code: "NE", name: "Not Evaluated - Chưa đánh giá" },
  ];
  for (const s of statuses) {
    await prisma.conservation_statuses.upsert({
      where: { id: s.id },
      update: { code: s.code, name: s.name },
      create: s,
    });
  }

  // 3. OCEAN ZONES (5 Depth Layers)
  console.log("3. Seeding Ocean Zones...");
  const zones = [
    {
      id: 1,
      name: "Tầng mặt (Sunlight / Epipelagic)",
      depth_min_m: 0,
      depth_max_m: 200,
      description: "Vùng nước có ánh sáng mặt trời chiếu tới mạnh mẽ nhất, nơi tập trung hơn 90% sự sống biển.",
    },
    {
      id: 2,
      name: "Tầng trung (Twilight / Mesopelagic)",
      depth_min_m: 200,
      depth_max_m: 1000,
      description: "Vùng chạng vạng, ánh sáng mờ nhạt, nơi bắt đầu xuất hiện các sinh vật phát quang sinh học.",
    },
    {
      id: 3,
      name: "Tầng sâu (Midnight / Bathypelagic)",
      depth_min_m: 1000,
      depth_max_m: 4000,
      description: "Vùng tối hoàn toàn, áp suất cực cao và nhiệt độ nước gần đóng băng.",
    },
    {
      id: 4,
      name: "Tầng thẳm (Abyssal / Abyssopelagic)",
      depth_min_m: 4000,
      depth_max_m: 6000,
      description: "Vùng đồng bằng thẳm đại dương, bóng tối vĩnh cửu và các miệng phun thủy nhiệt.",
    },
    {
      id: 5,
      name: "Tầng vực thẳm (Hadal / Hadalpelagic)",
      depth_min_m: 6000,
      depth_max_m: 11000,
      description: "Các rãnh vực đại dương sâu nhất hành tinh, áp suất lên tới hàng nghìn atmosphere.",
    },
  ];
  for (const z of zones) {
    await prisma.ocean_zones.upsert({
      where: { id: z.id },
      update: {
        name: z.name,
        depth_min_m: z.depth_min_m,
        depth_max_m: z.depth_max_m,
        description: z.description,
      },
      create: z,
    });
  }

  // 4. SPECIES GROUPS (6 Marine Taxa Groups)
  console.log("4. Seeding Species Groups...");
  const groups = [
    {
      id: 1n,
      name: "Cá biển (Fish)",
      slug: "ca-bien",
      description: "Các loài cá xương (Osteichthyes) và cá sụn (Chondrichthyes) như cá mập, cá đuối.",
      image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop",
    },
    {
      id: 2n,
      name: "Động vật có vú biển (Marine Mammals)",
      slug: "dong-vat-co-vu-bien",
      description: "Cá voi, cá heo, hải cẩu, sư tử biển, hải mã và bò biển.",
      image_url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&auto=format&fit=crop",
    },
    {
      id: 3n,
      name: "Bò sát biển (Marine Reptiles)",
      slug: "bo-sat-bien",
      description: "Rùa biển, rắn biển, kỳ giông biển và cá sấu nước mặn.",
      image_url: "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=600&auto=format&fit=crop",
    },
    {
      id: 4n,
      name: "Thân mềm & Không xương sống (Invertebrates)",
      slug: "than-mem-khong-xuong-song",
      description: "Bạch tuộc, mực, sứa, tôm cua, sao biển, nhím biển và giáp xác.",
      image_url: "https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?w=600&auto=format&fit=crop",
    },
    {
      id: 5n,
      name: "San hô & Thực vật biển (Corals & Marine Plants)",
      slug: "san-ho-thuc-vat-bien",
      description: "Rạn san hô, cỏ biển, rừng tảo bẹ kelp và các loài thực vật thủy sinh.",
      image_url: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&auto=format&fit=crop",
    },
    {
      id: 6n,
      name: "Sinh vật biển sâu & Phát quang (Deep Sea)",
      slug: "sinh-vat-bien-sau",
      description: "Các loài sinh vật thích nghi với áp suất cao, bóng tối và phát quang sinh học.",
      image_url: "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=600&auto=format&fit=crop",
    },
  ];
  for (const g of groups) {
    await prisma.species_groups.upsert({
      where: { id: g.id },
      update: {
        name: g.name,
        slug: g.slug,
        description: g.description,
        image_url: g.image_url,
      },
      create: g,
    });
  }

  // 5. OCEAN LOCATIONS (6 Iconic Marine Regions)
  console.log("5. Seeding Ocean Locations...");
  const locations = [
    {
      id: 1n,
      name: "Rạn san hô Great Barrier",
      slug: "great-barrier-reef",
      latitude: -18.2871,
      longitude: 147.6992,
      ocean_zone_id: 1,
      is_featured: true,
      description: "Hệ sinh thái rạn san hô lớn nhất thế giới ngoài khơi bang Queensland, Úc.",
      image_url: "https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=600&auto=format&fit=crop",
    },
    {
      id: 2n,
      name: "Vực thẳm Mariana (Challenger Deep)",
      slug: "mariana-trench",
      latitude: 11.3733,
      longitude: 142.5917,
      ocean_zone_id: 5,
      is_featured: true,
      description: "Điểm sâu nhất được biết đến trên bề mặt Trái Đất thuộc vùng tây Thái Bình Dương.",
      image_url: "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=600&auto=format&fit=crop",
    },
    {
      id: 3n,
      name: "Quần đảo Galápagos",
      slug: "galapagos-islands",
      latitude: -0.9538,
      longitude: -90.9656,
      ocean_zone_id: 1,
      is_featured: true,
      description: "Thiên đường đa dạng sinh học độc nhất vô nhị ở Thái Bình Dương thuộc Ecuador.",
      image_url: "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=600&auto=format&fit=crop",
    },
    {
      id: 4n,
      name: "Tam giác San hô (Coral Triangle)",
      slug: "coral-triangle",
      latitude: 1.5,
      longitude: 125.0,
      ocean_zone_id: 1,
      is_featured: true,
      description: "Trung tâm toàn cầu của đa dạng sinh học biển, chiếm 76% các loài san hô tạo rạn.",
      image_url: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&auto=format&fit=crop",
    },
    {
      id: 5n,
      name: "Hẻm núi ngầm Vịnh Monterey",
      slug: "monterey-bay-canyon",
      latitude: 36.8,
      longitude: -121.9,
      ocean_zone_id: 3,
      is_featured: true,
      description: "Một trong những hẻm núi dưới biển sâu lớn nhất bờ tây Bắc Mỹ.",
      image_url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&auto=format&fit=crop",
    },
    {
      id: 6n,
      name: "Khu bảo tồn Biển Quốc gia Papahānaumokuākea (Hawaii)",
      slug: "papahanaumokuakea",
      latitude: 25.0,
      longitude: -170.0,
      ocean_zone_id: 1,
      is_featured: true,
      description: "Một trong những khu bảo tồn sinh vật biển lớn nhất thế giới ở Thái Bình Dương.",
      image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop",
    },
  ];
  for (const loc of locations) {
    await prisma.locations.upsert({
      where: { id: loc.id },
      update: {
        name: loc.name,
        slug: loc.slug,
        latitude: loc.latitude,
        longitude: loc.longitude,
        ocean_zone_id: loc.ocean_zone_id,
        is_featured: loc.is_featured,
        description: loc.description,
        image_url: loc.image_url,
      },
      create: loc,
    });
  }

  console.log("✅ Seed completed successfully!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
