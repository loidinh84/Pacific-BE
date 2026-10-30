/**
 * seedRichMarineSpecies.js
 * Bổ sung dữ liệu sinh thái thực tế chất lượng cao cho Biển Đông & Đại dương:
 * - Chuẩn hóa các loài hiện có bị thiếu nhóm/vùng
 * - Bổ sung 10 loài mới đặc trưng (bao gồm nhóm Biển Sâu & Phát Quang hiện đang trống)
 * - Thiết lập mạng lưới quan hệ sinh thái thực tế mới
 * - Tự động đồng bộ hóa Vector Embeddings 768 chiều vào PostgreSQL & RAM
 */

import prisma from "../src/lib/prisma.js";
import vectorSearchService from "../src/services/vectorSearchService.js";

async function main() {
  console.log("🌊 [BẮT ĐẦU] Nạp dữ liệu sinh thái biển thực tế phong phú...");

  // 1. CHUẨN HÓA CÁC LOÀI HIỆN CÓ BỊ THIẾU THÔNG TIN
  console.log("🛠️ [1/4] Chuẩn hóa các loài hiện có...");

  // Bạch tuộc khổng lồ
  await prisma.species.update({
    where: { id: 2n },
    data: {
      group_id: 4n,
      conservation_status_id: 1, // LC
      ocean_zone_id: 2, // Twilight
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Khai thác có kiểm soát",
      cites_appendix: "Không",
      east_sea_zone: "Vùng biển khơi & vùng sườn thềm lục địa Biển Đông",
      local_distribution: "Vùng biển sâu ngoài khơi Trung Bộ và Quần đảo Hoàng Sa",
      diet: "Cua, tôm hùm, trai sò và các loài cá tầng đáy",
      depth_min_m: 20,
      depth_max_m: 1500,
      description:
        "Bạch tuộc kích thước khổng lồ với 8 xúc tu khỏe mạnh, trí thông minh cao và khả năng biến đổi màu sắc, hoa văn cơ thể cực kỳ nhanh để ngụy trang săn mồi.",
    },
  });

  // Cá mập trắng lớn
  await prisma.species.update({
    where: { id: 1n },
    data: {
      group_id: 1n,
      conservation_status_id: 3, // VU
      ocean_zone_id: 1, // Sunlight
      vietnam_red_list_status: "VU",
      vietnam_protection_group: "Bảo vệ nghiêm ngặt",
      cites_appendix: "Phụ lục II",
      east_sea_zone: "Vùng biển khơi Trung Bộ & Hoàng Sa",
      local_distribution: "Vùng khơi biển miền Trung, rãnh sâu Hoàng Sa",
      diet: "Hải cẩu, sư tử biển, cá ngừ đại dương, cá heo nhỏ và các loài cá mập khác",
      depth_min_m: 0,
      depth_max_m: 1200,
      description:
        "Động vật ăn thịt đầu bảng đại dương với khứu giác siêu nhạy cảm và lực cắn uy lực nhất giới sinh vật biển, giữ vai trò cân bằng sinh thái vùng biển khơi.",
    },
  });

  // Cá Voi Lưng Gù (ID: 5)
  await prisma.species.update({
    where: { id: 5n },
    data: {
      conservation_status_id: 1, // LC
      ocean_zone_id: 1,
      vietnam_red_list_status: "VU",
      vietnam_protection_group: "Nhóm I",
      cites_appendix: "Phụ lục I",
      east_sea_zone: "Vùng biển khơi Trung Bộ & Hoàng Sa - Trường Sa",
      local_distribution: "Vùng biển khơi di cư miền Trung (Quảng Nam - Bình Thuận)",
      diet: "Nhuyễn thể krill, cá trích, sinh vật phù du tầng mặt",
      depth_min_m: 0,
      depth_max_m: 200,
    },
  });

  // 2. NẠP 10 LOÀI MỚI ĐẶC TRƯNG BIỂN ĐÔNG & ĐẠI DƯƠNG
  console.log("🐬 [2/4] Nạp 10 loài sinh vật thực tế mới...");

  const newSpecies = [
    // 41. Cá đuối nạng khổng lồ
    {
      id: 41n,
      code: "FSH-EN-0041",
      scientificName: "Mobula birostris",
      common_name: "Cá Đuối Nạng Khổng Lồ",
      slug: "ca-duoi-nang-khong-lo-manta",
      group_id: 1n, // Cá biển
      conservation_status_id: 4, // EN
      ocean_zone_id: 1, // Sunlight
      description:
        "Còn gọi là Cá Manta hoặc Cá Quỷ. Loài cá đuối lớn nhất hành tinh với sải cánh vây ngực rộng tới 7m và hai thùy đầu dẹt như sừng. Chúng bơi lượn duyên dáng trên rạn san hô Biển Đông để há miệng lọc ăn sinh vật phù du.",
      vietnam_red_list_status: "EN",
      vietnam_protection_group: "Nhóm I",
      cites_appendix: "Phụ lục II",
      east_sea_zone: "Quần đảo Hoàng Sa - Trường Sa & Nha Trang",
      local_distribution: "Khu bảo tồn biển Nam Yết (Trường Sa), Hòn Mun (Nha Trang), Côn Đảo",
      diet: "Sinh vật phù du, giáp xác nhỏ, ấu trùng cá tầng mặt",
      size_min_cm: 300,
      size_max_cm: 700,
      weight_min_kg: 500,
      weight_max_kg: 2000,
      depth_min_m: 0,
      depth_max_m: 1000,
      lifespan_years: 50,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/0/03/Manta_birostris-Thailand.jpg",
    },

    // 42. Cá voi Bryde
    {
      id: 42n,
      code: "MAM-VU-0042",
      scientificName: "Balaenoptera edeni",
      common_name: "Cá Voi Bryde",
      slug: "ca-voi-bryde-de-gi",
      group_id: 2n, // Thú biển
      conservation_status_id: 3, // VU
      ocean_zone_id: 1,
      description:
        "Thường được gọi là Cá Voi Đề Gi. Loài cá voi tấm sừng nổi tiếng thường xuyên xuất hiện săn mồi gần bờ tại vùng biển Đề Gi (Bình Định) và Côn Đảo. Chúng thực hiện màn há miệng thẳng đứng độc đáo đớp gọn các đàn cá trích khổng lồ.",
      vietnam_red_list_status: "VU",
      vietnam_protection_group: "Nhóm I",
      cites_appendix: "Phụ lục I",
      east_sea_zone: "Vùng biển Bình Định & Vườn quốc gia Côn Đảo",
      local_distribution: "Biển Đề Gi (Phù Cát, Bình Định), vịnh Nha Trang, Côn Đảo",
      diet: "Cá trích mai, cá nục, cá cơm, sinh vật phù du bơi đàn",
      size_min_cm: 1100,
      size_max_cm: 1550,
      weight_min_kg: 12000,
      weight_max_kg: 25000,
      depth_min_m: 0,
      depth_max_m: 300,
      lifespan_years: 60,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/Balaenoptera_edeni_NOAA.jpg",
    },

    // 43. Cá sư tử đỏ
    {
      id: 43n,
      code: "FSH-LC-0043",
      scientificName: "Pterois volitans",
      common_name: "Cá Sư Tử Đỏ",
      slug: "ca-su-tu-do-mao-tien",
      group_id: 1n, // Cá biển
      conservation_status_id: 1, // LC
      ocean_zone_id: 1,
      description:
        "Dân gian còn gọi là Cá Mao Tiên. Loài cá săn mồi rạn san hô lộng lẫy với các vây ngực xòe rộng như cánh bướm và 13 tia gai lưng mang nọc độc thần kinh mạnh mẽ. Chúng di chuyển chậm rãi ép con mồi vào hốc đá san hô trước khi đớp chớp nhoáng.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Khai thác cảnh quan rạn san hô",
      cites_appendix: "Không",
      east_sea_zone: "Vùng biển Trung Bộ & Nha Trang",
      local_distribution: "Rạn san hô Hòn Mun (Nha Trang), Cù Lao Chàm, Phú Quốc",
      diet: "Cá con, tôm, cua rạn san hô",
      size_min_cm: 15,
      size_max_cm: 45,
      weight_min_kg: 0.2,
      weight_max_kg: 1.4,
      depth_min_m: 1,
      depth_max_m: 50,
      lifespan_years: 15,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/b/b5/Red_lionfish_near_Fuvahmulah%2C_Maldives.jpg",
    },

    // 44. Cá chình bông khổng lồ
    {
      id: 44n,
      code: "FSH-LC-0044",
      scientificName: "Gymnothorax javanicus",
      common_name: "Cá Chình Bông Khổng Lồ",
      slug: "ca-chinh-bong-khong-lo",
      group_id: 1n,
      conservation_status_id: 1,
      ocean_zone_id: 1,
      description:
        "Động vật ăn thịt phục kích đầu bảng trong các hốc rạn san hô nhiệt đới với hàm răng sắc nhọn cong về phía sau và bộ hàm hầu thứ hai bên trong họng để kéo con mồi vào sâu.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Không",
      cites_appendix: "Không",
      east_sea_zone: "Vườn quốc gia Côn Đảo & Nha Trang",
      local_distribution: "Các rạn san hô ngầm Côn Đảo, Hòn Mun, đảo Nam Yết",
      diet: "Bạch tuộc nhỏ, cá rạn san hô, giáp xác",
      size_min_cm: 120,
      size_max_cm: 300,
      weight_min_kg: 8,
      weight_max_kg: 30,
      depth_min_m: 1,
      depth_max_m: 50,
      lifespan_years: 30,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/d/d3/Giant_Moray_Gymnothorax_javanicus.jpg",
    },

    // 45. Rùa da khổng lồ
    {
      id: 45n,
      code: "REP-CR-0045",
      scientificName: "Dermochelys coriacea",
      common_name: "Rùa Da Khổng Lồ",
      slug: "rua-da-khong-lo-rua-luyt",
      group_id: 3n, // Bò sát biển
      conservation_status_id: 5, // CR
      ocean_zone_id: 1,
      description:
        "Còn gọi là Rùa Luýt. Loài rùa biển lớn nhất thế giới với chiếc mai độc đáo không phủ sừng mà bằng lớp da dày dai như da thuộc có 7 gờ dọc. Chúng có khả năng lặn sâu kỷ lục hơn 1.200m để săn các loài sứa biển khổng lồ.",
      vietnam_red_list_status: "CR",
      vietnam_protection_group: "Nhóm I",
      cites_appendix: "Phụ lục I",
      east_sea_zone: "Vùng biển Trung Bộ & Vịnh Bắc Bộ",
      local_distribution: "Vùng biển khơi Quảng Ninh, Thừa Thiên Huế, Quảng Ngãi, Bình Thuận",
      diet: "Sứa biển, động vật thân mềm bơi nổi (Salp)",
      size_min_cm: 130,
      size_max_cm: 220,
      weight_min_kg: 250,
      weight_max_kg: 700,
      depth_min_m: 0,
      depth_max_m: 1280,
      lifespan_years: 50,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/8/84/Leatherback_sea_turtle_eating_a_jellyfish.jpg",
    },

    // 46. Mực Lá Đại Dương (Bigfin Reef Squid)
    {
      id: 46n,
      code: "INV-LC-0046",
      scientificName: "Sepioteuthis lessoniana",
      common_name: "Mực Lá Đại Dương",
      slug: "muc-la-dai-duong",
      group_id: 4n, // Thân mềm
      conservation_status_id: 1,
      ocean_zone_id: 1,
      description:
        "Còn gọi là Mực Chân Màng Rạn. Loài mực rạn san hô sở hữu đôi vây hình oval lớn kéo dài dọc gần như toàn bộ thân, bơi lội linh hoạt và đổi màu liên tục theo cảm xúc hoặc ánh sáng môi trường.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Khai thác thủy sản chủ lực",
      cites_appendix: "Không",
      east_sea_zone: "Khu bảo tồn biển Phú Quốc & Nam Trung Bộ",
      local_distribution: "Vùng biển Phú Quốc, Côn Đảo, vịnh Phan Thiết, vịnh Nha Trang",
      diet: "Tôm, cua, cá nhỏ tầng mặt và rạn san hô",
      size_min_cm: 15,
      size_max_cm: 40,
      weight_min_kg: 0.3,
      weight_max_kg: 2.0,
      depth_min_m: 0,
      depth_max_m: 100,
      lifespan_years: 1,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/e/ec/Sepioteuthis_lessoniana_2.jpg",
    },

    // 47. Cá Cần Câu Biển Sâu (Humpback Anglerfish) - Nhóm 6: Biển Sâu & Phát Quang
    {
      id: 47n,
      code: "DPS-LC-0047",
      scientificName: "Melanocetus johnsonii",
      common_name: "Cá Cần Câu Biển Sâu",
      slug: "ca-can-cau-bien-sau-anglerfish",
      group_id: 6n, // Sinh vật biển sâu & Phát quang
      conservation_status_id: 1,
      ocean_zone_id: 3, // Midnight / Bathypelagic
      description:
        "Còn gọi là Cá Vây Chân Gù. Cư dân nổi tiếng của tầng nước nửa đêm (Midnight Zone). Con cái sở hữu chiếc 'cần câu' phát quang sinh học chứa vi khuẩn phát sáng trên trán để nhử mồi trong bóng tối vĩnh cửu của đáy biển sâu.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Biển sâu không khai thác",
      cites_appendix: "Không",
      east_sea_zone: "Hố sâu biển khơi Biển Đông",
      local_distribution: "Rãnh sâu phía đông Quần đảo Hoàng Sa và bồn trũng trung tâm Biển Đông",
      diet: "Cá nhỏ biển sâu, giáp xác phát quang, mực nhỏ tầng đáy",
      size_min_cm: 5,
      size_max_cm: 20,
      weight_min_kg: 0.1,
      weight_max_kg: 0.8,
      depth_min_m: 1000,
      depth_max_m: 4500,
      lifespan_years: 25,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/1/1b/Humpback_anglerfish.png",
    },

    // 48. Cá Rồng Biển Sâu (Sloane's Viperfish) - Nhóm 6
    {
      id: 48n,
      code: "DPS-LC-0048",
      scientificName: "Chauliodus sloani",
      common_name: "Cá Rồng Biển Sâu",
      slug: "ca-rong-bien-sau-viperfish",
      group_id: 6n, // Sinh vật biển sâu & Phát quang
      conservation_status_id: 1,
      ocean_zone_id: 3,
      description:
        "Còn gọi là Cá Hổ Răng Nanh Biển Sâu. Loài cá săn mồi biển sâu với bộ răng nanh cong vút dài đến mức không thể khép vừa miệng, các cơ quan phát quang (photophore) chạy dọc hai bên thân lấp lánh để ngụy trang ngược sáng.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Biển sâu không khai thác",
      cites_appendix: "Không",
      east_sea_zone: "Bồn trũng sâu trung tâm Biển Đông",
      local_distribution: "Tầng nước sâu 500m - 2800m ngoài khơi thềm lục địa miền Trung",
      diet: "Cá đèn lồng, tôm biển sâu, sinh vật phù du tầng tối",
      size_min_cm: 20,
      size_max_cm: 35,
      weight_min_kg: 0.05,
      weight_max_kg: 0.3,
      depth_min_m: 500,
      depth_max_m: 2800,
      lifespan_years: 30,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/d/d3/Chauliodus_sloani.jpg",
    },

    // 49. Mực Ma Cà Rồng (Vampire Squid) - Nhóm 6
    {
      id: 49n,
      code: "DPS-LC-0049",
      scientificName: "Vampyroteuthis infernalis",
      common_name: "Mực Ma Cà Rồng",
      slug: "muc-ma-ca-rong-bien-sau",
      group_id: 6n, // Sinh vật biển sâu & Phát quang
      conservation_status_id: 1,
      ocean_zone_id: 3,
      description:
        "Hóa thạch sống của đại dương với lớp da màu đỏ nhung thẫm, đôi mắt xanh trong veo phản chiếu ánh sáng và các xúc tu nối với nhau bằng lớp màng như áo choàng. Thay vì phun mực đen, nó phun đám mây chất nhầy phát quang sinh học để tẩu thoát.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Biển sâu không khai thác",
      cites_appendix: "Không",
      east_sea_zone: "Vùng biển sâu tối vĩnh cửu Biển Đông",
      local_distribution: "Vùng nước tối thiếu oxy ở độ sâu 600m - 1200m Biển Đông",
      diet: "Tuyết biển (vụn hữu cơ rơi từ tầng mặt), xác sinh vật phù du",
      size_min_cm: 15,
      size_max_cm: 30,
      weight_min_kg: 0.1,
      weight_max_kg: 0.5,
      depth_min_m: 600,
      depth_max_m: 1200,
      lifespan_years: 20,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/1/18/Vampyroteuthis_infernalis.jpg",
    },

    // 50. Bọ Biển Khổng Lồ (Giant Isopod) - Nhóm 6
    {
      id: 50n,
      code: "DPS-LC-0050",
      scientificName: "Bathynomus giganteus",
      common_name: "Bọ Biển Khổng Lồ",
      slug: "bo-bien-khong-lo-giant-isopod",
      group_id: 6n, // Sinh vật biển sâu & Phát quang
      conservation_status_id: 1,
      ocean_zone_id: 4, // Abyssal
      description:
        "Thuộc nhóm giáp xác đáy sâu khổng lồ. Minh chứng điển hình cho hiện tượng 'khổng lồ hóa biển sâu'. Loài giáp xác đáy này dài tới 50cm, bò trên nền bùn đáy đại dương giá lạnh để dọn xác cá voi và thức ăn thừa rơi xuống từ tầng mặt.",
      vietnam_red_list_status: "LC",
      vietnam_protection_group: "Biển sâu",
      cites_appendix: "Không",
      east_sea_zone: "Vùng sườn dốc thềm lục địa sâu Biển Đông",
      local_distribution: "Đáy bùn sâu 170m - 2140m vùng biển khơi Nam Trung Bộ",
      diet: "Xác cá, mực chết chìm, động vật biển rơi xuống đáy bùn",
      size_min_cm: 20,
      size_max_cm: 50,
      weight_min_kg: 0.5,
      weight_max_kg: 2.0,
      depth_min_m: 170,
      depth_max_m: 2140,
      lifespan_years: 20,
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/8/87/Bathynomus_giganteus.jpg",
    },
  ];

  for (const s of newSpecies) {
    const { imageUrl, ...data } = s;
    await prisma.species.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });

    if (imageUrl) {
      await prisma.species_media.deleteMany({
        where: { species_id: data.id, is_primary: true },
      });
      await prisma.species_media.create({
        data: {
          species_id: data.id,
          type: "image",
          url: imageUrl,
          caption: `Ảnh minh họa ${data.common_name}`,
          is_primary: true,
        },
      });
    }
  }

  // 3. THIẾT LẬP MẠNG LƯỚI QUAN HỆ SINH THÁI MỚI
  console.log("🕸️ [3/4] Thiết lập mạng lưới quan hệ sinh thái thực tế...");

  const newRelationships = [
    // Manta Ray lọc ăn Sinh Vật Phù Du
    {
      source_species_id: 41n,
      target_species_id: 35n,
      relationship_type: "predator_prey",
      description:
        "Cá đuối Manta há miệng lớn lướt êm trên rạn san hô, dùng các lược mang giữ lại và ăn hàng triệu sinh vật phù du.",
      strength: 0.95,
      ecological_impact: "Điều hòa mật độ sinh vật phù du tầng mặt, tạo sự trong sạch cho rạn san hô",
    },
    // Cá Voi Bryde săn Cá Trích Mai tại Biển Đề Gi Bình Định
    {
      source_species_id: 42n,
      target_species_id: 28n,
      relationship_type: "predator_prey",
      description:
        "Cá voi Bryde nổi tiếng tại Đề Gi (Bình Định) há miệng thẳng đứng đớp trọn các đàn cá trích mai bơi sát mặt nước.",
      strength: 0.95,
      ecological_impact: "Động vật tiêu thụ cấp cao duy trì cân bằng quần thể cá trích ven bờ miền Trung",
    },
    // Rùa Da Khổng Lồ săn Sứa biển & Giáp xác phù du
    {
      source_species_id: 45n,
      target_species_id: 35n,
      relationship_type: "predator_prey",
      description:
        "Rùa da chuyên lặn sâu săn các loài sứa biển và sinh vật phù du dạng sứa (Salp).",
      strength: 0.9,
      ecological_impact: "Khống chế sự bùng phát số lượng sứa biển có độc, bảo vệ ấu trùng cá con",
    },
    // Cá Sư Tử Đỏ nương tựa rạn San Hô Cành
    {
      source_species_id: 14n,
      target_species_id: 43n,
      relationship_type: "habitat_provider",
      description:
        "Rạn san hô cành tạo các khe hốc và bóng râm để cá sư tử đỏ ngụy trang vây độc rình mồi.",
      strength: 0.85,
      ecological_impact: "Cung cấp nơi ở và lãnh thổ săn mồi lý tưởng cho cá rạn san hô",
    },
    // Cá Chình Bông phục kích săn Cá Hề / Cá nhỏ
    {
      source_species_id: 44n,
      target_species_id: 17n,
      relationship_type: "predator_prey",
      description:
        "Cá chình bông từ trong hốc san hô lao ra phục kích cá hề khi bơi rời xa hải quỳ.",
      strength: 0.8,
      ecological_impact: "Điều tiết số lượng cá con và tạo sự chọn lọc sinh tồn tự nhiên trên rạn",
    },
    // Cá Cần Câu Biển Sâu nhử mồi săn Cá Rồng Biển Sâu
    {
      source_species_id: 47n,
      target_species_id: 48n,
      relationship_type: "predator_prey",
      description:
        "Cá cần câu vẫy mồi phát quang sinh học thu hút cá rồng biển sâu và cá nhỏ đến gần miệng há to.",
      strength: 0.85,
      ecological_impact: "Mắt xích chuỗi thức ăn tầng tối (Midnight Zone) nơi hoàn toàn không có ánh nắng",
    },
    // Bọ Biển Khổng Lồ dọn xác Cá Voi & Sinh vật biển rơi xuống
    {
      source_species_id: 50n,
      target_species_id: 42n,
      relationship_type: "herbivory", // scavenging
      description:
        "Bọ biển khổng lồ là công nhân vệ sinh đáy biển sâu, tụ tập rỉa sạch xác cá voi rơi xuống đáy bùn.",
      strength: 0.9,
      ecological_impact: "Tuần hoàn vật chất dinh dưỡng đáy đại dương, chống ô nhiễm hữu cơ biển sâu",
    },
  ];

  for (const rel of newRelationships) {
    const existing = await prisma.species_relationships.findFirst({
      where: {
        source_species_id: rel.source_species_id,
        target_species_id: rel.target_species_id,
        relationship_type: rel.relationship_type,
      },
    });

    if (existing) {
      await prisma.species_relationships.update({
        where: { id: existing.id },
        data: rel,
      });
    } else {
      await prisma.species_relationships.create({
        data: rel,
      });
    }
  }

  // 4. TỰ ĐỘNG ĐỒNG BỘ VECTOR EMBEDDINGS VÀO POSTGRESQL & RAM
  console.log("🧠 [4/4] Tự động đồng bộ hóa Vector Embeddings 768 chiều vào PostgreSQL & RAM...");
  await vectorSearchService.syncAllSpeciesEmbeddings();

  console.log("✅ [HOÀN TẤT] Hệ sinh thái đã được bổ sung dữ liệu thực tế thành công!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed dữ liệu thực tế:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
