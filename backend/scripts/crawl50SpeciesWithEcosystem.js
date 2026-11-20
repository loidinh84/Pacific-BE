import axios from "axios";
import https from "https";
import fs from "fs";
import prisma from "../src/lib/prisma.js";
import vectorSearchService from "../src/services/vectorSearchService.js";

const httpsAgent = new https.Agent({ keepAlive: true, timeout: 20000 });
const axiosClient = axios.create({
  timeout: 20000,
  httpsAgent,
  headers: {
    "User-Agent": "PacificOceanEcosystem/2.0 (marine-biology-research; contact@pacific.local)",
    Accept: "application/json",
  },
});

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axiosClient({ url, ...options });
    } catch (err) {
      if (attempt === retries) {
        console.warn(`   ⚠️ Fetch thất bại sau ${retries} lần [${url}]: ${err.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, attempt * 1200));
    }
  }
  return null;
}

const BANNED_PHOTO_TERMS = [
  "dead", "deceased", "washed up", "stranded", "beached", "market", "fish market",
  "aquarium", "captive", "tank", "zoo", "specimen", "preserved", "museum",
  "fishing", "hooked", "caught", "trawl", "plate", "cooked", "food", "dried",
  "skeleton", "skull", "jaw", "shell only", "dissected", "necropsy",
];

export const FIFTY_SPECIES = [
  // 1. Cá Bướm Mặt Gấu Trúc
  {
    code: "FSH-LC-0296",
    slug: "ca-buom-mat-gau-truc",
    common_name: "Cá Bướm Mặt Gấu Trúc",
    common_name_en: "Raccoon Butterflyfish",
    scientificName: "Chaetodon lunula",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá bướm mặt gấu trúc (Chaetodon lunula) nổi bật với dải sọc đen vắt ngang mắt và viền trắng rộng tựa gấu trúc, cùng thân hình vàng óng rực rỡ. Chúng là một trong số ít loài cá bướm hoạt động mạnh cả về đêm để tỉa polyp san hô và bắt động vật không xương sống nhỏ.",
    description_en: "The raccoon butterflyfish (Chaetodon lunula) features a distinct black eye mask with a broad white band behind it and brilliant yellow coloration. Unlike many butterflyfish, it is largely nocturnal.",
    diet: "Polyp san hô cành, xúc tu hải quỳ, giun nhiều tơ và tảo biển",
    diet_en: "Coral polyps, anemone tentacles, polychaete worms, and benthic algae",
    size_min_cm: 15, size_max_cm: 20, weight_min_kg: 0.2, weight_max_kg: 0.45, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng mạnh tầng mặt và rạn cạn", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật rạn san hô tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Phổ biến tại các rạn san hô nông dốc viền đảo Hòn Mun, Côn Đảo và bãi cạn san hô Trường Sa.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Chiếc mặt nạ đen trắng che khuất hoàn toàn mắt thật, làm kẻ săn mồi bối rối không đoán được hướng di chuyển.",
      "Chúng có thể sống đơn độc hoặc kết thành từng đôi thủy chung gắn bó suốt nhiều năm.",
      "Vào ban đêm, cơ thể chúng sẫm màu lại để hòa lẫn vào bóng tối của hang san hô khi đi kiếm ăn.",
    ],
  },
  // 2. Cá Thù Lù Mỏ Nhọn (Moorish Idol)
  {
    code: "FSH-LC-0297",
    slug: "ca-thu-lu-mo-nhon-moorish-idol",
    common_name: "Cá Thù Lù Mỏ Nhọn (Moorish Idol)",
    common_name_en: "Moorish Idol",
    scientificName: "Zanclus cornutus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá thù lù mỏ nhọn (Zanclus cornutus) là biểu tượng lộng lẫy của rạn san hô nhiệt đới với thân đĩa dẹt, ba dải sọc đứng tương phản vàng - trắng - đen và chiếc vây lưng kéo dài như một dải lụa trắng thướt tha. Chúng là loài duy nhất còn sinh tồn thuộc họ Zanclidae.",
    description_en: "The Moorish idol (Zanclus cornutus) is an iconic reef fish with a compressed disk-like body, contrasting yellow, black, and white bands, and an elongated trailing dorsal filament.",
    diet: "Bọt biển (hải miên), rêu tảo rạn và động vật không xương sống nhỏ",
    diet_en: "Sponges, tunicates, bryozoans, and benthic algae",
    size_min_cm: 16, size_max_cm: 23, weight_min_kg: 0.3, weight_max_kg: 0.6, lifespan_years: 10,
    depth_min_m: 3, depth_max_m: 180, pressure_atm: 19.0, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa sườn dốc rạn san hô", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cảnh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Hoàng Sa, Phú Quốc",
    local_distribution: "Tuần tra các sườn rạn san hô dốc ngoài khơi Hòn Mun, đảo Nam Yết và đảo Phú Quý.",
    location_ids: [103, 105, 104, 101],
    facts: [
      "Chiếc mỏ nhọn dài với hàm răng như bàn chải cho phép chúng gặm bọt biển sâu bên trong các kẽ nứt san hô.",
      "Giai đoạn ấu trùng của chúng kéo dài khác thường giúp chúng phát tán rất rộng qua các dòng hải lưu đại dương.",
      "Tên gọi 'Moorish Idol' bắt nguồn từ niềm tin của người Moor thời cổ xem chúng là biểu tượng mang lại may mắn.",
    ],
  },
  // 3. Cá Nóc Hòm Đốm Vàng
  {
    code: "FSH-LC-0298",
    slug: "ca-noc-hom-dom-vang",
    common_name: "Cá Nóc Hòm Đốm Vàng",
    common_name_en: "Yellow Boxfish",
    scientificName: "Ostracion cubicum",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá nóc hòm đốm vàng (Ostracion cubicum) có cơ thể hình hộp vuông vức độc nhất vô nhị được bảo vệ bởi lớp vỏ giáp xương cứng chắc. Cá con có màu vàng chanh sáng rực với những đốm đen tròn xoe ngộ nghĩnh, bơi lượn chậm rãi giữa các nhánh san hô.",
    description_en: "The yellow boxfish (Ostracion cubicum) is famous for its rigid, cube-shaped carapace composed of fused hexagonal bony plates and vivid bright yellow skin speckled with black dots in juveniles.",
    diet: "Tảo rạn san hô, bọt biển, giun biển và giáp xác nhỏ",
    diet_en: "Algae, sponges, crustaceans, polychaetes, and mollusks",
    size_min_cm: 15, size_max_cm: 45, weight_min_kg: 0.4, weight_max_kg: 1.8, lifespan_years: 10,
    depth_min_m: 1, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh vùng đầm phá và rạn nông", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Phú Quốc, Trường Sa",
    local_distribution: "Ẩn mình trong các hốc san hô sừng hươu và khe đá ngầm quanh Hòn Cau, Côn Đảo và đảo Song Tử Tây.",
    location_ids: [103, 101, 106, 105],
    facts: [
      "Khung xương hình hộp cứng ngắc của chúng đã truyền cảm hứng cho hãng Mercedes-Benz thiết kế mẫu xe hơi khí động học Bionic.",
      "Khi bị stress hoặc đe dọa, da chúng tiết ra chất độc ostracitoxin cực mạnh có thể giết chết cá săn mồi xung quanh.",
      "Do thân hình hộp cứng không thể uốn éo, chúng di chuyển độc đáo bằng cách vẫy nhẹ các vây nhỏ tựa chiếc trực thăng tí hon dưới nước.",
    ],
  },
  // 4. Cá Dơi Vây Dài
  {
    code: "FSH-LC-0299",
    slug: "ca-doi-vay-dai",
    common_name: "Cá Dơi Vây Dài",
    common_name_en: "Longfin Batfish",
    scientificName: "Platax teira",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá dơi vây dài (Platax teira) có thân dẹt hình đĩa tròn với vây lưng và vây hậu môn vươn cao vút như cánh dơi. Cá con bơi lượn ngụy trang giống chiếc lá cây khô trôi dạt trên mặt nước, trong khi cá trưởng thành kết thành đàn tò mò bơi theo các thợ lặn.",
    description_en: "The longfin batfish (Platax teira) features extraordinarily tall dorsal and anal fins giving it an elongated crescent shape. Juveniles mimic floating leaves to evade predators.",
    diet: "Sinh vật phù du, sứa biển, giun rạn và tảo biển",
    diet_en: "Plankton, jellyfish, polychaetes, algae, and pelagic tunicates",
    size_min_cm: 40, size_max_cm: 70, weight_min_kg: 3.0, weight_max_kg: 8.5, lifespan_years: 15,
    depth_min_m: 2, depth_max_m: 70, pressure_atm: 8.0, temperature_min_c: 22.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa thềm lục địa và xác tàu ngắm", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Bắc Bộ, Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Tụ tập thành đàn lớn quanh xác tàu đắm và các cụm rạn nhân tạo ở Nha Trang, Vũng Tàu và Côn Đảo.",
    location_ids: [103, 101, 104, 105],
    facts: [
      "Chúng có tính cách vô cùng dạn dĩ và tò mò, thường xuyên áp sát mặt nạ của thợ lặn để ngắm nhìn hình ảnh phản chiếu của mình.",
      "Cá con thả trôi cơ thể nghiêng theo dòng chảy, biến mình thành chiếc lá ngập mặn rơi xuống biển để đánh lừa kẻ săn mồi.",
      "Chúng là kẻ săn sứa hiệu quả, giúp kiềm chế các vụ bùng phát sứa độc tại các vùng biển nhiệt đới ven bờ.",
    ],
  },
  // 5. Cá Nục Heo (Mahi-Mahi)
  {
    code: "FSH-LC-0300",
    slug: "ca-nuc-heo-mahi-mahi",
    common_name: "Cá Nục Heo (Mahi-Mahi)",
    common_name_en: "Mahi-mahi (Dorado)",
    scientificName: "Coryphaena hippurus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá nục heo (Coryphaena hippurus), còn gọi là cá heo biển hay Dorado, là vận động viên bơi tốc độ ngoạn mục của đại dương với tốc độ vượt 90 km/h. Cơ thể chúng phát sáng lấp lánh sắc xanh ngọc bích, vàng kim và xanh lam rực rỡ khi săn mồi.",
    description_en: "The mahi-mahi (Coryphaena hippurus) is a magnificent surface-dwelling pelagic fish famous for its brilliant iridescent golden, green, and blue hues and extraordinary speeds exceeding 90 km/h.",
    diet: "Cá chuồn, mực ống, cá trích, cá nục và cua bơi tầng mặt",
    diet_en: "Flying fish, squid, mackerel, clupeids, and floating pelagic crabs",
    size_min_cm: 90, size_max_cm: 140, weight_min_kg: 7.0, weight_max_kg: 25.0, lifespan_years: 5,
    depth_min_m: 1, depth_max_m: 85, pressure_atm: 9.5, temperature_min_c: 21.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chói chang tầng mặt đại dương", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá kinh tế biển khơi", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng biển khơi xa bờ Nam Trung Bộ, Trường Sa, Hoàng Sa",
    local_distribution: "Di cư theo đàn lớn tại vùng biển khơi ngoài khơi Phú Yên, Khánh Hòa, Bình Thuận và quần đảo Hoàng Sa.",
    location_ids: [104, 105, 101],
    facts: [
      "Con đực trưởng thành phát triển chiếc trán dô cao dựng đứng vuông vức thể hiện sức mạnh vượt trội.",
      "Chúng có tập tính nhảy vút lên khỏi mặt nước bắt cá chuồn ngay trên không trung với sự chuẩn xác đáng kinh ngạc.",
      "Khi rời khỏi mặt nước, màu sắc lấp lánh cầu vồng trên cơ thể chúng nhanh chóng phai thành màu xám bạc do các tế bào sắc tố ngừng nhận tín hiệu thần kinh.",
    ],
  },
  // 6. Cá Bò Sao Biển Đông
  {
    code: "FSH-LC-0301",
    slug: "ca-bo-sao-bien-dong",
    common_name: "Cá Bò Sao Biển Đông",
    common_name_en: "Starry Triggerfish",
    scientificName: "Abalistes stellatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá bò sao (Abalistes stellatus) sở hữu lớp da dày như da thuộc phủ đầy đốm trắng li ti như bầu trời sao và hàm răng chắc khỏe có thể cắn vỡ vỏ ốc biển cứng nhất. Gai lưng thứ nhất dựng đứng như chiếc chốt khóa giúp chúng cố định mình an toàn trong hốc đá khi ngủ.",
    description_en: "The starry triggerfish (Abalistes stellatus) is covered in small white dots resembling a starry night and possesses powerful chisel-like teeth designed to crush armored prey.",
    diet: "Cua đáy, cầu gai, ốc biển, sò và giun cát",
    diet_en: "Crabs, sea urchins, mollusks, sand dollars, and worms",
    size_min_cm: 30, size_max_cm: 60, weight_min_kg: 1.5, weight_max_kg: 4.2, lifespan_years: 12,
    depth_min_m: 10, depth_max_m: 100, pressure_atm: 11.0, temperature_min_c: 20.0, temperature_max_c: 28.0,
    light_level: "Ánh sáng vừa đáy cát sỏi thềm lục địa", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.2,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn đáy tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Bắc Bộ, vùng biển miền Trung, Côn Đảo, Trường Sa",
    local_distribution: "Sống ở đáy cát sỏi quanh đảo Bạch Long Vĩ, Cồn Cỏ, Hòn Mê và quần đảo Trường Sa.",
    location_ids: [108, 101, 103, 105],
    facts: [
      "Chúng dùng miệng phun luồng nước mạnh xuống nền cát để thổi bay lớp cát phủ, làm lộ ra các loài nhím biển và ốc ẩn giấu.",
      "Chiếc gai lưng có cơ chế 'chốt khóa' thông minh: chỉ khi hạ gai thứ hai xuống thì gai nhọn thứ nhất mới có thể gập lại.",
      "Chúng có khả năng xoay hai mắt độc lập để vừa theo dõi con mồi dưới đáy vừa quan sát kẻ thù phía trên.",
    ],
  },
  // 7. Cá Hồng Hoàng Đế
  {
    code: "FSH-LC-0302",
    slug: "ca-hong-hoang-de",
    common_name: "Cá Hồng Hoàng Đế",
    common_name_en: "Emperor Red Snapper",
    scientificName: "Lutjanus sebae",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá hồng hoàng đế (Lutjanus sebae) là loài cá săn mồi uy nghi của rạn san hô sâu với thân đỏ thẫm rực rỡ và ba dải sọc đỏ sẫm đặc trưng tạo hình chữ 'V'. Chúng có thể sống hơn 35 năm và đạt trọng lượng vượt 30 kg.",
    description_en: "The emperor red snapper (Lutjanus sebae) is an imposing predatory fish adorned with three broad, deep-red bands that form a distinctive chevron pattern, living over 35 years.",
    diet: "Cá rạn nhỏ, mực ống, tôm he, cua biển và giáp xác tầng đáy",
    diet_en: "Small fishes, squid, stomatopods, crabs, and benthic crustaceans",
    size_min_cm: 50, size_max_cm: 116, weight_min_kg: 5.0, weight_max_kg: 32.0, lifespan_years: 35,
    depth_min_m: 5, depth_max_m: 180, pressure_atm: 19.0, temperature_min_c: 20.0, temperature_max_c: 28.0,
    light_level: "Ánh sáng tán xạ sườn dốc rạn sâu", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.3,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá kinh tế và sinh thái rạn", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Bắc Bộ, Trường Sa, Hoàng Sa, bãi ngầm Tư Chính",
    local_distribution: "Phân bố tại các bãi đá rạn sâu và sườn đồi ngầm quanh đảo Bạch Long Vĩ, quần đảo Hoàng Sa và Trường Sa.",
    location_ids: [108, 104, 105, 103],
    facts: [
      "Cá con thường tìm đến nương náu giữa các gai nhọn của cầu gai biển Diadema để trốn tránh kẻ săn mồi.",
      "Khi lớn lên, chúng di chuyển ra vùng nước sâu hơn ở rìa thềm lục địa và trở thành loài săn mồi đầu bảng tại vùng rạn sâu.",
      "Thị giác của chúng đặc biệt nhạy bén trong môi trường ánh sáng xanh thẫm của tầng nước sâu.",
    ],
  },
  // 8. Cá Kẽm Đốm Hề
  {
    code: "FSH-LC-0303",
    slug: "ca-kem-dom-he",
    common_name: "Cá Kẽm Đốm Hề",
    common_name_en: "Harlequin Sweetlips",
    scientificName: "Plectorhinchus chaetodonoides",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá kẽm đốm hề (Plectorhinchus chaetodonoides) nổi tiếng với đôi môi dày mọng như bơm filler và bộ áo phủ đầy đốm đen tròn li ti tựa áo da báo. Cá con có điệu bơi lắc lư uốn éo như vũ công để ngụy trang thành loài sên biển độc rực rỡ.",
    description_en: "The harlequin sweetlips (Plectorhinchus chaetodonoides) features enormously fleshy lips and juvenile coloration that mimics noxious nudibranchs through eccentric swimming motions.",
    diet: "Động vật giáp xác đáy, giun nhiều tơ, cua đá và cá rạn nhỏ ban đêm",
    diet_en: "Benthic crustaceans, polychaetes, small crabs, and resting small fish",
    size_min_cm: 40, size_max_cm: 72, weight_min_kg: 2.0, weight_max_kg: 7.0, lifespan_years: 15,
    depth_min_m: 3, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa hang hốc rạn san hô", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Phú Quốc, Trường Sa",
    local_distribution: "Ban ngày nằm nghỉ dưới các mái vòm san hô Acropora khổng lồ tại vịnh Nha Trang và Côn Đảo.",
    location_ids: [103, 101, 102, 105],
    facts: [
      "Ban ngày chúng tụ tập bất động thành từng đàn nhỏ dưới vòm san hô, đợi đến đêm tối mới tản ra đáy cát săn giáp xác.",
      "Đôi môi dày dặn đóng vai trò lớp đệm cơ bắp bảo vệ miệng khi chúng sục sạo vào các khe đá sắc nhọn tìm mồi.",
      "Chúng có thể phát ra âm thanh cọt kẹt lớn bằng cách cọ xát răng họng để cảnh báo lãnh thổ khi bị quấy rầy.",
    ],
  },
  // 9. Cá Dìa Mõm Cáo
  {
    code: "FSH-LC-0304",
    slug: "ca-dia-mom-cao",
    common_name: "Cá Dìa Mõm Cáo",
    common_name_en: "Foxface Rabbitfish",
    scientificName: "Siganus vulpinus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá dìa mõm cáo (Siganus vulpinus) có chiếc mõm nhọn kéo dài tựa mõm cáo, thân vàng óng tương phản với đầu sọc vằn đen trắng. Các tia vây lưng và vây bụng chứa tuyến nọc độc tự vệ giúp bảo vệ chúng khỏi mọi loài cá săn mồi hung dữ.",
    description_en: "The foxface rabbitfish (Siganus vulpinus) is distinguished by a fox-like snout, bright yellow posterior body, and venomous fin spines capable of inflicting excruciating stings.",
    diet: "Tảo sợi bám rạn, rong biển lục, rong câu và màng rêu đá",
    diet_en: "Filamentous algae, macroalgae, caulerpa, and encrusting turf algae",
    size_min_cm: 18, size_max_cm: 25, weight_min_kg: 0.3, weight_max_kg: 0.8, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng rực rỡ bãi rạn nông và đầm phá", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài kiểm soát tảo rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Cù Lao Chàm, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Kiếm ăn miệt mài trên các vách đá san hô quanh bãi bàng Cù Lao Chàm và rạn cạn Hòn Mun.",
    location_ids: [102, 103, 101, 105],
    facts: [
      "Chúng đóng vai trò như 'máy cắt cỏ' bảo vệ rạn san hô bằng cách dọn sạch tảo sợi lấn át san hô sống.",
      "Khi ngủ hoặc cảm thấy bất an, màu vàng rực rỡ của chúng lập tức chuyển sang hoa văn vằn vện xám nâu để ngụy trang.",
      "Chúng ghép đôi trọn đời và luôn đi kiếm ăn cùng nhau: một con cắm đầu gặm tảo thì con kia bơi cảnh giới nguy hiểm.",
    ],
  },
  // 10. Cá Bướm Cờ San Hô
  {
    code: "FSH-LC-0305",
    slug: "ca-buom-co-san-ho",
    common_name: "Cá Bướm Cờ San Hô",
    common_name_en: "Longfin Bannerfish",
    scientificName: "Heniochus acuminatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá bướm cờ san hô (Heniochus acuminatus) sở hữu chiếc vây lưng thứ tư kéo dài như một dải cờ trắng bay bổng trong làn nước biển trong vắt. Hai dải sọc đen chéo thân trên nền trắng tuyết tạo vẻ đẹp thanh tao thoát tục cho vùng rạn san hô.",
    description_en: "The longfin bannerfish (Heniochus acuminatus) features a strikingly extended white dorsal filament resembling a pennant flag waving gently in ocean currents.",
    diet: "Động vật phù du trôi dạt, giun đáy biển và polyp san hô mềm",
    diet_en: "Zooplankton, benthic invertebrates, polychaetes, and soft coral polyps",
    size_min_cm: 15, size_max_cm: 25, weight_min_kg: 0.2, weight_max_kg: 0.5, lifespan_years: 10,
    depth_min_m: 2, depth_max_m: 75, pressure_atm: 8.5, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa rạn san hô và vách đá ngầm", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá cảnh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Hoàng Sa, Trường Sa, Côn Đảo",
    local_distribution: "Bơi thành từng đôi uyên ương hoặc đàn nhỏ dọc theo sườn dốc san hô ngoài khơi Nha Trang và Trường Sa.",
    location_ids: [103, 104, 105, 101],
    facts: [
      "Chiếc 'lá cờ' dài phía sau giúp chúng trông to lớn hơn nhiều lần trong mắt kẻ săn mồi nhằm giảm nguy cơ bị tấn công.",
      "Cá con đóng vai trò như cá vệ sinh, thường xuyên rỉa sạch ký sinh trùng trên da các loài cá lớn hơn.",
      "Chúng có khả năng bơi lùi và lượn tròn tại chỗ vô cùng khéo léo nhờ sự phối hợp nhịp nhàng của các vây ngực.",
    ],
  },
  // 11. Cá Kỳ Lân Môi Cam
  {
    code: "FSH-LC-0306",
    slug: "ca-ky-lan-moi-cam",
    common_name: "Cá Kỳ Lân Môi Cam",
    common_name_en: "Orangespine Unicornfish",
    scientificName: "Naso lituratus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá kỳ lân môi cam (Naso lituratus) gây ấn tượng với đôi môi cam rực rỡ như tô son và hai chiếc gai nhọn sắc như dao mổ bọc trong bao màu cam sáng nằm ở hai bên gốc đuôi. Đây là vũ khí tự vệ chết người trước các đòn tấn công của cá mập.",
    description_en: "The orangespine unicornfish (Naso lituratus) features bright orange lips and a pair of razor-sharp, forward-pointing orange scalpels on either side of the caudal peduncle.",
    diet: "Rong nâu bám rạn (Sargassum, Dictyota) và tảo lá san hô",
    diet_en: "Brown macroalgae (Sargassum, Dictyota), leafy reef algae, and red turf algae",
    size_min_cm: 25, size_max_cm: 45, weight_min_kg: 0.8, weight_max_kg: 2.5, lifespan_years: 20,
    depth_min_m: 1, depth_max_m: 90, pressure_atm: 10.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng rạn và vách sóng vỗ", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài ăn thực vật rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Tuần tra các dốc rạn đón sóng ngoài khơi Hòn Mun, đảo Nam Yết và Hòn Cau Côn Đảo.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Hai chiếc gai ở đuôi sắc lẹm như lưỡi dao cạo, có thể cắt đứt da cá săn mồi chỉ bằng một cú quẫy đuôi ngang uy lực.",
      "Con đực trưởng thành phát triển các sợi vây đuôi dài thướt tha dùng để múa quyến rũ con cái trong mùa sinh sản.",
      "Chúng là một trong những loài cá rạn hiếm hoi chuyên ăn rong nâu dai cứng, ngăn chặn rong nâu bóp nghẹt các mầm san hô non.",
    ],
  },
  // 12. Cá Thia Đỏ Biển San Hô
  {
    code: "FSH-LC-0307",
    slug: "ca-thia-do-bien-san-ho",
    common_name: "Cá Thia Đỏ Biển San Hô",
    common_name_en: "Sea Goldie (Lyretail Anthias)",
    scientificName: "Pseudanthias squamipinnis",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá thia đỏ biển san hô (Pseudanthias squamipinnis) phủ sắc đỏ cam và hồng cánh sen lộng lẫy trên các đỉnh rạn san hô, tụ hội thành những đám mây hàng nghìn con chao lượn theo dòng chảy. Chúng là loài lưỡng tính tuần tự đặc trưng: con đực dẫn đầu hậu cung gồm nhiều con cái.",
    description_en: "The sea goldie (Pseudanthias squamipinnis) forms dense, clouds of orange and magenta above coral heads, exhibiting protogynous hermaphroditism where dominant females become males.",
    diet: "Động vật phù du trôi dạt, giáp xác chân chèo (copepods) và trứng cá",
    diet_en: "Zooplankton, copepods, pelagic tunicates, and fish eggs",
    size_min_cm: 8, size_max_cm: 15, weight_min_kg: 0.03, weight_max_kg: 0.08, lifespan_years: 6,
    depth_min_m: 1, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa đỉnh rạn dốc đón dòng chảy", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cảnh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Hoàng Sa, Côn Đảo",
    local_distribution: "Tập hợp thành đàn rực rỡ trên đỉnh các khối san hô Acropora tại Hòn Mun, đảo Trường Sa Lớn và Hòn Cau.",
    location_ids: [103, 105, 104, 101],
    facts: [
      "Tất cả cá con sinh ra đều là giống cái; khi con đực đầu đàn biến mất, con cái to khỏe nhất đàn sẽ chuyển đổi giới tính thành con đực mới.",
      "Cú quẫy đuôi của hàng vạn con cá thia tạo ra các dòng nước lưu thông liên tục, mang oxy tươi mới cho rạn san hô bên dưới.",
      "Khi phát hiện bóng dáng kẻ săn mồi, cả đàn lập tức lặn trốn đồng loạt vào sâu trong các nhánh san hô chỉ trong một cái chớp mắt.",
    ],
  },
  // 13. Cá Nóc Chuột Yên Ngựa
  {
    code: "FSH-LC-0308",
    slug: "ca-noc-chuot-yen-ngua",
    common_name: "Cá Nóc Chuột Yên Ngựa",
    common_name_en: "Valentin's Sharpnose Puffer",
    scientificName: "Canthigaster valentini",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá nóc chuột yên ngựa (Canthigaster valentini) có mõm nhọn dài như chuột và bốn dải sọc yên ngựa màu nâu đen vắt ngang lưng trắng muốt đốm xanh. Da và nội tạng của chúng chứa độc tố thần kinh Tetrodotoxin cực độc giúp chúng ung dung bơi lội giữa ban ngày mà không sợ kẻ thù.",
    description_en: "Valentin's sharpnose puffer (Canthigaster valentini) is patterned with four distinct dark saddle markings and possesses lethal tetrodotoxin throughout its tissues.",
    diet: "Tảo sợi, bọt biển, giun nhiều tơ, rêu san hô và động vật hình rêu",
    diet_en: "Filamentous algae, sponges, polychaetes, bryozoans, and tunicates",
    size_min_cm: 8, size_max_cm: 11, weight_min_kg: 0.05, weight_max_kg: 0.12, lifespan_years: 8,
    depth_min_m: 1, depth_max_m: 55, pressure_atm: 6.5, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa bãi san hô và đầm phá", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá nóc tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Bơi lượn chậm rãi quanh các cụm san hô khối và bãi đá cạn tại Hòn Mun, đảo Thổ Chu và Côn Đảo.",
    location_ids: [103, 101, 106, 105],
    facts: [
      "Loài cá bò Paraluteres prionurus không có độc đã tiến hóa hình dáng và màu sắc giống hệt loài cá nóc này để đánh lừa kẻ săn mồi.",
      "Khi bị đe dọa, chúng bơm căng nước vào bụng để phồng to cơ thể lên gấp đôi, dựng đứng các gai nhỏ dưới da để kẻ thù không thể nuốt trôi.",
      "Độc tố Tetrodotoxin trong cơ thể một con cá nhỏ này có thể gây tử vong cho nhiều động vật săn mồi cỡ lớn.",
    ],
  },
  // 14. Cá Lưỡi Dao Cạo San Hô
  {
    code: "FSH-LC-0309",
    slug: "ca-luoi-dao-cao-san-ho",
    common_name: "Cá Lưỡi Dao Cạo San Hô",
    common_name_en: "Razorfish (Coral Shrimpfish)",
    scientificName: "Aeoliscus strigatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá lưỡi dao cạo san hô (Aeoliscus strigatus) có cơ thể dẹt mỏng như lưỡi dao cạo trong suốt và tập tính bơi chúc đầu thẳng đứng 90 độ xuống dưới. Chúng thường tụ thành đàn bơi nhịp nhàng giữa các gai dài của cầu gai Diadema để ngụy trang hoàn hảo.",
    description_en: "The coral shrimpfish (Aeoliscus strigatus) is encased in transparent, razor-thin armor and swims vertically head-down, blending seamlessly among long sea urchin spines.",
    diet: "Động vật giáp xác phù du, ấu trùng giun biển và tôm chân chèo",
    diet_en: "Micro-crustaceans, mysids, amphipods, and invertebrate larvae",
    size_min_cm: 10, size_max_cm: 15, weight_min_kg: 0.02, weight_max_kg: 0.05, lifespan_years: 5,
    depth_min_m: 1, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng rạn san hô và bụi cầu gai bảo vệ", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cộng sinh rạn", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Tập hợp thành đàn bơi chúc đầu giữa các bụi cầu gai đen tại rạn san hô Hòn Mun, bãi Đầm Trầu Côn Đảo.",
    location_ids: [103, 101, 106, 105],
    facts: [
      "Khi có nguy hiểm ập tới, toàn bộ đàn cá cùng lướt đồng bộ sang một bên mà vẫn giữ nguyên tư thế cắm đầu thẳng đứng độc đáo.",
      "Vây đuôi của chúng bị uốn gập hẳn xuống mặt bụng do gai lưng cứng đã kéo dài vượt ra tận chót đuôi.",
      "Chúng dùng chiếc mõm hình ống hút chớp nhoáng các sinh vật giáp xác siêu nhỏ trôi qua các gai cầu gai che chở.",
    ],
  },
  // 15. Cá Mập Rạn San Hô Xám
  {
    code: "FSH-EN-0310",
    slug: "ca-map-ran-san-ho-xam",
    common_name: "Cá Mập Rạn San Hô Xám",
    common_name_en: "Grey Reef Shark",
    scientificName: "Carcharhinus amblyrhynchos",
    group_slug: "ca-bien",
    status_code: "EN",
    zone_id: 1,
    description: "Cá mập rạn san hô xám (Carcharhinus amblyrhynchos) là kẻ thống trị năng động trên các gờ dốc rạn san hô Thái Bình Dương. Chúng nổi bật với viền đen tuyền dọc theo mép sau của vây đuôi và khả năng bơi lội thần tốc khi truy đuổi con mồi tại các luồng hải lưu xiết.",
    description_en: "The grey reef shark (Carcharhinus amblyrhynchos) is a swift apex predator identifiable by a distinct dark margin along the trailing edge of its caudal fin and assertive territorial displays.",
    diet: "Cá rạn san hô, mực ống, bạch tuộc và tôm cua tầng đáy",
    diet_en: "Reef bony fishes, squids, octopuses, and benthic crustaceans",
    size_min_cm: 150, size_max_cm: 250, weight_min_kg: 20.0, weight_max_kg: 35.0, lifespan_years: 25,
    depth_min_m: 1, depth_max_m: 280, pressure_atm: 29.0, temperature_min_c: 22.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng dốc ngoài rạn san hô và eo biển dốc", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "EN", vietnam_protection_group: "Nhóm II - Loài rạn nguy cấp cấm khai thác", cites_appendix: "Phụ lục II",
    east_sea_zone: "Quần đảo Trường Sa, Hoàng Sa, bãi ngầm Tư Chính",
    local_distribution: "Tuần tra các sườn rạn đón sóng ngoài khơi đảo Nam Yết, Song Tử Tây và rạn đá ngầm Hoàng Sa.",
    location_ids: [105, 104, 101],
    facts: [
      "Khi bị đe dọa, chúng thực hiện 'vũ điệu đe dọa' độc nhất: cong lưng hình chữ U, hạ thấp hai vây ngực và bơi ngoằn ngoèo để cảnh cáo đối thủ.",
      "Khứu giác siêu phàm cho phép chúng phát hiện một giọt máu hòa tan trong hàng triệu lít nước biển từ khoảng cách hàng trăm mét.",
      "Chúng có tập tính hội tụ thành đàn cả trăm con quanh các rạn san hô ngầm vào ban ngày trước khi tản ra săn mồi ban đêm.",
    ],
  },
  // 16. Cá Nhám Đuôi Dài Biển Khơi
  {
    code: "FSH-EN-0311",
    slug: "ca-nham-duoi-dai-bien-khoi",
    common_name: "Cá Nhám Đuôi Dài Biển Khơi",
    common_name_en: "Pelagic Thresher Shark",
    scientificName: "Alopias pelagicus",
    group_slug: "ca-bien",
    status_code: "EN",
    zone_id: 1,
    description: "Cá nhám đuôi dài (Alopias pelagicus) sở hữu chiếc thùy đuôi trên khổng lồ dài bằng đúng chiều dài toàn bộ phần còn lại của cơ thể. Chúng dùng chiếc đuôi này như một chiếc roi da quất mạnh vào mặt nước với vận tốc hơn 80 km/h để làm choáng váng cả đàn cá mồi trước khi ung dung thưởng thức.",
    description_en: "The pelagic thresher shark (Alopias pelagicus) possesses an enormous upper caudal lobe as long as the rest of its body, used as a powerful whip to stun schooling prey.",
    diet: "Đàn cá trích, cá thu nhỏ, mực ống đại dương và cá chuồn",
    diet_en: "Herrings, small mackerels, flying fishes, and pelagic squids",
    size_min_cm: 280, size_max_cm: 380, weight_min_kg: 60.0, weight_max_kg: 150.0, lifespan_years: 29,
    depth_min_m: 1, depth_max_m: 500, pressure_atm: 51.0, temperature_min_c: 16.0, temperature_max_c: 26.0,
    light_level: "Ánh sáng xanh thẳm đại dương xa bờ", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.0,
    vietnam_red_list_status: "EN", vietnam_protection_group: "Nhóm I - Cực kỳ nguy cấp do đánh bắt quá mức", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vùng biển khơi xa bờ miền Trung, Trường Sa, Hoàng Sa",
    local_distribution: "Săn mồi ngoài khơi các rãnh sâu Bình Thuận, bãi ngầm ngoài khơi Trường Sa và Hoàng Sa.",
    location_ids: [104, 105],
    facts: [
      "Cú quất đuôi của cá nhám đuôi dài tạo ra sóng xung kích làm vỡ bọng bơi của hàng chục con cá nhỏ cùng lúc.",
      "Chúng có đôi mắt to mở rộng lên phía trên giúp phát hiện bóng của đàn cá bơi phía trên ngược với ánh sáng mặt trời.",
      "Chúng là một trong số ít loài cá mập có khả năng phóng mình bay vọt lên khỏi mặt nước như cá heo.",
    ],
  },
  // 17. Cá Đuối Nạng Rạn San Hô
  {
    code: "FSH-VU-0312",
    slug: "ca-duoi-nang-ran-san-ho",
    common_name: "Cá Đuối Nạng Rạn San Hô",
    common_name_en: "Reef Manta Ray",
    scientificName: "Mobula alfredi",
    group_slug: "ca-bien",
    status_code: "VU",
    zone_id: 1,
    description: "Cá đuối nạng rạn san hô (Mobula alfredi) là một trong những người khổng lồ hiền lành nhất đại dương với sải cánh vươn tới 5 mét. Hai thùy đầu nhô ra phía trước như đôi cánh quạt hướng dòng nước chở đầy sinh vật phù du vào chiếc miệng khổng lồ khi chúng nhào lộn duyên dáng trên rạn.",
    description_en: "The reef manta ray (Mobula alfredi) is a gentle giant with a wingspan reaching up to 5 meters, filtering tons of plankton with its prominent cephalic fins.",
    diet: "Sinh vật phù du, giáp xác chân chèo, ấu trùng tôm cua và ốc phù du",
    diet_en: "Zooplankton, copepods, euphausiids, and pelagic larvae",
    size_min_cm: 300, size_max_cm: 500, weight_min_kg: 400.0, weight_max_kg: 1400.0, lifespan_years: 40,
    depth_min_m: 1, depth_max_m: 150, pressure_atm: 16.0, temperature_min_c: 22.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa trạm vệ sinh rạn san hô", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "VU", vietnam_protection_group: "Loài quý hiếm bảo tồn nghiêm ngặt", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Thường xuyên ghé thăm các 'trạm làm sạch' tại Hòn Mun, bãi rạn ngoài Côn Đảo và đảo Nam Yết.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Bộ não của cá đuối nạng có tỷ lệ khối lượng so với cơ thể lớn nhất trong tất cả các loài cá, cho thấy trí thông minh xã hội và khả năng nhận thức cao.",
      "Hoa văn đốm trắng đen trên bụng mỗi cá thể là duy nhất trọn đời, giống hệt dấu vân tay của con người.",
      "Chúng có tập tính xếp thành hàng dài nhào lộn vòng cung liên tục (cyclone feeding) để tạo xoáy hút sinh vật phù du vào miệng.",
    ],
  },
  // 18. Cá Mập Đầu Búa Trơn
  {
    code: "FSH-VU-0313",
    slug: "ca-map-dau-bua-tron",
    common_name: "Cá Mập Đầu Búa Trơn",
    common_name_en: "Smooth Hammerhead Shark",
    scientificName: "Sphyrna zygaena",
    group_slug: "ca-bien",
    status_code: "VU",
    zone_id: 1,
    description: "Cá mập đầu búa trơn (Sphyrna zygaena) dễ nhận biết nhờ chiếc đầu búa cong tròn mượt mà ở mép trước mà không có vết khuyết ở giữa như cá mập búa lớn. Chúng là loài thích nghi với vùng nước ôn hòa hơn và di cư theo đàn hàng trăm con dọc theo các dòng hải lưu.",
    description_en: "The smooth hammerhead (Sphyrna zygaena) is distinguished by a broadly curved, smooth front margin of its cephalofoil lacking a central indentation.",
    diet: "Cá trích, cá thu, cá đuối gai độc, mực ống và cá xương biển",
    diet_en: "Bony fishes, stingrays, skates, squids, and crustaceans",
    size_min_cm: 250, size_max_cm: 400, weight_min_kg: 150.0, weight_max_kg: 400.0, lifespan_years: 20,
    depth_min_m: 1, depth_max_m: 200, pressure_atm: 21.0, temperature_min_c: 16.0, temperature_max_c: 26.0,
    light_level: "Ánh sáng tầng mặt và thềm lục địa mở", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.3,
    vietnam_red_list_status: "VU", vietnam_protection_group: "Nhóm II - Cần kiểm soát đánh bắt", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Bắc Bộ, vùng biển miền Trung, Trường Sa, Hoàng Sa",
    local_distribution: "Tuần tra các vùng nước ven thềm lục địa từ đảo Bạch Long Vĩ xuôi vào vùng biển Trường Sa.",
    location_ids: [108, 104, 105],
    facts: [
      "Chiếc đầu búa nhẵn cong giúp chúng giảm lực cản nước tối đa khi bơi nhanh truy đuổi các loài cá săn mồi tầng mặt.",
      "Khoảng cách xa giữa hai mắt giúp chúng có trường nhìn 360 độ theo phương thẳng đứng, bao quát toàn cảnh không gian săn mồi.",
      "Chúng có khả năng điều hòa thân nhiệt phần nào để chịu được các dòng hải lưu lạnh khi lặn sâu tìm mực.",
    ],
  },
  // 19. Cá Ngừ Mắt To Biển Khơi
  {
    code: "FSH-VU-0314",
    slug: "ca-ngu-mat-to-bien-khoi",
    common_name: "Cá Ngừ Mắt To Biển Khơi",
    common_name_en: "Bigeye Tuna",
    scientificName: "Thunnus obesus",
    group_slug: "ca-bien",
    status_code: "VU",
    zone_id: 1,
    description: "Cá ngừ mắt to (Thunnus obesus) sở hữu đôi mắt khổng lồ tròn xoe thích nghi hoàn hảo để săn mồi trong bóng tối của tầng trung nước sâu. Cơ thể chúng chắc nịch hình thoi và hệ thống mạch máu trao đổi nhiệt ngược dòng duy trì thân nhiệt ấm hơn nhiệt độ nước xung quanh.",
    description_en: "The bigeye tuna (Thunnus obesus) is characterized by remarkably large eyes and deep streamline body equipped with counter-current vascular heat exchangers for deep dives.",
    diet: "Cá tầng trung (cá đèn lồng), mực đại dương, giáp xác biển sâu",
    diet_en: "Mesopelagic fishes, lanternfish, oceanic squids, and pelagic crustaceans",
    size_min_cm: 120, size_max_cm: 250, weight_min_kg: 40.0, weight_max_kg: 180.0, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 500, pressure_atm: 51.0, temperature_min_c: 10.0, temperature_max_c: 28.0,
    light_level: "Ánh sáng lờ mờ tầng trung và bóng tối tầng sâu", visibility_m: 18.0, dissolved_oxygen_mg_l: 5.5,
    vietnam_red_list_status: "VU", vietnam_protection_group: "Cá kinh tế biển khơi được bảo vệ nguồn lợi", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng nước sâu rãnh Biển Đông, Trường Sa, Hoàng Sa",
    local_distribution: "Phân bố tại các vùng biển nước sâu ngoài khơi Bình Định, Khánh Hòa và quần đảo Trường Sa.",
    location_ids: [104, 105],
    facts: [
      "Đôi mắt to chứa lớp màng phản chiếu tapetum lucidum siêu nhạy giúp chúng nhìn rõ con mồi ở độ sâu 500 mét nơi ánh sáng gần như biến mất.",
      "Chúng có thể chịu được nồng độ oxy hòa tan cực thấp ở vùng biển sâu mà hầu hết các loài cá ngừ khác không thể tồn tại.",
      "Ban ngày chúng lặn sâu xuống tầng trung săn mực, ban đêm lại nổi lên tầng mặt theo sự di cư thẳng đứng của sinh vật phù du.",
    ],
  },
  // 20. Cá Thu Vạch Hoàng Gia
  {
    code: "FSH-NT-0315",
    slug: "ca-thu-vach-hoang-gia",
    common_name: "Cá Thu Vạch Hoàng Gia",
    common_name_en: "Narrow-barred Spanish Mackerel",
    scientificName: "Scomberomorus commerson",
    group_slug: "ca-bien",
    status_code: "NT",
    zone_id: 1,
    description: "Cá thu vạch hoàng gia (Scomberomorus commerson) là một trong những loài cá săn mồi ven rạn và biển khơi nhanh nhất với hàm răng sắc bén như lưỡi dao cạo. Thân dài thon gọn màu xanh ánh thép phủ những sọc vằn dọc sườn giúp chúng tàng hình hoàn hảo trong làn nước xanh.",
    description_en: "The narrow-barred Spanish mackerel (Scomberomorus commerson) is a formidable pelagic predator adorned with numerous wavy vertical bars and razor-sharp triangular teeth.",
    diet: "Đàn cá cơm, cá trích, cá nục, mực nang và tôm",
    diet_en: "Anchovies, clupeids, scads, squids, and carid shrimp",
    size_min_cm: 90, size_max_cm: 240, weight_min_kg: 10.0, weight_max_kg: 70.0, lifespan_years: 15,
    depth_min_m: 5, depth_max_m: 70, pressure_atm: 8.0, temperature_min_c: 20.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa ven bờ và rạn san hô ngoài khơi", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "NT", vietnam_protection_group: "Cá đặc sản biển Đông cần khai thác bền vững", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Bắc Bộ, vùng biển miền Trung, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Săn mồi dọc theo mép ngoài rạn san hô quanh đảo Bạch Long Vĩ, Côn Đảo, Nha Trang và Hoàng Sa.",
    location_ids: [108, 101, 103, 104, 105],
    facts: [
      "Hàm răng hình tam giác sắc bén như dao cạo cho phép chúng cắn đứt đôi con mồi cỡ lớn chỉ trong một cú táp chớp nhoáng.",
      "Chúng có thể tăng tốc từ vị trí nằm im lên vận tốc tối đa hơn 70 km/h chỉ sau một lần quẫy đuôi mạnh mẽ.",
      "Vào mùa sinh sản, chúng tụ hội thành đàn lớn tại các vùng nước có dòng chảy ngầm giao thoa giàu dinh dưỡng.",
    ],
  },
  // 21. Cá Heo Risso Xám Tro
  {
    code: "MAM-LC-0316",
    slug: "ca-heo-risso-xam-tro",
    common_name: "Cá Heo Risso Xám Tro",
    common_name_en: "Risso's Dolphin",
    scientificName: "Grampus griseus",
    group_slug: "dong-vat-co-vu-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá heo Risso (Grampus griseus) có chiếc đầu tròn vo không mỏ với một rãnh dọc đặc trưng ở trán và lớp da xám tro chằng chịt những vết sẹo trắng do những cuộc giao chiến với đồng loại và xúc tu của mực khổng lồ. Chúng là chuyên gia lặn sâu săn mực đại dương.",
    description_en: "Risso's dolphin (Grampus griseus) is recognized by its blunt, beakless head with a vertical frontal crease and extensive white scar patterns covering its grey body.",
    diet: "Mực ống đại dương, bạch tuộc biển sâu và mực nang",
    diet_en: "Oceanic cephalopods, deep-sea squids, octopuses, and cuttlefish",
    size_min_cm: 280, size_max_cm: 400, weight_min_kg: 300.0, weight_max_kg: 500.0, lifespan_years: 35,
    depth_min_m: 1, depth_max_m: 1000, pressure_atm: 101.0, temperature_min_c: 12.0, temperature_max_c: 28.0,
    light_level: "Ánh sáng tầng mặt khi thở và bóng tối sâu thẳm khi săn mồi", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.0,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Động vật biển có vú bảo vệ quốc tế", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vùng nước sâu dốc lục địa ngoài khơi miền Trung, Trường Sa, Hoàng Sa",
    local_distribution: "Tuần tra các rìa thềm lục địa sâu ngoài khơi Nha Trang, Côn Đảo và bồn trũng Biển Đông.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Hầu hết các vết sẹo trắng trên da chúng tồn tại vĩnh viễn, cá thể càng già thì cơ thể càng chuyển sang màu trắng xóa.",
      "Chúng gần như không có răng ở hàm trên, chỉ có từ 2 đến 7 đôi răng ở hàm dưới dùng để kẹp chặt những con mực trơn trượt.",
      "Hệ thống định vị sóng âm (echolocation) của cá heo Risso phát ra các xung tần số cao cực mạnh dò tìm mực trong bóng đêm hoàn toàn.",
    ],
  },
  // 22. Cá Nhà Táng Lùn
  {
    code: "MAM-LC-0317",
    slug: "ca-nha-tang-lun",
    common_name: "Cá Nhà Táng Lùn",
    common_name_en: "Dwarf Sperm Whale",
    scientificName: "Kogia sima",
    group_slug: "dong-vat-co-vu-bien",
    status_code: "LC",
    zone_id: 2,
    description: "Cá nhà táng lùn (Kogia sima) là một trong những loài cá voi có răng nhỏ nhất thế giới với chiều dài dưới 2.7 mét. Chúng sở hữu chiếc hàm dưới thụt sâu tí hon và cơ chế phòng vệ kỳ lạ: phun ra một đám mây chất lỏng màu nâu đỏ giống mực khi gặp nguy hiểm để trốn thoát.",
    description_en: "The dwarf sperm whale (Kogia sima) is a small, elusive cetacean with an underslung jaw and a unique defensive ink sac used to release a reddish-brown cloud when threatened.",
    diet: "Mực ống đại dương, cá biển sâu và tôm tầng trung",
    diet_en: "Mesopelagic squids, deep-water fishes, and caridean shrimp",
    size_min_cm: 200, size_max_cm: 270, weight_min_kg: 150.0, weight_max_kg: 280.0, lifespan_years: 22,
    depth_min_m: 10, depth_max_m: 1000, pressure_atm: 101.0, temperature_min_c: 8.0, temperature_max_c: 26.0,
    light_level: "Bóng tối tầng trung thềm lục địa sâu", visibility_m: 15.0, dissolved_oxygen_mg_l: 5.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Động vật có vú biển quý hiếm", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vùng biển sâu thềm lục địa ngoài khơi Nam Trung Bộ và Trường Sa",
    local_distribution: "Ghi nhận ngoài khơi vùng dốc sâu Bình Thuận, Khánh Hòa và quần đảo Trường Sa.",
    location_ids: [105, 104],
    facts: [
      "Túi mực của chúng nằm trong ruột có thể chứa tới 12 lít chất lỏng màu nâu đỏ để làm đục ngầu làn nước khi cá mập tấn công.",
      "Hai bên cổ chúng có nếp gấp màu trắng trông giống hệt khe mang của cá, giúp chúng ngụy trang thành cá mập hung dữ.",
      "Chúng có thói quen nổi bất động trên mặt nước như một khúc gỗ trôi để nghỉ ngơi và nạp oxy sau những chuyến lặn sâu thẳm.",
    ],
  },
  // 23. Cá Đuôi Gai Bột Xanh
  {
    code: "FSH-LC-0318",
    slug: "ca-duoi-gai-bot-xanh",
    common_name: "Cá Đuôi Gai Bột Xanh",
    common_name_en: "Powder Blue Tang",
    scientificName: "Acanthurus leucosternon",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá đuôi gai bột xanh (Acanthurus leucosternon) là một trong những kiệt tác màu sắc rực rỡ nhất biển cả với thân xanh lam phấn mịn màng, vây lưng vàng chanh và cổ trắng muốt. Chúng có tính bảo vệ lãnh thổ cực kỳ quyết liệt để bảo vệ thảm tảo nuôi sống mình.",
    description_en: "The powder blue tang (Acanthurus leucosternon) features an unmistakable powdery sky-blue body, bright yellow dorsal fin, and deep black face mask framed by a white breast.",
    diet: "Tảo sợi bám rạn san hô, rong biển lục và rêu đá",
    diet_en: "Benthic algae, filamentous turf algae, and microalgae",
    size_min_cm: 18, size_max_cm: 23, weight_min_kg: 0.3, weight_max_kg: 0.7, lifespan_years: 15,
    depth_min_m: 1, depth_max_m: 25, pressure_atm: 3.5, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa đỉnh rạn nông đón sóng", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, quần đảo Trường Sa",
    local_distribution: "Tuần tra các đỉnh rạn san hô cạn nhiều sóng tại Hòn Mun, đảo Nam Yết và Côn Đảo.",
    location_ids: [103, 101, 105, 106],
    facts: [
      "Chiếc gai nhọn sắc như dao mổ ở gốc đuôi có màu vàng tươi để cảnh báo đối thủ về vũ khí nguy hiểm của nó.",
      "Chúng có thể tập hợp thành đàn hàng trăm con để cùng ùa vào 'cướp' thảm tảo trên lãnh thổ của các loài cá rạn hung dữ khác.",
      "Việc chúng liên tục cạo sạch các lớp tảo sợi bám trên rạn giúp các mầm san hô non có không gian trống để bám rễ và phát triển.",
    ],
  },
  // 24. Cá Thiên Thần Lửa
  {
    code: "FSH-LC-0319",
    slug: "ca-thien-than-lua",
    common_name: "Cá Thiên Thần Lửa",
    common_name_en: "Flame Angelfish",
    scientificName: "Centropyge loricula",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá thiên thần lửa (Centropyge loricula) rực cháy như một đốm than hồng dưới đáy biển với cơ thể đỏ cam rực lửa, các sọc đen dọc thân và viền vây xanh lam huỳnh quang phát sáng. Chúng là loài cá thiên thần lùn năng động ẩn hiện trong các mê cung san hô cành.",
    description_en: "The flame angelfish (Centropyge loricula) glows like an ember with its radiant fiery orange-red body, vertical black bars, and vibrant electric-blue fin fringes.",
    diet: "Rong rêu rạn, vi sinh vật bám đá, giun rạn và ấu trùng giáp xác",
    diet_en: "Algae, detritus, ascidians, and small benthic invertebrates",
    size_min_cm: 8, size_max_cm: 15, weight_min_kg: 0.05, weight_max_kg: 0.15, lifespan_years: 7,
    depth_min_m: 2, depth_max_m: 60, pressure_atm: 7.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng tán xạ qua kẽ rạn san hô", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cảnh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Len lỏi trong các khe nứt rạn san hô ngầm tại Hòn Mun, bãi đá ngầm đảo Nam Yết và Phú Quý.",
    location_ids: [103, 105, 104],
    facts: [
      "Vào lúc hoàng hôn buông xuống, con đực nhảy múa quyến rũ con cái bằng cách bơi vút lên mặt nước cùng nhau để thụ tinh cho trứng trôi theo dòng.",
      "Chúng có một gai nhọn nhỏ ở nắp mang giúp chống lại kẻ săn mồi muốn ngoạm đầu chúng.",
      "Màu đỏ rực rỡ của chúng thực chất là lớp ngụy trang tuyệt hảo dưới nước sâu, vì ánh sáng đỏ bị nước biển hấp thụ đầu tiên khiến chúng trở nên tàng hình.",
    ],
  },
  // 25. Cá Chình Bông Sao Tuyết
  {
    code: "FSH-LC-0320",
    slug: "ca-chinh-bong-sao-tuyet",
    common_name: "Cá Chình Bông Sao Tuyết",
    common_name_en: "Snowflake Moray Eel",
    scientificName: "Echidna nebulosa",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá chình bông sao tuyết (Echidna nebulosa) là loài cá chình tuyệt đẹp với thân trắng muốt phủ đầy các hoa văn hình hoa tuyết đen đốm vàng và đôi mắt vàng rực. Khác với các loài cá chình khác có răng sắc nhọn để xé thịt, chúng có hàm răng cùn hình hạt để nghiền nát vỏ cua.",
    description_en: "The snowflake moray (Echidna nebulosa) features an intricate white body adorned with star-like black and yellow floral rosettes and blunt molariform teeth for crushing crustaceans.",
    diet: "Cua biển, tôm đá rạn san hô và nhuyễn thể vỏ cứng",
    diet_en: "Crabs, reef shrimp, mantis shrimps, and small shelled mollusks",
    size_min_cm: 50, size_max_cm: 100, weight_min_kg: 0.8, weight_max_kg: 2.2, lifespan_years: 15,
    depth_min_m: 1, depth_max_m: 48, pressure_atm: 5.8, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa khe đá và vùng thủy triều cạn", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn đáy tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa, Hoàng Sa",
    local_distribution: "Trú ẩn trong các hốc đá và rạn san hô nông tại Hòn Mun, Côn Đảo và đảo Song Tử Tây.",
    location_ids: [103, 101, 102, 105],
    facts: [
      "Hàm răng dẹt dạng cối nghiền cho phép chúng cắn vỡ vụn mai cua cứng một cách dễ dàng mà không làm mẻ răng.",
      "Chúng có khả năng thò cả nửa thân trên lên khỏi mặt nước khi thủy triều rút để săn những con cua đang chạy trên bờ đá.",
      "Hệ thống khứu giác dạng ống nhô ra phía trước mũi cực kỳ nhạy bén giúp chúng ngửi thấy mùi cua từ khoảng cách rất xa.",
    ],
  },
  // 26. Cá Ngát Vạch Sọc Biển
  {
    code: "FSH-LC-0321",
    slug: "ca-ngat-vach-soc-bien",
    common_name: "Cá Ngát Vạch Sọc Biển",
    common_name_en: "Striped Eel Catfish",
    scientificName: "Plotosus lineatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá ngát vạch sọc biển (Plotosus lineatus) là loài cá da trơn duy nhất sinh sống hoàn toàn trong rạn san hô biển. Cá con tụ tập thành đàn hình cầu lăn cuộn tròn nhịp nhàng tựa quả cầu gai sống trên đáy cát, với các gai vây lưng và vây ngực tẩm nọc độc cực mạnh có thể gây nguy hiểm chết người.",
    description_en: "The striped eel catfish (Plotosus lineatus) is the only catfish found on coral reefs, renowned for its juveniles forming tight, rolling ball-like aggregations with highly venomous spines.",
    diet: "Giáp xác nhỏ tầng đáy, động vật thân mềm, giun cát và cá nhỏ",
    diet_en: "Benthic crustaceans, mollusks, polychaete worms, and small fishes",
    size_min_cm: 15, size_max_cm: 32, weight_min_kg: 0.2, weight_max_kg: 0.6, lifespan_years: 7,
    depth_min_m: 1, depth_max_m: 60, pressure_atm: 7.0, temperature_min_c: 22.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng bãi cát bùn và rễ rừng ngập mặn", visibility_m: 15.0, dissolved_oxygen_mg_l: 6.2,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá có nọc độc ven bờ", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Hạ Long, Cần Giờ, Phú Quốc, Nha Trang, Côn Đảo",
    local_distribution: "Kiếm ăn quanh bãi bùn rạn cạn và rừng ngập mặn Cần Giờ, Côn Đảo và Phú Quốc.",
    location_ids: [107, 101, 106, 103],
    facts: [
      "Quả cầu đàn cá con cuộn tròn liên tục: những con ở ngoài bơi vào trong và ngược lại để cùng sục sạo cát tìm mồi và bảo vệ lẫn nhau.",
      "Gai lưng và hai gai ngực có răng cưa ngược tẩm nọc độc thần kinh gây đau đớn dữ dội và có thể dẫn đến trụy tim.",
      "Bốn cặp râu quanh miệng chứa hàng vạn nụ vị giác giúp chúng nếm được vị con mồi vùi sâu dưới lớp cát.",
    ],
  },
  // 27. Cá Rồng Cánh Mỏng
  {
    code: "FSH-LC-0322",
    slug: "ca-rong-canh-mong",
    common_name: "Cá Rồng Cánh Mỏng",
    common_name_en: "Longtail Seamoth",
    scientificName: "Pegasus volitans",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá rồng cánh mỏng (Pegasus volitans) trông như một sinh vật huyền thoại bước ra từ thần thoại với cơ thể bọc giáp xương dẹt và đôi vây ngực xòe rộng như đôi cánh bướm viền xanh biếc. Chúng bò dọc theo đáy cát bằng các tia vây bụng biến đổi linh hoạt.",
    description_en: "The longtail seamoth (Pegasus volitans) resembles a miniature dragon clad in flattened bony plates with expansive, wing-like pectoral fins used to glide over sandy substrates.",
    diet: "Động vật chân đều nhỏ, giun cát, giáp xác tầng đáy và ấu trùng sò",
    diet_en: "Small isopods, amphipods, polychaetes, and tiny benthic mollusks",
    size_min_cm: 10, size_max_cm: 18, weight_min_kg: 0.03, weight_max_kg: 0.08, lifespan_years: 5,
    depth_min_m: 1, depth_max_m: 73, pressure_atm: 8.3, temperature_min_c: 22.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa thảm cỏ biển và bãi cát đáy", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật đáy độc đáo", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Cù Lao Chàm, Phú Quốc",
    local_distribution: "Bò trên đáy bùn cát ven các thảm cỏ biển Cù Lao Chàm, Phú Quốc và đầm Nha Phu.",
    location_ids: [102, 106, 103],
    facts: [
      "Chúng có tập tính lột toàn bộ lớp da giáp xương ngoài cùng trong một lần giống như loài rắn lột xác để loại bỏ ký sinh trùng.",
      "Chiếc mõm dài dẹt hoạt động như một máy hút bụi tí hon hút sạch giun cát khi chúng bò lướt qua.",
      "Đôi vây ngực sải rộng có thể biến đổi màu sắc để hòa lẫn hoàn toàn vào các hạt cát thô xung quanh khi gặp nguy hiểm.",
    ],
  },
  // 28. Cá Lưỡi Gươm Lòe Loẹt
  {
    code: "FSH-LC-0323",
    slug: "ca-luoi-guom-loe-loet",
    common_name: "Cá Lưỡi Gươm Lòe Loẹt",
    common_name_en: "Harlequin Ghost Pipefish",
    scientificName: "Solenostomus paradoxus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá lưỡi gươm lòe loẹt (Solenostomus paradoxus) là bậc thầy ngụy trang đỉnh cao của đại dương với các tua da gai góc tua tủa giống hệt một nhánh san hô mềm hoặc huệ biển crinoid. Chúng lơ lửng chúc đầu bất động bên cạnh các nhánh san hô để rình mồi.",
    description_en: "The harlequin ghost pipefish (Solenostomus paradoxus) is a master of camouflage adorned with intricate fringed skin flaps mimicking feather stars or crinoids.",
    diet: "Tôm nhỏ phù du, ấu trùng mysid và giáp xác rạn san hô",
    diet_en: "Mysid shrimps, small pelagic crustaceans, and invertebrate larvae",
    size_min_cm: 8, size_max_cm: 12, weight_min_kg: 0.01, weight_max_kg: 0.03, lifespan_years: 3,
    depth_min_m: 3, depth_max_m: 35, pressure_atm: 4.5, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng tán xạ bên các nhánh san hô quạt", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật rạn ngụy trang quý hiếm", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Côn Đảo",
    local_distribution: "Ngụy trang bên cạnh các bụi huệ biển tại Hòn Mun và vách đá ngầm đảo Nam Yết.",
    location_ids: [103, 105, 101],
    facts: [
      "Khác với cá ngựa thông thường con đực mang thai, ở loài này chính con cái mang trứng trong một chiếc túi ấp tạo bởi các vây bụng biến đổi rộng.",
      "Chúng có thể thay đổi màu sắc và độ dài của các tua da để thích ứng chính xác với loài huệ biển mà chúng chọn làm nhà.",
      "Chiếc miệng hình ống hút con mồi với tốc độ chỉ vài phần nghìn giây, tạo ra lực hút chân không cực mạnh.",
    ],
  },
  // 29. Cá Đỏ Lửa Rạn San Hô
  {
    code: "FSH-LC-0324",
    slug: "ca-do-lua-ran-san-ho",
    common_name: "Cá Đỏ Lửa Rạn San Hô",
    common_name_en: "Flame Hawkfish",
    scientificName: "Neocirrhites armatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá đỏ lửa (Neocirrhites armatus) rực sáng với màu đỏ thắm tuyền, vòng đen nổi bật quanh mắt và dải đen tuyền chạy dọc lưng. Chúng không có bọng bơi nên có tập tính độc đáo là nằm đậu trên đỉnh các cành san hô Acropora như chim ưng đậu trên cành cây để quan sát xung quanh.",
    description_en: "The flame hawkfish (Neocirrhites armatus) boasts intense scarlet coloration and black eye markings, lacking a swim bladder and perching atop coral branches like a watchful hawk.",
    diet: "Tôm rạn nhỏ, cua đá nhỏ, ấu trùng cá và giun rạn",
    diet_en: "Small crustaceans, hermit crabs, small fishes, and benthic worms",
    size_min_cm: 6, size_max_cm: 9, weight_min_kg: 0.02, weight_max_kg: 0.05, lifespan_years: 8,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa đỉnh rạn san hô cành", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cảnh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Đậu trên các khối san hô Acropora và Pocillopora tại Hòn Mun và rạn san hô Trường Sa.",
    location_ids: [103, 105, 104],
    facts: [
      "Do không có bọng bơi, chúng chìm tự nhiên xuống đáy và dùng đôi vây ngực dày cơ bắp để bám chặt vào nhánh san hô trước sóng lớn.",
      "Đôi mắt lồi của chúng có thể chuyển động hoàn toàn độc lập với nhau để theo dõi hai con mồi khác nhau cùng lúc.",
      "Khi phát hiện con tôm nhỏ bơi ngang, chúng phóng vút đi đớp gọn rồi lập tức quay trở lại đúng vị trí cành san hô cũ.",
    ],
  },
  // 30. Cá Kèn San Hô Biển Đông
  {
    code: "FSH-LC-0325",
    slug: "ca-ken-san-ho-bien-dong",
    common_name: "Cá Kèn San Hô Biển Đông",
    common_name_en: "Chinese Trumpetfish",
    scientificName: "Aulostomus chinensis",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá kèn san hô (Aulostomus chinensis) có thân dài như một cây gậy với chiếc miệng loe hình kèn và một sợi râu nhỏ ở cằm. Chúng có khả năng đổi màu kỳ diệu từ vàng rực sang nâu xám và tập tính bơi nép sát lưng các loài cá lớn ăn cỏ để lẻn vào gần con mồi.",
    description_en: "The Chinese trumpetfish (Aulostomus chinensis) has an elongated, stick-like body with an expandable trumpet-shaped snout, often shadowing large herbivorous fish to sneak up on prey.",
    diet: "Cá rạn nhỏ, tôm rạn, cá thia và cá bống",
    diet_en: "Small reef fishes, damselfishes, gobies, and caridean shrimp",
    size_min_cm: 40, size_max_cm: 80, weight_min_kg: 0.6, weight_max_kg: 2.0, lifespan_years: 10,
    depth_min_m: 2, depth_max_m: 120, pressure_atm: 13.0, temperature_min_c: 22.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng rạn san hô và vách đá dốc", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn săn mồi tự nhiên", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Ẩn mình giữa các nhánh quạt biển hoặc nép mình sau lưng cá vẹt tại Hòn Mun và Côn Đảo.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Chiếc miệng hình kèn có thể mở rộng đường kính ra gấp nhiều lần cơ thể để nuốt trọn những con cá có kích thước to hơn đầu nó.",
      "Chiến thuật săn mồi 'bóng ma': bơi sát cạnh một con cá vẹt vô hại để che giấu thân hình, khi cá nhỏ lơ là sẽ lao ra nuốt chửng.",
      "Chúng có thể giữ cơ thể thẳng đứng hoàn toàn, lắc lư theo dòng nước giả làm một nhánh san hô roi mềm.",
    ],
  },
  // 31. Cá Dọc Dưa Miệng Kèn
  {
    code: "FSH-LC-0326",
    slug: "ca-doc-dua-mieng-ken",
    common_name: "Cá Dọc Dưa Miệng Kèn",
    common_name_en: "Bluespotted Cornetfish",
    scientificName: "Fistularia commersonii",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá dọc dưa miệng kèn (Fistularia commersonii) có thân hình mảnh khảnh dẹp dài tới 1.6 mét với một sợi tơ đuôi dài thò ra từ giữa vây đuôi. Cơ thể màu xanh lục ánh bạc với hai hàng đốm xanh lam chạy dọc sống lưng giúp chúng hòa mình vào làn nước trong.",
    description_en: "The bluespotted cornetfish (Fistularia commersonii) features an extremely slender, depressed body with a long filament projecting from the center of the tail.",
    diet: "Cá nhỏ rạn san hô, tôm phù du tầng đáy và ấu trùng cá",
    diet_en: "Small schooling fishes, anchovies, damselfishes, and bottom crustaceans",
    size_min_cm: 80, size_max_cm: 160, weight_min_kg: 1.5, weight_max_kg: 4.0, lifespan_years: 8,
    depth_min_m: 1, depth_max_m: 130, pressure_atm: 14.0, temperature_min_c: 21.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa thảm rạn và nước mở ven đảo", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá săn mồi ven rạn", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa, Hoàng Sa",
    local_distribution: "Lơ lửng ngay dưới mặt nước trên các rạn san hô Hòn Mun, đảo Phú Quý và Côn Đảo.",
    location_ids: [103, 101, 102, 105],
    facts: [
      "Sợi tơ đuôi dài ở cuối cơ thể chứa các cơ quan cảm giác áp lực nước giúp phát hiện chuyển động của kẻ săn mồi bơi phía sau.",
      "Chúng bơi lướt đi vô cùng nhẹ nhàng không tạo ra bất kỳ gợn sóng nào, áp sát đàn cá trích trước khi hút mồi.",
      "Chúng có thể chuyển sang hoa văn vằn vện đen trắng sẫm màu khi săn mồi ban đêm hoặc khi lặn xuống đáy cát.",
    ],
  },
  // 32. Cá Ép Cỡ Lớn
  {
    code: "FSH-LC-0327",
    slug: "ca-ep-co-lon",
    common_name: "Cá Ép Cỡ Lớn",
    common_name_en: "Live Sharksucker (Remora)",
    scientificName: "Echeneis naucrates",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá ép cỡ lớn (Echeneis naucrates) sở hữu một giác hút hình bầu dục đặc biệt trên đỉnh đầu biến đổi từ vây lưng thứ nhất. Giác hút này tạo ra lực hút chân không cực mạnh giúp chúng bám chặt vào cá mập, cá đuối, rùa biển hoặc tàu thuyền để đi nhờ và hưởng thức ăn thừa.",
    description_en: "The live sharksucker (Echeneis naucrates) is equipped with a flat oval cephalic sucker pad modified from the dorsal fin, enabling it to hitchhike on larger marine animals.",
    diet: "Thức ăn thừa của cá mập/rùa biển, ký sinh trùng ngoài da và giáp xác nhỏ",
    diet_en: "Host scraps, parasitic copepods, small fish, and plankton",
    size_min_cm: 50, size_max_cm: 110, weight_min_kg: 1.0, weight_max_kg: 3.2, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 85, pressure_atm: 9.5, temperature_min_c: 20.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa tầng mặt biển khơi và ven rạn", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cộng hội đại dương", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Bắc Bộ, Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Bám theo các loài cá mập và cá đuối tại Nha Trang, Côn Đảo và vùng biển khơi Trường Sa.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Lực hút của giác hút mạnh tới mức trong lịch sử người bản địa đã buộc dây vào đuôi cá ép để thả xuống biển bắt rùa biển.",
      "Quan hệ giữa cá ép và vật chủ là cộng sinh tương hỗ: cá ép được đi nhờ và ăn thức ăn thừa, đổi lại nó dọn sạch ký sinh trùng trên da vật chủ.",
      "Nếu vật chủ bơi càng nhanh về phía trước thì lực giữ của giác hút càng siết chặt lại do cấu trúc các phiến xếp nghiêng.",
    ],
  },
  // 33. Cá Cóc Khổng Lồ
  {
    code: "FSH-LC-0328",
    slug: "ca-coc-khong-lo",
    common_name: "Cá Cóc Khổng Lồ",
    common_name_en: "Giant Frogfish",
    scientificName: "Antennarius commerson",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá cóc khổng lồ (Antennarius commerson) là bậc thầy ngụy trang phục kích lớn nhất trong họ cá cóc với chiều dài đạt gần 40 cm. Chúng có chiếc 'cần câu' biến đổi từ gai lưng thứ nhất mang mồi câu giả hình con tôm để nhử cá nhỏ đến gần chiếc miệng khổng lồ có thể nuốt chửng con mồi to bằng cơ thể nó.",
    description_en: "The giant frogfish (Antennarius commerson) is a sedentary ambush predator disguised as a sponge, dangling a lure (esca) to attract unsuspecting fish into its cavernous mouth.",
    diet: "Cá rạn bơi qua, tôm cua rạn san hô và bạch tuộc con",
    diet_en: "Reef fishes, crustaceans, damselfishes, and juvenile cephalopods",
    size_min_cm: 20, size_max_cm: 38, weight_min_kg: 0.8, weight_max_kg: 2.5, lifespan_years: 10,
    depth_min_m: 1, depth_max_m: 70, pressure_atm: 8.0, temperature_min_c: 22.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa hốc san hô và bọt biển", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Cá rạn ngụy trang độc đáo", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa",
    local_distribution: "Ngụy trang hoàn hảo bên cạnh các khối bọt biển tại Hòn Mun và rạn san hô Côn Đảo.",
    location_ids: [103, 101, 105],
    facts: [
      "Tốc độ há miệng đớp mồi của chúng chỉ mất 6 phần nghìn giây (0.006s) - một trong những động tác tấn công nhanh nhất thế giới động vật.",
      "Chúng có thể đổi màu cơ thể qua nhiều tuần từ vàng tươi, đỏ cam sang đen tuyền để hòa lẫn hoàn hảo vào cụm bọt biển xung quanh.",
      "Đôi vây ngực có khớp khuỷu tay linh hoạt giúp chúng có thể 'đi bộ' lạch bạch trên đáy biển thay vì bơi lội.",
    ],
  },
  // 34. Mực Nang Lòe Loẹt
  {
    code: "MOL-DD-0329",
    slug: "muc-nang-loe-loet",
    common_name: "Mực Nang Lòe Loẹt",
    common_name_en: "Flamboyant Cuttlefish",
    scientificName: "Metasepia pfefferi",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "DD",
    zone_id: 1,
    description: "Mực nang lòe loẹt (Metasepia pfefferi) là loài mực nang rực rỡ và độc đáo nhất đại dương với khả năng phát ra những đợt sóng màu sắc vàng - tím - đỏ nhấp nháy liên tục trên da. Do nang mực nhỏ và xốp không đủ sức nâng cơ thể bơi lâu, chúng chọn cách 'đi bộ' bằng các xúc tu trên đáy bùn cát.",
    description_en: "The flamboyant cuttlefish (Metasepia pfefferi) displays pulsating waves of electric yellow, purple, and crimson across its skin, walking along the seabed with its arms.",
    diet: "Cua đá nhỏ, tôm đáy bùn và cá bống nhỏ",
    diet_en: "Small crabs, bottom-dwelling shrimp, and tiny gobies",
    size_min_cm: 6, size_max_cm: 8, weight_min_kg: 0.05, weight_max_kg: 0.12, lifespan_years: 1.5,
    depth_min_m: 3, depth_max_m: 86, pressure_atm: 9.6, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng đáy bùn cát và thảm vụn san hô", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.3,
    vietnam_red_list_status: "DD", vietnam_protection_group: "Nhuyễn thể chân đầu quý hiếm", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Bò trên nền đáy cát pha vụn vỏ ốc tại Hòn Mun, đảo Hòn Tre Nha Trang và vịnh Côn Đảo.",
    location_ids: [103, 101, 106, 105],
    facts: [
      "Thịt của chúng chứa một loại độc tố thần kinh cực mạnh và độc hại không kém nọc độc của bạch tuộc đốm xanh.",
      "Chúng có thể biến đổi da tức thì từ sần sùi gai góc như đá san hô sang nhẵn bóng với sóng màu điện tử khi bị đe dọa.",
      "Hai xúc tu bắt mồi của chúng bắn ra với tốc độ cực nhanh để tóm gọn con cua chỉ trong một phần chớp mắt.",
    ],
  },
  // 35. Sò Tượng Vảy Rạn San Hô
  {
    code: "MOL-LC-0330",
    slug: "so-tuong-vay-ran-san-ho",
    common_name: "Sò Tượng Vảy Rạn San Hô",
    common_name_en: "Fluted Giant Clam",
    scientificName: "Tridacna squamosa",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sò tượng vảy (Tridacna squamosa) sở hữu chiếc vỏ hai mảnh với các gờ vảy uốn lượn nhô cao như bậc thang tuyệt mỹ và lớp màng áo rực rỡ hoa văn màu xanh lục, ngọc lam và vàng đồng. Chúng nuôi hàng triệu vi tảo Zooxanthellae cộng sinh trong mô màng áo để nhận năng lượng từ ánh sáng mặt trời.",
    description_en: "The fluted giant clam (Tridacna squamosa) is famous for its large, flute-like shell scales and brilliant turquoise and brown mantle housing photosynthetic zooxanthellae.",
    diet: "Dinh dưỡng quang hợp từ tảo cộng sinh Zooxanthellae và lọc phù du",
    diet_en: "Photosynthetic sugars from zooxanthellae and filter-fed plankton",
    size_min_cm: 25, size_max_cm: 45, weight_min_kg: 8.0, weight_max_kg: 25.0, lifespan_years: 80,
    depth_min_m: 1, depth_max_m: 20, pressure_atm: 3.0, temperature_min_c: 25.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mặt trời chan hòa rạn san hô nông", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.8,
    vietnam_red_list_status: "VU", vietnam_protection_group: "Nhóm II - Thân mềm rạn san hô được bảo vệ", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Bám chặt vào các khối san hô sống tại Hòn Mun, đảo Nam Yết và Hòn Cau Côn Đảo.",
    location_ids: [103, 101, 102, 105, 104],
    facts: [
      "Chiếc màng áo đầy màu sắc chứa các tế bào iridocyte phản chiếu ánh sáng giúp chuyển hướng quang phổ tối ưu nuôi tảo cộng sinh.",
      "Chúng có hàng trăm đốm mắt cảm quang tí hon ở mép màng áo: khi có bóng đen che qua, vỏ sò lập tức khép lại tự vệ.",
      "Chiếc vỏ đá vôi khổng lồ của chúng là nền móng cấu trúc vững chắc tạo nơi trú ngụ cho hàng chục loài sinh vật rạn khác.",
    ],
  },
  // 36. Sên Biển Mụn Cơm Sọc
  {
    code: "MOL-LC-0331",
    slug: "sen-bien-mun-com-soc",
    common_name: "Sên Biển Mụn Cơm Sọc",
    common_name_en: "Varicose Wart Slug",
    scientificName: "Phyllidia varicosa",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sên biển mụn cơm sọc (Phyllidia varicosa) nổi bật với cơ thể màu xám xanh phủ đầy những nốt sần mụn cơm màu vàng chanh xếp thành các đường gờ dọc thân. Da của chúng tiết ra chất độc phyllidridin có mùi hăng nồng đẩy lùi mọi loài cá săn mồi rạn san hô.",
    description_en: "The varicose wart slug (Phyllidia varicosa) is covered in prominent yellow-tipped pustules on blue-grey ridges, secreting toxic phyllidridin compounds to deter predators.",
    diet: "Hải miên độc rạn san hô (bọt biển Acanthella và Halichondria)",
    diet_en: "Toxic sponges (Acanthella, Halichondria, and Axinellidae)",
    size_min_cm: 5, size_max_cm: 12, weight_min_kg: 0.02, weight_max_kg: 0.06, lifespan_years: 1,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa vách đá và rạn san hô", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Thân mềm không vỏ rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa",
    local_distribution: "Bò trên các vách đá ngầm và khối san hô bám đầy bọt biển tại Hòn Mun và Côn Đảo.",
    location_ids: [103, 101, 102, 105],
    facts: [
      "Chất độc phyllidridin chúng tiết ra mạnh tới mức có thể tiêu diệt các sinh vật nhỏ trong một hồ nước chỉ sau vài phút.",
      "Chúng hấp thụ chất độc từ bọt biển độc mà chúng ăn rồi cô đặc lại trong các tuyến da lưng để làm vũ khí phòng vệ trọn đời.",
      "Màu sắc tương phản vàng - đen - xanh xám là tín hiệu cảnh báo thị giác cổ điển (aposematism) báo cho cá biết cơ thể nó mang nọc độc chết người.",
    ],
  },
  // 37. Sên Biển Willan Viền Trắng
  {
    code: "MOL-LC-0332",
    slug: "sen-bien-willan-vien-trang",
    common_name: "Sên Biển Willan Viền Trắng",
    common_name_en: "Willan's Chromodoris",
    scientificName: "Chromodoris willani",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sên biển Willan (Chromodoris willani) sở hữu vẻ đẹp kiêu sa với thân màu xanh lam sáng rực rỡ, hai đường sọc đen chạy dọc lưng và chùm mang xòe hình hoa màu trắng muốt đốm li ti như tuyết rơi. Chúng là viên ngọc quý thu hút mọi nhiếp ảnh gia đại dương.",
    description_en: "Willan's chromodoris (Chromodoris willani) is celebrated for its radiant cerulean blue body, two dark dorsal stripes, and frosted white gills and rhinophores.",
    diet: "Bọt biển rạn ngầm (đặc biệt bọt biển thuộc chi Cacospongia)",
    diet_en: "Demosponges, Cacospongia, and Halichondria",
    size_min_cm: 3, size_max_cm: 5, weight_min_kg: 0.01, weight_max_kg: 0.03, lifespan_years: 1,
    depth_min_m: 1, depth_max_m: 35, pressure_atm: 4.5, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa vách san hô ngầm", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sên biển rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Côn Đảo",
    local_distribution: "Bò trên các vách đá dốc có bọt biển bao phủ tại Hòn Mun và đảo Nam Yết.",
    location_ids: [103, 105, 101],
    facts: [
      "Chùm mang thở ở đuôi có thể thụt biến mất vào trong cơ thể chỉ trong một cái chớp mắt khi cảm nhận chấn động nước.",
      "Đôi râu cảm giác (rhinophores) ở đầu có thể 'ngửi' thấy dấu vết hóa học của bọt biển trong làn nước biển từ xa.",
      "Dải viền trắng lấp lánh quanh rìa thân giúp bảo vệ mép áo khỏi sự tấn công của các loài giun biển săn mồi.",
    ],
  },
  // 38. Thỏ Biển Đốm Đen
  {
    code: "MOL-LC-0333",
    slug: "tho-bien-dom-den",
    common_name: "Thỏ Biển Đốm Đen",
    common_name_en: "Spotted Sea Hare",
    scientificName: "Aplysia dactylomela",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Thỏ biển đốm đen (Aplysia dactylomela) có hai chiếc tai thỏ ngộ nghĩnh trên đầu và thân hình màu vàng lục phủ những vòng tròn đen như mắt kính. Khi bị đe dọa, chúng phun ra một đám mây mực màu tím tía nồng nặc để làm tê liệt khứu giác của kẻ săn mồi.",
    description_en: "The spotted sea hare (Aplysia dactylomela) features rabbit-ear-like rhinophores and dark circular rings, famously releasing vibrant purple defensive ink when disturbed.",
    diet: "Tảo đỏ, rong biển lục, thảm rong câu và rêu đáy biển",
    diet_en: "Red and green macroalgae (Gracilaria, Ulva, and Laurencia)",
    size_min_cm: 15, size_max_cm: 30, weight_min_kg: 0.3, weight_max_kg: 1.0, lifespan_years: 1,
    depth_min_m: 1, depth_max_m: 20, pressure_atm: 3.0, temperature_min_c: 23.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh bãi rạn cạn và thảm rong biển", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Nhuyễn thể ăn rong tảo rạn", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Cù Lao Chàm, Côn Đảo, Phú Quốc",
    local_distribution: "Gặm tảo trên các bãi rạn cạn và đầm rong tại Cù Lao Chàm, Hòn Mun và đảo Phú Quốc.",
    location_ids: [102, 103, 101, 106],
    facts: [
      "Màu tím rực rỡ của đám mây mực tự vệ được tổng hợp trực tiếp từ các sắc tố có trong loài tảo đỏ mà chúng ăn hàng ngày.",
      "Hệ thống tế bào thần kinh khổng lồ của loài thỏ biển Aplysia là đối tượng nghiên cứu đã giúp nhà khoa học Eric Kandel đạt giải Nobel Y học năm 2000 về cơ chế lưu trữ trí nhớ.",
      "Chúng là sinh vật lưỡng tính đồng thời và thường kết thành những chuỗi sinh sản dài gồm hàng chục cá thể nối đuôi nhau.",
    ],
  },
  // 39. Ốc Sứ Vằn Hổ Biển Đông
  {
    code: "MOL-LC-0334",
    slug: "oc-su-van-ho-bien-dong",
    common_name: "Ốc Sứ Vằn Hổ Biển Đông",
    common_name_en: "Tiger Cowrie",
    scientificName: "Cypraea tigris",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Ốc sứ vằn hổ (Cypraea tigris) sở hữu chiếc vỏ hình quả trứng bóng bẩy như tráng men sứ tuyệt mỹ phủ đầy đốm tròn nâu đen tựa bộ lông hổ. Lớp màng áo mềm mại có thể trùm kín toàn bộ mặt ngoài vỏ để bảo vệ và đánh bóng lớp men sứ không bao giờ bị bám rêu.",
    description_en: "The tiger cowrie (Cypraea tigris) is famed for its heavy, glossy, porcelain-like egg-shaped shell adorned with dark leopard-like spots and a papilla-covered mantle that polishes its shell.",
    diet: "Tảo bám san hô, bọt biển, xác hữu cơ và polyp san hô chết",
    diet_en: "Encrusting algae, sponges, organic detritus, and dead coral tissue",
    size_min_cm: 8, size_max_cm: 15, weight_min_kg: 0.2, weight_max_kg: 0.6, lifespan_years: 10,
    depth_min_m: 1, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa rạn san hô và khe đá ngầm", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Nhuyễn thể rạn san hô có giá trị mỹ nghệ", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Ẩn mình dưới các gờ đá san hô vào ban ngày tại Hòn Mun, đảo Nam Yết và quần đảo Hoàng Sa.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Vỏ của chúng luôn bóng loáng tuyệt đối trong tự nhiên vì lớp màng áo liên tục tiết ra dịch tráng men bảo vệ khỏi hà và rêu bám.",
      "Thời cổ đại, vỏ ốc sứ từng được sử dụng rộng rãi như đơn vị tiền tệ trao đổi giao thương trên khắp châu Á và châu Phi.",
      "Vào ban đêm, chúng bò ra khỏi hang hốc gặm sạch màng tảo bám trên san hô chết, tạo mặt bằng sạch cho ấu trùng san hô bám.",
    ],
  },
  // 40. Ốc Cối Vải Dệt Độc
  {
    code: "MOL-LC-0335",
    slug: "oc-coi-vai-det-doc",
    common_name: "Ốc Cối Vải Dệt Độc",
    common_name_en: "Textile Cone Snail",
    scientificName: "Conus textile",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Ốc cối vải dệt (Conus textile) mang trên mình lớp vỏ hoa văn hình tam giác lều vàng kim đan xen tinh xảo tựa vải dệt thổ cẩm. Tuy nhiên, đằng sau vẻ đẹp kiêu sa là chiếc răng lao ngạnh tẩm nọc độc thần kinh Conotoxin cực mạnh đủ sức hạ gục con người trong vài giờ.",
    description_en: "The textile cone snail (Conus textile) bears an exquisite tent-like patterned shell, concealing a harpoon tooth laden with deadly conotoxins capable of lethal human envenomation.",
    diet: "Các loài ốc biển khác, ốc sứ và động vật thân mềm có vỏ",
    diet_en: "Other gastropods, cowries, and shelled mollusks",
    size_min_cm: 7, size_max_cm: 14, weight_min_kg: 0.1, weight_max_kg: 0.3, lifespan_years: 8,
    depth_min_m: 1, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Bóng râm dưới các rạn san hô và bãi cát đáy", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Động vật biển có nọc độc nguy hiểm", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa, Hoàng Sa",
    local_distribution: "Vùi mình dưới lớp cát mỏng gần chân rạn san hô Hòn Mun, đảo Nam Yết và Côn Đảo.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Chiếc răng lao rỗng tẩm nọc độc của chúng có thể phóng ra xa với tốc độ chớp nhoáng đâm xuyên qua lớp vỏ ốc đối thủ.",
      "Nọc độc Conotoxin của chúng là một hỗn hợp hàng trăm peptide thần kinh đang được y học nghiên cứu chế tạo thuốc giảm đau mạnh gấp 1.000 lần morphine mà không gây nghiện.",
      "Khác với ốc nón địa lý chuyên săn cá, ốc cối vải dệt là loài chuyên săn lùng và ăn thịt các loài ốc biển khác.",
    ],
  },
  // 41. Cua Ẩn Sĩ Chân Xanh Điện
  {
    code: "CRU-LC-0336",
    slug: "cua-an-si-chan-xanh-dien",
    common_name: "Cua Ẩn Sĩ Chân Xanh Điện",
    common_name_en: "Electric Blue Hermit Crab",
    scientificName: "Calcinus elegans",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Cua ẩn sĩ chân xanh điện (Calcinus elegans) nổi bật tuyệt đối với những chiếc chân có sọc xanh lam điện quang rực rỡ và đôi mắt xanh ngọc bích. Chúng cư ngụ trong các vỏ ốc rỗng và miệt mài dọn dẹp tảo bám trên rạn san hô.",
    description_en: "The electric blue hermit crab (Calcinus elegans) is instantly recognizable by its brilliant electric-blue bands along its walking legs and bright blue eyestalks.",
    diet: "Tảo sợi, mùn bã hữu cơ, xác động vật rạn và rêu đá",
    diet_en: "Filamentous algae, green hair algae, detritus, and carrion",
    size_min_cm: 3, size_max_cm: 5, weight_min_kg: 0.02, weight_max_kg: 0.06, lifespan_years: 4,
    depth_min_m: 1, depth_max_m: 20, pressure_atm: 3.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa bãi san hô nông và vùng triều", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật dọn dẹp rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Bò trên các vách đá san hô cạn tại Hòn Mun, bãi rạn Côn Đảo và đảo Nam Yết.",
    location_ids: [103, 101, 105, 106],
    facts: [
      "Chiếc càng bên trái của chúng phát triển to hơn hẳn càng bên phải, đóng vai trò như một cánh cửa kiên cố bít kín miệng vỏ ốc khi thu mình vào trong.",
      "Khi cơ thể lớn lên, chúng phải liên tục tìm kiếm vỏ ốc mới lớn hơn và tham gia vào các cuộc 'đổi nhà tập thể' cùng đồng loại.",
      "Chúng là những công nhân dọn vệ sinh cần mẫn, gặm sạch các loài tảo sợi gây hại cho san hô mà không làm tổn thương polyp san hô.",
    ],
  },
  // 42. Tôm San Hô Râu Trắng
  {
    code: "CRU-LC-0337",
    slug: "tom-san-ho-rau-trang",
    common_name: "Tôm San Hô Râu Trắng",
    common_name_en: "Banded Coral Shrimp",
    scientificName: "Stenopus hispidus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Tôm san hô râu trắng (Stenopus hispidus) có thân và đôi càng dài sọc đỏ trắng xen kẽ nổi bật cùng bộ râu trắng dài thướt tha vươn rộng. Chúng lập các 'trạm làm sạch' cố định trong kẽ đá để dọn sạch ký sinh trùng trên cơ thể cá rạn bơi ngang qua.",
    description_en: "The banded coral shrimp (Stenopus hispidus) features vibrant red-and-white bands across its carapace and long claws, waving its striking white antennae to attract fish clients.",
    diet: "Ký sinh trùng ngoài da của cá, mô hoại tử, nấm bám và mùn đáy",
    diet_en: "Fish ectoparasites, dead tissue, fungi, and organic debris",
    size_min_cm: 5, size_max_cm: 8, weight_min_kg: 0.01, weight_max_kg: 0.03, lifespan_years: 3,
    depth_min_m: 2, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Bóng râm trong các hang hốc san hô", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật vệ sinh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa, Hoàng Sa",
    local_distribution: "Trú ngụ trong các hốc đá tối tại Hòn Mun, Cù Lao Chàm và rạn ngầm Côn Đảo.",
    location_ids: [103, 101, 102, 105],
    facts: [
      "Chúng vẫy đôi râu trắng dài như tín hiệu quảng cáo mời gọi các loài cá săn mồi hung dữ như cá mú, cá chình vào trạm vệ sinh mà không lo bị ăn thịt.",
      "Chúng kết đôi trọn đời và cùng nhau bảo vệ hang đá lãnh thổ một cách vô cùng kiên cường trước các con tôm khác.",
      "Nếu bị mất càng trong các cuộc giao tranh, một chiếc càng mới hoàn chỉnh sẽ mọc lại sau vài lần lột xác tiếp theo.",
    ],
  },
  // 43. Sao Biển Bánh Socola
  {
    code: "ECH-LC-0338",
    slug: "sao-bien-banh-socola",
    common_name: "Sao Biển Bánh Socola",
    common_name_en: "Chocolate Chip Sea Star",
    scientificName: "Protoreaster nodosus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sao biển bánh socola (Protoreaster nodosus) có thân dày hình sao năm cánh với các nốt gai sừng màu đen nâu sẫm nhô cao trông giống hệt những hạt sô cô la chip trên chiếc bánh quy. Chúng sinh sống phổ biến trên các bãi cát cạn và thảm cỏ biển nhiệt đới.",
    description_en: "The chocolate chip sea star (Protoreaster nodosus) has a massive body studded with thick, conical dark brown horns resembling chocolate chips on a freshly baked cookie.",
    diet: "Tảo đáy, bọt biển, mùn bã hữu cơ, động vật hình rêu và san hô mềm",
    diet_en: "Algae, sponges, organic detritus, bryozoans, and soft coral polyps",
    size_min_cm: 20, size_max_cm: 35, weight_min_kg: 0.4, weight_max_kg: 1.2, lifespan_years: 15,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa bãi cát đáy và thảm cỏ biển", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Da gai đáy biển nhiệt đới", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Cù Lao Chàm, Phú Quốc, vịnh Vân Phong",
    local_distribution: "Bò trên đáy cát ven thảm cỏ biển tại Hòn Rơm, bãi Chàm và đảo Phú Quốc.",
    location_ids: [102, 103, 106],
    facts: [
      "Chúng ăn bằng cách lộn toàn bộ dạ dày ra ngoài qua miệng để bao bọc và tiêu hóa con mồi ngay trên nền cát trước khi thu dạ dày lại.",
      "Hàng trăm chân ống nhỏ chứa giác hút ở mặt dưới giúp chúng bò nhịp nhàng và cảm nhận hóa học thức ăn trong cát.",
      "Những chiếc gai nhọn sẫm màu trên lưng không chứa nọc độc nhưng đủ cứng chắc để ngăn các loài cá lớn cắn xé cơ thể chúng.",
    ],
  },
  // 44. Tôm Hề Đốm Tím Ăn Sao Biển
  {
    code: "CRU-LC-0339",
    slug: "tom-he-dom-tim-an-sao-bien",
    common_name: "Tôm Hề Đốm Tím Ăn Sao Biển",
    common_name_en: "Harlequin Shrimp",
    scientificName: "Hymenocera picta",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Tôm hề (Hymenocera picta) là một trong những loài giáp xác lộng lẫy và độc đáo nhất với hai chiếc càng dẹp hình chiếc quạt lớn đốm tím hồng rực rỡ. Chúng là loài săn mồi chuyên biệt chỉ ăn sao biển, đặc biệt là các loài sao biển gai có hại cho rạn san hô.",
    description_en: "The harlequin shrimp (Hymenocera picta) is decorated with exquisite petal-like claws patterned with magenta spots, feeding exclusively on echinoderms such as sea stars.",
    diet: "Chân ống và mô của sao biển (đặc biệt sao biển Linckia và sao biển gai)",
    diet_en: "Tube feet and soft tissues of starfish, including crown-of-thorns",
    size_min_cm: 4, size_max_cm: 6, weight_min_kg: 0.01, weight_max_kg: 0.03, lifespan_years: 7,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Bóng râm dưới các chân khối san hô cành", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật kiểm soát sao biển gai", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, quần đảo Trường Sa, Côn Đảo",
    local_distribution: "Săn mồi theo cặp dưới các nhánh san hô Acropora tại Hòn Mun và đảo Nam Yết.",
    location_ids: [103, 105, 101],
    facts: [
      "Chúng luôn săn mồi theo cặp uyên ương: cả hai phối hợp lật ngửa con sao biển to gấp hàng chục lần cơ thể chúng rồi kéo về hang ăn dần.",
      "Chúng có khả năng nuôi sống con sao biển bị lật ngửa suốt nhiều tuần để giữ thức ăn luôn tươi sống bằng cách ăn từng cánh một.",
      "Chúng đóng vai trò như vệ sĩ tự nhiên quan trọng bảo vệ rạn san hô bằng cách tiêu diệt sao biển gai Acanthaster khi chúng còn nhỏ.",
    ],
  },
  // 45. Tôm Súng Rực Rỡ Giao Hảo
  {
    code: "CRU-LC-0340",
    slug: "tom-sung-ruc-ro-giao-hao",
    common_name: "Tôm Súng Rực Rỡ Giao Hảo",
    common_name_en: "Tiger Pistol Shrimp",
    scientificName: "Alpheus bellulus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Tôm súng rực rỡ (Alpheus bellulus) sở hữu chiếc càng súng khổng lồ có thể bắn ra luồng sóng xung kích âm thanh cực mạnh làm tê liệt con mồi. Chúng nổi tiếng với mối quan hệ cộng sinh tương hỗ kỳ diệu với các loài cá bống rạn san hô.",
    description_en: "The tiger pistol shrimp (Alpheus bellulus) possesses an asymmetrical snapping claw capable of producing cavitation bubbles with extreme acoustic shockwaves, living in symbiosis with gobies.",
    diet: "Giáp xác nhỏ đáy cát, giun biển, mùn bã hữu cơ và xác động vật",
    diet_en: "Benthic crustaceans, polychaetes, detritus, and small invertebrates",
    size_min_cm: 4, size_max_cm: 6, weight_min_kg: 0.01, weight_max_kg: 0.02, lifespan_years: 4,
    depth_min_m: 1, depth_max_m: 25, pressure_atm: 3.5, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa đáy cát sỏi chân rạn", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cộng sinh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Đào hang dưới đáy cát cùng cá bống tại Hòn Mun, đảo Nam Yết và Côn Đảo.",
    location_ids: [103, 105, 101, 106],
    facts: [
      "Cú búng càng tạo ra một bọt khí sụp đổ với nhiệt độ tức thời đạt tới 4.700 độ C (gần bằng bề mặt Mặt Trời) và âm thanh vượt 218 decibel.",
      "Tôm súng có thị lực rất kém nên khi ra ngoài hang dọn cát, nó luôn đặt một sợi râu lên đuôi cá bống để nhận tín hiệu nguy hiểm từ cá bống lính gác.",
      "Hang cát do tôm súng đào bới liên tục là nơi trú ẩn an toàn tuyệt đối cho cả hai trước những loài săn mồi hung dữ.",
    ],
  },
  // 46. Cua Ẩn Sĩ Mắt Trắng Đốm Đỏ
  {
    code: "CRU-LC-0341",
    slug: "cua-an-si-mat-trang-dom-do",
    common_name: "Cua Ẩn Sĩ Mắt Trắng Đốm Đỏ",
    common_name_en: "White-spotted Hermit Crab",
    scientificName: "Dardanus megistos",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Cua ẩn sĩ đốm đỏ (Dardanus megistos) là một trong những loài cua ẩn sĩ lớn nhất rạn san hô với bộ lông cứng màu đỏ tươi phủ đầy những đốm trắng tròn viền đen và cuống mắt trắng nổi bật. Chúng cư ngụ trong các vỏ ốc tù và hoặc ốc bàn tay khổng lồ.",
    description_en: "The white-spotted hermit crab (Dardanus megistos) is a massive, brightly colored reef hermit adorned with vivid crimson setae, white spots ringed in black, and prominent white eyestalks.",
    diet: "Xác động vật biển chết, nhuyễn thể thân mềm, cua nhỏ và tảo đáy",
    diet_en: "Carrion, mollusks, small crabs, echinoderms, and macroalgae",
    size_min_cm: 10, size_max_cm: 20, weight_min_kg: 0.2, weight_max_kg: 0.8, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa rạn san hô và đáy đá ngầm", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Giáp xác dọn dẹp đáy biển", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Tuần tra đáy rạn san hô và gờ đá ngầm ngoài khơi Hòn Mun, đảo Côn Sơn và Song Tử Tây.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Chúng có tập tính gắn hải quỳ sống lên trên vỏ ốc của mình để tăng cường hỏa lực phòng vệ chống lại bạch tuộc.",
      "Chiếc càng lớn đầy gai cứng của chúng có thể đập vỡ vỏ các loài ốc nhỏ để ăn thịt và dọn sạch xác thối trên rạn.",
      "Bộ lông cứng màu đỏ phủ khắp cơ thể đóng vai trò như các cảm biến xúc giác và hóa học cực nhạy dò tìm thức ăn trong đêm tối.",
    ],
  },
  // 47. Hải Sâm Dây Rắn Khổng Lồ
  {
    code: "ECH-LC-0342",
    slug: "hai-sam-day-ran-khong-lo",
    common_name: "Hải Sâm Dây Rắn Khổng Lồ",
    common_name_en: "Giant Synaptid Sea Cucumber",
    scientificName: "Synapta maculata",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Hải sâm dây rắn khổng lồ (Synapta maculata) là loài hải sâm dài nhất thế giới với chiều dài có thể đạt tới 3 mét nhưng thân hình mảnh mai uốn lượn tựa một con trăn biển. Chúng dùng 15 xúc tu lông vũ hình quạt ở đầu liên tục quét cát đáy để gom các mảnh vụn hữu cơ.",
    description_en: "The giant synaptid sea cucumber (Synapta maculata) is the longest sea cucumber in the world, stretching over 3 meters with a snake-like body and 15 pinnate feeding tentacles.",
    diet: "Mùn bã hữu cơ, vi tảo đáy cát, vi khuẩn bám cát và sinh vật phù du lắng đọng",
    diet_en: "Organic detritus, microalgae, benthic bacteria, and deposited plankton",
    size_min_cm: 120, size_max_cm: 250, weight_min_kg: 0.5, weight_max_kg: 1.5, lifespan_years: 8,
    depth_min_m: 1, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng chan hòa bãi rạn nông và thảm cỏ biển", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật lọc sạch đáy cát rạn", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Phú Quốc, Trường Sa",
    local_distribution: "Trườn trên đáy cát quanh các rạn san hô Hòn Mun, bãi Đầm Trầu Côn Đảo và quần đảo Trường Sa.",
    location_ids: [103, 101, 106, 105],
    facts: [
      "Da của chúng chứa hàng triệu mảnh xương gai siêu nhỏ hình mỏ neo khiến cơ thể nó dính chặt như miếng băng nhám Velcro khi chạm vào.",
      "Cơ thể chúng có khả năng co giãn phi thường: khi bị kéo căng có thể dài hơn 3 mét nhưng khi thu mình lại chỉ còn chưa đầy 40 cm.",
      "Chúng đóng vai trò như máy lọc sinh học vĩ đại của rạn san hô, lọc hàng tấn cát mỗi năm giúp nền đáy luôn thông thoáng và giàu oxy.",
    ],
  },
  // 48. San Hô Mặt Trời Cam
  {
    code: "COR-LC-0343",
    slug: "san-ho-mat-troi-cam",
    common_name: "San Hô Mặt Trời Cam",
    common_name_en: "Orange Cup Coral",
    scientificName: "Tubastraea coccinea",
    group_slug: "san-ho-thuc-vat-bien",
    status_code: "LC",
    zone_id: 1,
    description: "San Hô Mặt Trời Cam (Tubastraea coccinea) tỏa sáng rực rỡ như những bông hoa cúc màu cam lửa dưới các vòm hang tối và vách đá ngầm. Khác với hầu hết các loài san hô rạn, chúng không có tảo Zooxanthellae cộng sinh nên không cần ánh sáng, nở bung các xúc tu vàng rực trong đêm để bắt phù du.",
    description_en: "The orange cup coral (Tubastraea coccinea) blooms like brilliant fiery-orange daisies in dark caves and overhangs, lacking zooxanthellae and capturing zooplankton with vibrant tentacles.",
    diet: "Sinh vật phù du, ấu trùng tôm cua, trứng cá và giáp xác trôi nổi",
    diet_en: "Zooplankton, invertebrate larvae, fish eggs, and copepods",
    size_min_cm: 10, size_max_cm: 30, weight_min_kg: 0.5, weight_max_kg: 2.0, lifespan_years: 50,
    depth_min_m: 3, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 20.0, temperature_max_c: 29.0,
    light_level: "Bóng tối trong hang vòm và mặt dưới gờ đá ngầm", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "San hô đá tự nhiên", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Trường Sa, Hoàng Sa",
    local_distribution: "Phủ kín các vách đá ngầm và mái vòm hang tối tại Hòn Mun, Hòn Cau Côn Đảo và đảo Nam Yết.",
    location_ids: [103, 101, 105, 104],
    facts: [
      "Do không phụ thuộc vào quang hợp mặt trời, chúng có thể sinh sống thịnh vượng ở những nơi tối tăm nhất của vách đá và xác tàu đắm.",
      "Các xúc tu màu cam sáng chứa hàng nghìn tế bào gai châm nematocyst làm tê liệt sinh vật phù du trôi theo dòng chảy mạnh.",
      "Chúng có khả năng sinh sản vô tính bằng cách phóng thích các mầm polyp hoàn chỉnh trôi theo dòng nước để định cư trên các vách đá mới.",
    ],
  },
  // 49. San Hô Búa Neo Rạn
  {
    code: "COR-NT-0344",
    slug: "san-ho-bua-neo-ran",
    common_name: "San Hô Búa Neo Rạn",
    common_name_en: "Hammer Coral",
    scientificName: "Euphyllia ancora",
    group_slug: "san-ho-thuc-vat-bien",
    status_code: "NT",
    zone_id: 1,
    description: "San hô búa (Euphyllia ancora) có các đầu xúc tu phồng to hình mỏ neo hoặc chiếc búa màu xanh lục dạ quang và vàng óng lay động nhịp nhàng theo sóng nước. Chúng tạo nên những thảm san hô rộng lớn cung cấp nơi trú ngụ tuyệt vời cho các đàn cá nhỏ.",
    description_en: "The hammer coral (Euphyllia ancora) features fleshy, anchor- or hammer-shaped tentacle tips in glowing fluorescent green and gold, undulating gently with the swell.",
    diet: "Quang hợp qua tảo cộng sinh Zooxanthellae và bắt sinh vật phù du",
    diet_en: "Zooxanthellae photosynthesis products and dissolved organic matter",
    size_min_cm: 20, size_max_cm: 60, weight_min_kg: 1.0, weight_max_kg: 5.0, lifespan_years: 60,
    depth_min_m: 3, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng chan hòa sườn dốc rạn san hô bảo vệ", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "NT", vietnam_protection_group: "San hô tạo rạn bị đe dọa", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, quần đảo Trường Sa",
    local_distribution: "Phát triển thành các thảm lớn tại sườn rạn đón dòng chảy Hòn Mun, đảo Nam Yết và Côn Đảo.",
    location_ids: [103, 105, 101],
    facts: [
      "Chúng có những chiếc xúc tu 'quét dọn' (sweeper tentacles) dài đặc biệt chứa tế bào gai độc để đốt và xua đuổi các loài san hô khác mọc lấn sân.",
      "Đầu xúc tu phát huỳnh quang rực rỡ dưới ánh sáng đèn tím actinic của thợ lặn ban đêm.",
      "Các đàn cá hề và tôm rạn thường tìm đến nép mình giữa các xúc tu búa dày đặc để được bảo vệ an toàn.",
    ],
  },
  // 50. San Hô Hoa Thanh Lịch
  {
    code: "COR-VU-0345",
    slug: "san-ho-hoa-thanh-lich",
    common_name: "San Hô Hoa Thanh Lịch",
    common_name_en: "Elegance Coral",
    scientificName: "Catalaphyllia jardinei",
    group_slug: "san-ho-thuc-vat-bien",
    status_code: "VU",
    zone_id: 1,
    description: "San hô hoa thanh lịch (Catalaphyllia jardinei) được mệnh danh là một trong những loài san hô đá kỳ vĩ nhất với thân thịt phồng mềm mại màu xanh lá mạ và những xúc tu dài đầu chóp tím hồng tựa đóa hoa mẫu đơn khổng lồ đang nở rộ dưới đáy biển.",
    description_en: "The elegance coral (Catalaphyllia jardinei) resembles an enormous blooming peony with fleshy neon green oral disc and flowing tentacles tipped with luminous magenta.",
    diet: "Quang hợp tảo Zooxanthellae, bắt tôm cá con phù du",
    diet_en: "Photosynthetic sugars, small fish larvae, and pelagic crustaceans",
    size_min_cm: 15, size_max_cm: 40, weight_min_kg: 0.8, weight_max_kg: 3.5, lifespan_years: 50,
    depth_min_m: 5, depth_max_m: 45, pressure_atm: 5.5, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng dịu đáy cát bùn ven chân rạn ngầm", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "VU", vietnam_protection_group: "San hô rạn quý hiếm cấm khai thác", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, quần đảo Trường Sa",
    local_distribution: "Sống tại chân sườn dốc cát bùn quanh rạn Hòn Mun, đảo Phú Quý và Côn Đảo.",
    location_ids: [103, 101, 105],
    facts: [
      "Khác với phần lớn san hô đá bám vào đá cứng, chúng ưa cắm bộ khung xương hình nón của mình vào nền cát mềm hoặc bùn lắng ven chân rạn.",
      "Đầu chóp xúc tu màu tím hồng chứa nồng độ tế bào gai dày đặc, có thể bắt giữ những con cá nhỏ bơi lạc vào lòng hoa.",
      "Loài san hô này đang suy giảm nghiêm trọng trên toàn cầu do bị săn lùng phục vụ thị trường cá cảnh biển.",
    ],
  },
];

async function getVerifiedSourceId(scientificName) {
  try {
    const res = await fetchWithRetry("https://api.inaturalist.org/v1/taxa", {
      method: "GET",
      params: { q: scientificName, rank: "species", per_page: 5 },
    });
    const match = res?.data?.results?.find(
      (t) => t.name?.toLowerCase() === scientificName.toLowerCase()
    );
    if (match) return `inaturalist:${match.id}`;
  } catch {}

  try {
    const gbifRes = await fetchWithRetry("https://api.gbif.org/v1/species/match", {
      method: "GET",
      params: { name: scientificName, strict: "true" },
    });
    if (gbifRes?.data?.usageKey) {
      return `gbif:${gbifRes.data.usageKey}`;
    }
  } catch {}

  return null;
}

function cleanTextForCheck(obs) {
  const tagText = Array.isArray(obs.tags) ? obs.tags.join(" ") : "";
  return `${obs.description || ""} ${tagText} ${obs.place_guess || ""}`.toLowerCase();
}

async function crawlDiverPhotos(scientificName, commonNameVi) {
  const url = "https://api.inaturalist.org/v1/observations";
  const res = await fetchWithRetry(url, {
    method: "GET",
    params: {
      taxon_name: scientificName,
      quality_grade: "research",
      captive: "false",
      photos: "true",
      per_page: 35,
      order_by: "votes",
    },
  });

  const results = res?.data?.results || [];
  const chosen = [];
  const usedPhotoIds = new Set();
  const usedUsers = new Set();

  for (const obs of results) {
    if (chosen.length >= 4) break;
    if (obs.captive) continue;
    const obsText = cleanTextForCheck(obs);
    if (BANNED_PHOTO_TERMS.some((kw) => obsText.includes(kw))) continue;

    const obsPhotos = obs.photos || [];
    if (obsPhotos.length === 0) continue;

    const candidatePhoto =
      obsPhotos.find(
        (p) => p.original_dimensions && p.original_dimensions.width >= p.original_dimensions.height
      ) || obsPhotos[0];

    if (!candidatePhoto?.url || usedPhotoIds.has(candidatePhoto.id)) continue;

    const userId = obs.user?.id;
    if (userId && usedUsers.has(userId) && chosen.length < 3 && results.length > 8) {
      continue;
    }

    const largeUrl = candidatePhoto.url
      .replace("/square.", "/large.")
      .replace("/medium.", "/large.")
      .replace("/small.", "/large.");

    usedPhotoIds.add(candidatePhoto.id);
    if (userId) usedUsers.add(userId);

    const photographer = obs.user?.name || obs.user?.login || "iNaturalist Observer";
    chosen.push({
      url: largeUrl,
      caption: `${commonNameVi} (${scientificName}) trong môi trường biển tự nhiên — ảnh: ${photographer}`,
      is_primary: chosen.length === 0,
    });
  }

  if (chosen.length < 4) {
    for (const obs of results) {
      if (chosen.length >= 4) break;
      if (obs.captive) continue;
      const obsText = cleanTextForCheck(obs);
      if (BANNED_PHOTO_TERMS.some((kw) => obsText.includes(kw))) continue;

      for (const photo of obs.photos || []) {
        if (chosen.length >= 4) break;
        if (!photo?.url || usedPhotoIds.has(photo.id)) continue;
        const largeUrl = photo.url
          .replace("/square.", "/large.")
          .replace("/medium.", "/large.")
          .replace("/small.", "/large.");

        usedPhotoIds.add(photo.id);
        const photographer = obs.user?.name || obs.user?.login || "iNaturalist Observer";
        chosen.push({
          url: largeUrl,
          caption: `${commonNameVi} (${scientificName}) trong môi trường biển tự nhiên — ảnh: ${photographer}`,
          is_primary: chosen.length === 0,
        });
      }
    }
  }

  // Fallback 1: Thử lại không giới hạn quality_grade
  if (chosen.length < 3) {
    try {
      const fbRes = await fetchWithRetry(url, {
        method: "GET",
        params: {
          taxon_name: scientificName,
          photos: "true",
          per_page: 30,
        },
      });
      for (const obs of fbRes?.data?.results || []) {
        if (chosen.length >= 4) break;
        const obsText = cleanTextForCheck(obs);
        if (BANNED_PHOTO_TERMS.some((kw) => obsText.includes(kw))) continue;
        for (const photo of obs.photos || []) {
          if (chosen.length >= 4) break;
          if (!photo?.url || usedPhotoIds.has(photo.id)) continue;
          const largeUrl = photo.url
            .replace("/square.", "/large.")
            .replace("/medium.", "/large.")
            .replace("/small.", "/large.");
          usedPhotoIds.add(photo.id);
          const photographer = obs.user?.name || obs.user?.login || "iNaturalist Observer";
          chosen.push({
            url: largeUrl,
            caption: `${commonNameVi} (${scientificName}) trong môi trường biển tự nhiên — ảnh: ${photographer}`,
            is_primary: chosen.length === 0,
          });
        }
      }
    } catch {}
  }

  // Fallback 2: Wikimedia Commons API
  if (chosen.length < 3) {
    try {
      const wikiRes = await fetchWithRetry("https://commons.wikimedia.org/w/api.php", {
        method: "GET",
        params: {
          action: "query",
          generator: "search",
          gsrsearch: `${scientificName} underwater`,
          gsrnamespace: 6,
          gsrlimit: 6,
          prop: "imageinfo",
          iiprop: "url|size|mime",
          format: "json",
        },
      });
      const pages = Object.values(wikiRes?.data?.query?.pages || {});
      for (const page of pages) {
        if (chosen.length >= 4) break;
        const info = page.imageinfo?.[0];
        if (info?.url && (info.mime === "image/jpeg" || info.mime === "image/png")) {
          chosen.push({
            url: info.url,
            caption: `${commonNameVi} (${scientificName}) — Wikimedia Commons`,
            is_primary: chosen.length === 0,
          });
        }
      }
    } catch {}
  }

  return chosen;
}

// 85+ MỐI QUAN HỆ SINH THÁI (Đồ thị mạng lưới sinh thái)
export const FIFTY_RELATIONSHIPS = [
  // Cá Bướm Mặt Gấu Trúc
  { src: "ca-buom-mat-gau-truc", tgt: "san-ho-mat-troi-cam", type: "predator_prey", desc: "Cá bướm mặt gấu trúc gặm tỉa các polyp san hô mặt trời cam xòe nở vào ban đêm.", impact: "Điều tiết sinh trưởng san hô và kích thích tạo phân nhánh mới.", strength: 0.85 },
  { src: "ca-buom-mat-gau-truc", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Các nhánh san hô cành Acropora tạo mê cung che chở an toàn cho đôi cá bướm khi ngủ.", impact: "Phụ thuộc sinh cảnh sống còn của cá bướm rạn.", strength: 0.92 },
  { src: "ca-buom-mat-gau-truc", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Tỉa các sợi tảo bám quanh chân rạn san hô.", impact: "Góp phần làm sạch rạn san hô.", strength: 0.75 },

  // Cá Thù Lù Mỏ Nhọn (Moorish Idol)
  { src: "ca-thu-lu-mo-nhon-moorish-idol", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Khối san hô cành cung cấp chỗ ẩn nấp an toàn cho cá thù lù mỏ nhọn.", impact: "Sinh cảnh sinh sống thiết yếu.", strength: 0.9 },
  { src: "ca-thu-lu-mo-nhon-moorish-idol", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm rêu tảo và bọt biển bám trên nền đá san hô ngầm.", impact: "Kiểm soát bọt biển phát triển lấn át san hô.", strength: 0.82 },
  { src: "ca-thu-lu-mo-nhon-moorish-idol", tgt: "ca-buom-co-san-ho", type: "competitor", desc: "Cạnh tranh thức ăn là bọt biển và polyp san hô mềm tại cùng một tầng rạn.", impact: "Phân chia không gian dinh dưỡng ngách rạn.", strength: 0.78 },

  // Cá Nóc Hòm Đốm Vàng
  { src: "ca-noc-hom-dom-vang", tgt: "cua-an-si-chan-xanh-dien", type: "predator_prey", desc: "Cắn vỡ các động vật giáp xác nhỏ và cua ẩn sĩ bò trên đáy rạn.", impact: "Điều hòa số lượng giáp xác ăn tảo đáy.", strength: 0.8 },
  { src: "ca-noc-hom-dom-vang", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Trú ẩn giữa các hốc san hô sừng hươu khi còn là cá con.", impact: "Cung cấp bãi ương giống an toàn.", strength: 0.88 },

  // Cá Dơi Vây Dài
  { src: "ca-doi-vay-dai", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Lọc bắt sinh vật phù du và giáp xác trôi dạt quanh các xác tàu đắm.", impact: "Chuyển hóa năng lượng phù du vào sinh khối rạn nhân tạo.", strength: 0.86 },
  { src: "ca-map-ran-san-ho-xam", tgt: "ca-doi-vay-dai", type: "predator_prey", desc: "Cá mập rạn san hô săn cá dơi khi đàn cá bơi ra khỏi nơi ẩn nấp.", impact: "Mắt xích truyền năng lượng trong chuỗi thức ăn rạn.", strength: 0.84 },

  // Cá Nục Heo (Mahi-Mahi)
  { src: "ca-nuc-heo-mahi-mahi", tgt: "ca-trich-mai", type: "predator_prey", desc: "Mahi-mahi tăng tốc độ cao săn đuổi đàn cá trích tầng mặt đại dương.", impact: "Kẻ săn mồi tốc độ kiểm soát đàn cá nổi.", strength: 0.92 },
  { src: "ca-map-ho-tiger-shark", tgt: "ca-nuc-heo-mahi-mahi", type: "predator_prey", desc: "Cá mập hổ săn cá nục heo khi chúng tập trung quanh các vật thể trôi dạt.", impact: "Điều tiết thiên địch bậc trung của đại dương.", strength: 0.88 },

  // Cá Bò Sao Biển Đông
  { src: "ca-bo-sao-bien-dong", tgt: "cau-gai-bo-duc", type: "predator_prey", desc: "Phun nước lật ngửa cầu gai bồ dục rồi cắn vỡ lớp vỏ mềm phía dưới.", impact: "Kiểm soát quần thể cầu gai bảo vệ cấu trúc rạn san hô.", strength: 0.9 },
  { src: "ca-bo-sao-bien-dong", tgt: "sao-bien-banh-socola", type: "predator_prey", desc: "Cắn gặm các cánh của sao biển bánh socola trên đáy cát.", impact: "Điều tiết động vật da gai đáy rạn.", strength: 0.82 },

  // Cá Hồng Hoàng Đế
  { src: "ca-hong-hoang-de", tgt: "ca-thia-do-bien-san-ho", type: "predator_prey", desc: "Phục kích săn cá thia đỏ khi đàn cá thia bơi ra kiếm phù du.", impact: "Mắt xích tuần hoàn năng lượng giữa các tầng nước rạn san hô.", strength: 0.88 },
  { src: "ca-hong-hoang-de", tgt: "cua-an-si-mat-trang-dom-do", type: "predator_prey", desc: "Nghiền nát cua đá và cua ẩn sĩ trên đáy đá rạn sâu.", impact: "Kiểm soát động vật đáy tầng sâu.", strength: 0.8 },
  { src: "ca-map-ran-san-ho-xam", tgt: "ca-hong-hoang-de", type: "predator_prey", desc: "Cá mập rạn san hô xám săn cá hồng hoàng đế trưởng thành.", impact: "Áp lực chọn lọc từ loài săn mồi đầu bảng.", strength: 0.86 },

  // Cá Kẽm Đốm Hề
  { src: "tom-san-ho-rau-trang", tgt: "ca-kem-dom-he", type: "symbiosis", desc: "Tôm san hô râu trắng làm sạch mang và da cho cá kẽm tại trạm vệ sinh.", impact: "Bảo vệ sức khỏe cho các loài cá lớn trên rạn san hô.", strength: 0.94 },
  { src: "san-ho-canh-acropora", tgt: "ca-kem-dom-he", type: "habitat_provider", desc: "Mái vòm san hô Acropora khổng lồ che chở cho đàn cá kẽm nằm nghỉ ban ngày.", impact: "Sinh cảnh nghỉ ngơi tối quan trọng.", strength: 0.9 },

  // Cá Dìa Mõm Cáo
  { src: "ca-dia-mom-cao", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm sạch rong câu và tảo sợi bám quanh rạn san hô sống.", impact: "Dọn dẹp rạn san hô, ngăn tảo lấn át san hô non.", strength: 0.92 },
  { src: "ca-dia-mom-cao", tgt: "rong-nho-bien", type: "herbivory", desc: "Ăn rong nho và các mầm rong mềm chân rạn.", impact: "Duy trì cân bằng thực vật tầng rạn.", strength: 0.85 },
  { src: "san-ho-canh-acropora", tgt: "ca-dia-mom-cao", type: "habitat_provider", desc: "Trú ẩn trong các khe san hô cành khi bị kẻ săn mồi truy đuổi.", impact: "Bảo vệ các loài cá ăn tảo rạn.", strength: 0.88 },

  // Cá Bướm Cờ San Hô
  { src: "ca-buom-co-san-ho", tgt: "san-ho-bua-neo-ran", type: "habitat_provider", desc: "Bơi lượn quanh các thảm san hô búa neo để kiếm sinh vật phù du.", impact: "Liên kết sinh cảnh phong phú của rạn nhiệt đới.", strength: 0.86 },
  { src: "ca-buom-co-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt giữ các ấu trùng phù du trôi dạt dọc theo vách rạn.", impact: "Thu nạp dưỡng chất phù du vào rạn.", strength: 0.8 },

  // Cá Kỳ Lân Môi Cam
  { src: "ca-ky-lan-moi-cam", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Chuyên gặm các loài rong nâu dai cứng (Sargassum) bám trên đá san hô.", impact: "Bảo vệ rạn san hô khỏi bị rong nâu phủ kín.", strength: 0.93 },
  { src: "ca-ky-lan-moi-cam", tgt: "ca-duoi-gai-bot-xanh", type: "competitor", desc: "Cùng cạnh tranh nguồn rong tảo bám trên đỉnh rạn đón sóng.", impact: "Phân chia không gian kiếm ăn giữa các loài cá ăn cỏ.", strength: 0.8 },

  // Cá Thia Đỏ Biển San Hô
  { src: "ca-thia-do-bien-san-ho", tgt: "san-ho-canh-acropora", type: "symbiosis", desc: "Cả đàn cá thia quạt nước liên tục cung cấp nguồn nước giàu oxy cho nhánh san hô.", impact: "Cộng sinh làm tăng tốc độ phát triển của san hô cành.", strength: 0.95 },
  { src: "ca-thia-do-bien-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt hàng triệu động vật phù du trôi dạt mang năng lượng về đỉnh rạn.", impact: "Cầu nối dinh dưỡng quan trọng hàng đầu của hệ sinh thái rạn.", strength: 0.9 },

  // Cá Nóc Chuột Yên Ngựa
  { src: "ca-noc-chuot-yen-ngua", tgt: "san-ho-hoa-thanh-lich", type: "habitat_provider", desc: "Trú ngụ gần chân bệ san hô hoa thanh lịch.", impact: "Sinh cảnh ẩn náu tự nhiên.", strength: 0.8 },

  // Cá Lưỡi Dao Cạo San Hô
  { src: "ca-luoi-dao-cao-san-ho", tgt: "cau-gai-bo-duc", type: "symbiosis", desc: "Bơi chúc đầu giữa các gai cầu gai để ẩn náu an toàn khỏi cá săn mồi.", impact: "Mối quan hệ cộng sinh che chở kinh điển của rạn san hô.", strength: 0.92 },
  { src: "ca-luoi-dao-cao-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Hút các giáp xác nhỏ phù du trôi qua hàng rào gai bảo vệ.", impact: "Tiêu thụ phù du trong vùng che chở.", strength: 0.8 },

  // Cá Mập Rạn San Hô Xám
  { src: "ca-map-ran-san-ho-xam", tgt: "ca-kem-dom-he", type: "predator_prey", desc: "Săn bắt cá kẽm khi chúng rời khỏi vòm san hô đi kiếm ăn ban đêm.", impact: "Điều tiết số lượng cá rạn cỡ lớn.", strength: 0.88 },
  { src: "ca-map-ran-san-ho-xam", tgt: "ca-hong-hoang-de", type: "predator_prey", desc: "Tuần tra sườn rạn săn đuổi cá hồng hoàng đế.", impact: "Duy trì trạng thái khỏe mạnh của quần thể cá rạn.", strength: 0.86 },
  { src: "ca-ep-co-lon", tgt: "ca-map-ran-san-ho-xam", type: "symbiosis", desc: "Cá ép bám vào thân cá mập dọn sạch ký sinh trùng và ăn thức ăn thừa.", impact: "Cộng sinh hỗ trợ lẫn nhau trong đại dương.", strength: 0.92 },

  // Cá Nhám Đuôi Dài Biển Khơi
  { src: "ca-nham-duoi-dai-bien-khoi", tgt: "ca-trich-mai", type: "predator_prey", desc: "Dùng chiếc đuôi khổng lồ quất mạnh vào đàn cá trích làm choáng váng trước khi ăn.", impact: "Chiến thuật săn mồi bằng sóng xung kích độc đáo.", strength: 0.95 },
  { src: "ca-nham-duoi-dai-bien-khoi", tgt: "ca-thu-vach-hoang-gia", type: "competitor", desc: "Cạnh tranh đàn cá nổi ngoài khơi xa bờ.", impact: "Phân chia lãnh thổ săn mồi tầng mặt đại dương.", strength: 0.82 },

  // Cá Đuối Nạng Rạn San Hô
  { src: "ca-duoi-nang-ran-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Lọc hàng tấn sinh vật phù du mỗi ngày qua các tấm lược mang khổng lồ.", impact: "Tiêu thụ phù du tầng mặt và vận chuyển dinh dưỡng quy mô lớn.", strength: 0.98 },
  { src: "tom-san-ho-rau-trang", tgt: "ca-duoi-nang-ran-san-ho", type: "symbiosis", desc: "Tôm san hô râu trắng và cá vệ sinh dọn sạch ký sinh trùng tại trạm làm sạch.", impact: "Chăm sóc sức khỏe cho cá đuối nạng rạn.", strength: 0.92 },
  { src: "ca-map-dau-bua-tron", tgt: "ca-duoi-nang-ran-san-ho", type: "predator_prey", desc: "Cá mập đầu búa săn bắt cá đuối nạng khi chúng bơi qua eo biển sâu.", impact: "Khống chế số lượng cá đuối lớn tự nhiên.", strength: 0.85 },
  { src: "ca-ep-co-lon", tgt: "ca-duoi-nang-ran-san-ho", type: "symbiosis", desc: "Cá ép bám vào bụng cá đuối nạng để đi nhờ qua các đại dương.", impact: "Cộng hội không tổn hại vật chủ.", strength: 0.9 },

  // Cá Mập Đầu Búa Trơn
  { src: "ca-map-dau-bua-tron", tgt: "ca-ngu-mat-to-bien-khoi", type: "predator_prey", desc: "Cá mập đầu búa trơn săn cá ngừ mắt to tại các vùng nước thềm lục địa.", impact: "Đỉnh chuỗi thức ăn đại dương mở.", strength: 0.88 },
  { src: "ca-map-dau-bua-tron", tgt: "ca-trich-mai", type: "predator_prey", desc: "Săn đuổi đàn cá trích ven bờ và ngoài khơi.", impact: "Điều tiết nguồn cá nổi tự nhiên.", strength: 0.84 },

  // Cá Ngừ Mắt To Biển Khơi
  { src: "ca-ngu-mat-to-bien-khoi", tgt: "ca-trich-mai", type: "predator_prey", desc: "Đàn cá ngừ mắt to lao vun vút vào đàn cá trích từ dưới sâu.", impact: "Truyền dẫn năng lượng sinh thái tầng mặt xuống tầng sâu.", strength: 0.9 },
  { src: "ca-ngu-mat-to-bien-khoi", tgt: "muc-nang-loe-loet", type: "predator_prey", desc: "Cá ngừ mắt to săn các loài mực nang bơi ở sườn thềm lục địa.", impact: "Mắt xích quan trọng giữa cá săn mồi và động vật thân mềm.", strength: 0.85 },

  // Cá Thu Vạch Hoàng Gia
  { src: "ca-thu-vach-hoang-gia", tgt: "ca-nuc-so", type: "predator_prey", desc: "Tăng tốc chớp nhoáng cắn xé đàn cá nục ven rạn san hô.", impact: "Kẻ săn mồi tốc độ cao kiểm soát nguồn cá tầng nổi.", strength: 0.9 },
  { src: "ca-thu-vach-hoang-gia", tgt: "ca-trich-mai", type: "predator_prey", desc: "Rượt đuổi đàn cá trích mai ngoài khơi.", impact: "Cân bằng sinh thái cá mồi ven biển.", strength: 0.88 },

  // Cá Heo Risso Xám Tro
  { src: "ca-heo-risso-xam-tro", tgt: "muc-nang-loe-loet", type: "predator_prey", desc: "Dùng sóng âm định vị và lặn sâu săn mực nang và mực ống.", impact: "Điều hòa số lượng động vật chân đầu đại dương sâu.", strength: 0.94 },
  { src: "ca-heo-risso-xam-tro", tgt: "muc-thuy-tinh-glass-squid", type: "predator_prey", desc: "Săn mực thủy tinh trong suốt tại tầng trung rãnh sâu Biển Đông.", impact: "Chuyển hóa năng lượng tầng tối vào chuỗi thức ăn thú biển.", strength: 0.88 },

  // Cá Nhà Táng Lùn
  { src: "ca-nha-tang-lun", tgt: "muc-thuy-tinh-glass-squid", type: "predator_prey", desc: "Lặn sâu hàng trăm mét hút nuốt các loài mực đại dương.", impact: "Mắt xích săn mồi tầng trung đặc trưng của cá voi có răng.", strength: 0.92 },

  // Cá Đuôi Gai Bột Xanh
  { src: "ca-duoi-gai-bot-xanh", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm sạch tảo sợi trên đỉnh rạn, tạo mặt bằng cho ấu trùng san hô bám.", impact: "Duy trì sức sống và sự hồi sinh của rạn san hô.", strength: 0.94 },
  { src: "san-ho-canh-acropora", tgt: "ca-duoi-gai-bot-xanh", type: "habitat_provider", desc: "Bảo vệ cá đuôi gai bột xanh trong các rãnh san hô khi sóng lớn.", impact: "Nơi cư ngụ không thể thiếu.", strength: 0.9 },

  // Cá Thiên Thần Lửa
  { src: "ca-thien-than-lua", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Ẩn mình sâu trong các mê cung san hô cành Acropora.", impact: "Sinh cảnh che chở khỏi kẻ săn mồi.", strength: 0.9 },
  { src: "ca-thien-than-lua", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Tỉa các sợi tảo mọc len lỏi giữa các nhánh san hô sống.", impact: "Giữ sạch không gian cho polyp san hô thở.", strength: 0.82 },

  // Cá Chình Bông Sao Tuyết
  { src: "ca-chinh-bong-sao-tuyet", tgt: "cua-an-si-chan-xanh-dien", type: "predator_prey", desc: "Dùng hàm răng cùn nghiền nát vỏ cua ẩn sĩ trong khe đá.", impact: "Điều hòa động vật giáp xác tầng đáy rạn.", strength: 0.85 },
  { src: "tom-san-ho-rau-trang", tgt: "ca-chinh-bong-sao-tuyet", type: "symbiosis", desc: "Tôm san hô râu trắng bò vào tận trong miệng cá chình để nhặt ký sinh trùng.", impact: "Hợp tác cộng sinh an toàn giữa kẻ săn mồi và tôm vệ sinh.", strength: 0.95 },

  // Cá Ngát Vạch Sọc Biển
  { src: "cay-duoc-doi-rung-ngap-man", tgt: "ca-ngat-vach-soc-bien", type: "habitat_provider", desc: "Rừng ngập mặn tạo bãi ươm giống an toàn cho đàn cá ngát con phát triển.", impact: "Mắt xích kết nối giữa rừng ngập mặn và rạn san hô ngoài khơi.", strength: 0.92 },

  // Cá Rồng Cánh Mỏng
  { src: "co-bien-la-kim", tgt: "ca-rong-canh-mong", type: "habitat_provider", desc: "Thảm cỏ biển cung cấp môi trường ngụy trang hoàn hảo cho cá rồng cánh mỏng bò tìm mồi.", impact: "Bảo tồn thảm cỏ biển duy trì đa dạng sinh học đáy cát.", strength: 0.94 },

  // Cá Lưỡi Gươm Lòe Loẹt
  { src: "ca-luoi-guom-loe-loet", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Ngụy trang bên cạnh các nhánh san hô và huệ biển crinoid.", impact: "Phụ thuộc sinh thái chặt chẽ vào cấu trúc rạn san hô.", strength: 0.92 },
  { src: "ca-luoi-guom-loe-loet", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Hút các ấu trùng tôm phù du bơi ngang nhánh san hô.", impact: "Tiêu thụ phù du tại chỗ.", strength: 0.8 },

  // Cá Đỏ Lửa Rạn San Hô
  { src: "ca-do-lua-ran-san-ho", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Đậu bất động trên đỉnh nhánh san hô Acropora quan sát con mồi.", impact: "Quan hệ dựa dẫm sinh cảnh độc đáo của loài cá không có bọng bơi.", strength: 0.95 },
  { src: "ca-do-lua-ran-san-ho", tgt: "ca-thia-do-bien-san-ho", type: "predator_prey", desc: "Lao nhanh tóm cá thia con bơi lạc khỏi đàn.", impact: "Điều tiết cá con trên đỉnh rạn san hô.", strength: 0.78 },

  // Cá Kèn San Hô Biển Đông
  { src: "ca-ken-san-ho-bien-dong", tgt: "ca-thia-do-bien-san-ho", type: "predator_prey", desc: "Hút trọn cá thia đỏ bằng chiếc miệng hình kèn mở rộng thần tốc.", impact: "Kẻ săn mồi ngụy trang kiểm soát đàn cá nhỏ rạn.", strength: 0.88 },
  { src: "ca-ken-san-ho-bien-dong", tgt: "ca-vet-van-xanh-bien-dong", type: "commensalism", desc: "Bơi nép sát lưng cá vẹt xanh để mượn bóng cá vẹt tiếp cận đàn cá mồi.", impact: "Tập tính săn mồi bóng ma kinh điển của đại dương.", strength: 0.9 },

  // Cá Dọc Dưa Miệng Kèn
  { src: "ca-doc-dua-mieng-ken", tgt: "ca-trich-mai", type: "predator_prey", desc: "Phục kích đàn cá trích nổi trên mặt rạn bằng cú hút chân không.", impact: "Điều hòa số lượng đàn cá trích ven đảo.", strength: 0.86 },

  // Cá Cóc Khổng Lồ
  { src: "ca-coc-khong-lo", tgt: "ca-thia-do-bien-san-ho", type: "predator_prey", desc: "Vung mồi câu giả nhử cá thia đỏ lại gần rồi nuốt chửng trong 0.006 giây.", impact: "Kẻ săn mồi phục kích hiệu quả bậc nhất trên rạn san hô.", strength: 0.92 },
  { src: "san-ho-nao", tgt: "ca-coc-khong-lo", type: "habitat_provider", desc: "Ngụy trang giống hòn san hô não bám đầy rêu và bọt biển.", impact: "Sinh cảnh ngụy trang sống còn của cá cóc.", strength: 0.94 },

  // Mực Nang Lòe Loẹt
  { src: "muc-nang-loe-loet", tgt: "cua-an-si-chan-xanh-dien", type: "predator_prey", desc: "Bắn hai xúc tu bắt cua ẩn sĩ nhỏ bò trên đáy cát.", impact: "Săn mồi đáy cát điều tiết giáp xác nhỏ.", strength: 0.85 },
  { src: "ca-mu-nghe", tgt: "muc-nang-loe-loet", type: "predator_prey", desc: "Cá mú nghệ nuốt trọn mực nang bất chấp màu sắc cảnh báo độc tố.", impact: "Thiên địch tự nhiên kiềm chế số lượng mực độc.", strength: 0.8 },

  // Sò Tượng Vảy Rạn San Hô
  { src: "so-tuong-vay-ran-san-ho", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Gắn kết vào khối san hô cành làm gia cố khung rạn vôi hóa vững chắc.", impact: "Đóng góp canxi sinh học xây dựng rạn san hô biển Đông.", strength: 0.95 },
  { src: "so-tuong-vay-ran-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Lọc hàng nghìn lít nước biển mỗi ngày thu nạp phù du và làm sạch nước.", impact: "Hệ thống lọc nước tự nhiên khổng lồ cho rạn san hô.", strength: 0.92 },

  // Sên Biển Mụn Cơm Sọc
  { src: "sen-bien-mun-com-soc", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Bò trên các gờ san hô tìm ăn bọt biển độc.", impact: "Kiểm soát bọt biển phát triển lấn át san hô.", strength: 0.88 },

  // Sên Biển Willan Viền Trắng
  { src: "sen-bien-willan-vien-trang", tgt: "san-ho-bua-neo-ran", type: "commensalism", desc: "Sống bám quanh các vách đá ngầm dưới thảm san hô búa.", impact: "Gia tăng độ phong phú loài của vi sinh cảnh rạn.", strength: 0.8 },

  // Thỏ Biển Đốm Đen
  { src: "tho-bien-dom-den", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm sạch thảm rong câu và tích lũy sắc tố chế tạo mực tím tự vệ.", impact: "Kiểm soát bùng phát rong biển ven bờ.", strength: 0.92 },
  { src: "tho-bien-dom-den", tgt: "rong-nho-bien", type: "herbivory", desc: "Ăn rong nho trên bãi cạn.", impact: "Cân bằng thảm thực vật đáy.", strength: 0.85 },

  // Ốc Sứ Vằn Hổ Biển Đông
  { src: "oc-su-van-ho-bien-dong", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm tảo màng và chất bẩn bám trên san hô chết vào ban đêm.", impact: "Làm sạch bề mặt rạn cho san hô non định cư.", strength: 0.88 },
  { src: "oc-coi-vai-det-doc", tgt: "oc-su-van-ho-bien-dong", type: "predator_prey", desc: "Ốc cối vải dệt phóng kim độc săn ốc sứ vằn hổ.", impact: "Chuỗi thức ăn đặc biệt giữa các loài thân mềm chân bụng.", strength: 0.9 },

  // Ốc Cối Vải Dệt Độc
  { src: "oc-tu-va-hoang-hau", tgt: "oc-coi-vai-det-doc", type: "predator_prey", desc: "Ốc tù và dùng vỏ dày miễn nhiễm nọc độc để săn và ăn thịt ốc cối độc.", impact: "Thiên địch tự nhiên kiểm soát ốc nón độc.", strength: 0.9 },

  // Cua Ẩn Sĩ Chân Xanh Điện
  { src: "cua-an-si-chan-xanh-dien", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Ăn tảo sợi và rêu bám trên đá rạn san hô.", impact: "Giữ cho bề mặt rạn sạch bóng.", strength: 0.88 },

  // Sao Biển Bánh Socola
  { src: "sao-bien-banh-socola", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm lớp tảo bám và mùn bã trên đáy cát ven rạn.", impact: "Dọn dẹp bề mặt đáy biển.", strength: 0.8 },
  { src: "tom-he-dom-tim-an-sao-bien", tgt: "sao-bien-banh-socola", type: "predator_prey", desc: "Tôm hề lật ngửa sao biển bánh socola và ăn các chân ống của nó.", impact: "Khống chế số lượng sao biển đáy cát.", strength: 0.95 },
  { src: "tom-he-dom-tim-an-sao-bien", tgt: "sao-bien-gai", type: "predator_prey", desc: "Tôm hề săn bắt sao biển gai Acanthaster khi chúng còn non.", impact: "Vũ khí sinh học cứu rạn san hô khỏi sự tàn phá của sao biển gai.", strength: 0.98 },

  // Tôm Súng Rực Rỡ Giao Hảo
  { src: "tom-sung-ruc-ro-giao-hao", tgt: "san-ho-canh-acropora", type: "habitat_provider", desc: "Đào hang an toàn dưới chân bệ san hô cành Acropora.", impact: "Tạo cấu trúc hang hốc bền vững đáy rạn.", strength: 0.9 },

  // Cua Ẩn Sĩ Mắt Trắng Đốm Đỏ
  { src: "cua-an-si-mat-trang-dom-do", tgt: "oc-ban-tay", type: "predator_prey", desc: "Chiếm vỏ ốc bàn tay khổng lồ để làm ngôi nhà che chở cơ thể.", impact: "Tái chế vỏ động vật thân mềm bảo vệ giáp xác.", strength: 0.85 },

  // Hải Sâm Dây Rắn Khổng Lồ
  { src: "hai-sam-day-ran-khong-lo", tgt: "san-ho-canh-acropora", type: "symbiosis", desc: "Lọc sạch mùn bã hữu cơ lắng đọng giúp nước quanh rạn san hô trong vắt.", impact: "Tăng cường độ trong của nước cho san hô quang hợp.", strength: 0.94 },

  // San Hô Mặt Trời Cam
  { src: "san-ho-mat-troi-cam", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt giữ sinh vật phù du và giáp xác trôi dạt vào ban đêm.", impact: "Hấp thu năng lượng dòng chảy tại các hang tối.", strength: 0.9 },

  // San Hô Búa Neo Rạn
  { src: "san-ho-bua-neo-ran", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt sinh vật phù du bổ sung dinh dưỡng ngoài quang hợp.", impact: "Đóng góp lớn vào cấu trúc vôi hóa của rạn san hô.", strength: 0.88 },
  { src: "san-ho-bua-neo-ran", tgt: "ca-he-ocellaris-nemo", type: "habitat_provider", desc: "Đàn cá hề tìm đến nép mình giữa các xúc tu búa neo để ngủ.", impact: "Sinh cảnh bảo vệ cá rạn nhiệt đới.", strength: 0.9 },

  // San Hô Hoa Thanh Lịch
  { src: "san-ho-hoa-thanh-lich", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Đóa hoa san hô khổng lồ bắt giữ tôm cá con phù du.", impact: "Mắt xích năng lượng ven chân rạn cát bùn.", strength: 0.9 },
  { src: "san-ho-hoa-thanh-lich", tgt: "san-ho-mat-troi-cam", type: "competitor", desc: "Cạnh tranh dòng dinh dưỡng và không gian phát triển ven chân rạn.", impact: "Phân chia ranh giới sinh thái giữa san hô quang hợp và san hô ăn thịt.", strength: 0.8 },
];

async function run() {
  console.log("🌊 Bắt đầu cào & nạp 50 loài sinh vật biển mới + Đồ thị mạng lưới sinh thái...");

  // Đồng bộ PostgreSQL serial sequences để tránh lỗi duplicate PK
  for (const tbl of [
    "species", "species_media", "species_facts", "species_translations", "species_relationships"
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), true);`
    );
  }

  const groups = await prisma.species_groups.findMany();
  const groupBySlug = new Map(groups.map((g) => [g.slug, g.id]));

  const statuses = await prisma.conservation_statuses.findMany();
  const statusByCode = new Map(statuses.map((s) => [s.code, s.id]));

  const langs = await prisma.languages.findMany();
  const langCodes = new Set(langs.map((l) => l.code));

  const locations = await prisma.locations.findMany({ select: { id: true } });
  const validLocIds = new Set(locations.map((l) => Number(l.id)));

  const crawledSpeciesList = [];

  for (let i = 0; i < FIFTY_SPECIES.length; i++) {
    const sp = FIFTY_SPECIES[i];
    console.log(`\n🔎 [${i + 1}/50] Đang cào dữ liệu cho: ${sp.common_name} (${sp.scientificName})...`);

    const [sourceApiId, mediaList] = await Promise.all([
      getVerifiedSourceId(sp.scientificName),
      crawlDiverPhotos(sp.scientificName, sp.common_name),
    ]);

    if (mediaList.length < 2) {
      console.warn(`   ⚠️ Cảnh báo: Loài ${sp.common_name} chỉ lấy được ${mediaList.length} ảnh!`);
    }

    console.log(`   ✅ Taxonomy: ${sourceApiId || "local"} | Ảnh dưới nước: ${mediaList.length} ảnh`);

    const groupId = groupBySlug.get(sp.group_slug);
    const statusId = statusByCode.get(sp.status_code);
    if (!groupId || !statusId) {
      throw new Error(`Thiếu group_id hoặc status_id cho ${sp.common_name}`);
    }

    const existing = await prisma.species.findFirst({
      where: {
        OR: [
          { code: sp.code },
          { slug: sp.slug },
          { scientificName: sp.scientificName },
        ],
      },
    });

    const speciesData = {
      code: (existing?.code || sp.code).slice(0, 30),
      scientificName: sp.scientificName.slice(0, 255),
      common_name: sp.common_name.slice(0, 255),
      slug: (existing?.slug || sp.slug).slice(0, 255),
      description: sp.description,
      diet: sp.diet,
      species_groups: { connect: { id: groupId } },
      conservation_statuses: { connect: { id: statusId } },
      ocean_zones: { connect: { id: sp.zone_id } },
      size_min_cm: sp.size_min_cm,
      size_max_cm: sp.size_max_cm,
      weight_min_kg: sp.weight_min_kg,
      weight_max_kg: sp.weight_max_kg,
      lifespan_years: sp.lifespan_years,
      depth_min_m: sp.depth_min_m,
      depth_max_m: sp.depth_max_m,
      pressure_atm: sp.pressure_atm,
      temperature_min_c: sp.temperature_min_c,
      temperature_max_c: sp.temperature_max_c,
      light_level: sp.light_level ? sp.light_level.slice(0, 48) : null,
      visibility_m: sp.visibility_m,
      dissolved_oxygen_mg_l: sp.dissolved_oxygen_mg_l,
      source_api_id: (sourceApiId || existing?.source_api_id || null)?.slice(0, 98),
      vietnam_red_list_status: sp.vietnam_red_list_status ? sp.vietnam_red_list_status.slice(0, 18) : null,
      vietnam_protection_group: sp.vietnam_protection_group ? sp.vietnam_protection_group.slice(0, 48) : null,
      cites_appendix: sp.cites_appendix ? sp.cites_appendix.slice(0, 18) : null,
      east_sea_zone: sp.east_sea_zone ? sp.east_sea_zone.slice(0, 98) : null,
      local_distribution: sp.local_distribution,
      is_visible: true,
      deleted_at: null,
    };

    const saved = existing
      ? await prisma.species.update({ where: { id: existing.id }, data: speciesData })
      : await prisma.species.create({ data: speciesData });

    crawledSpeciesList.push({ ...sp, dbId: saved.id, mediaList });

    // 1) Lưu ảnh vào species_media
    if (mediaList.length > 0) {
      await prisma.species_media.deleteMany({ where: { species_id: saved.id } });
      await prisma.species_media.createMany({
        data: mediaList.map((m, idx) => ({
          species_id: saved.id,
          type: "image",
          url: m.url,
          caption: m.caption.slice(0, 255),
          is_primary: m.is_primary,
          sort_order: idx + 1,
        })),
      });
    }

    // 2) Lưu 3 sự thật sinh thái vào species_facts
    await prisma.species_facts.deleteMany({ where: { species_id: saved.id } });
    await prisma.species_facts.createMany({
      data: sp.facts.map((content, idx) => ({
        species_id: saved.id,
        content,
        sort_order: idx + 1,
      })),
    });

    // 3) Lưu bản dịch tiếng Việt & tiếng Anh vào species_translations
    if (langCodes.has("vi")) {
      await prisma.species_translations.upsert({
        where: { species_id_language_code: { species_id: saved.id, language_code: "vi" } },
        update: { common_name: sp.common_name, description: sp.description, diet: sp.diet },
        create: { species_id: saved.id, language_code: "vi", common_name: sp.common_name, description: sp.description, diet: sp.diet },
      });
    }
    if (langCodes.has("en")) {
      await prisma.species_translations.upsert({
        where: { species_id_language_code: { species_id: saved.id, language_code: "en" } },
        update: { common_name: sp.common_name_en, description: sp.description_en, diet: sp.diet_en },
        create: { species_id: saved.id, language_code: "en", common_name: sp.common_name_en, description: sp.description_en, diet: sp.diet_en },
      });
    }

    // 4) Gắn các khu bảo tồn vào species_locations
    const locLinks = sp.location_ids.filter((lid) => validLocIds.has(lid));
    for (const lid of locLinks) {
      await prisma.species_locations.upsert({
        where: { species_id_location_id: { species_id: saved.id, location_id: BigInt(lid) } },
        update: {},
        create: { species_id: saved.id, location_id: BigInt(lid) },
      });
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  // 5) Thiết lập quan hệ sinh thái hai chiều
  console.log("\n🕸️  Đang thiết lập Mạng lưới sinh thái & Chuỗi thức ăn cho 50 loài mới...");

  const allSpecies = await prisma.species.findMany({
    select: { id: true, slug: true, common_name: true },
  });
  const bySlug = new Map(allSpecies.map((s) => [s.slug, s]));

  let relInserted = 0;
  for (const rel of FIFTY_RELATIONSHIPS) {
    const s1 = bySlug.get(rel.src);
    const s2 = bySlug.get(rel.tgt);
    if (!s1 || !s2) {
      console.warn(`   ⚠️ Bỏ qua quan hệ thiếu slug: ${rel.src} -> ${rel.tgt}`);
      continue;
    }
    await prisma.species_relationships.upsert({
      where: {
        source_species_id_target_species_id_relationship_type: {
          source_species_id: s1.id,
          target_species_id: s2.id,
          relationship_type: rel.type,
        },
      },
      update: {
        description: rel.desc,
        ecological_impact: rel.impact,
        strength: rel.strength,
        updated_at: new Date(),
      },
      create: {
        source_species_id: s1.id,
        target_species_id: s2.id,
        relationship_type: rel.type,
        description: rel.desc,
        ecological_impact: rel.impact,
        strength: rel.strength,
      },
    });
    relInserted++;
  }

  console.log(`   ✅ Đã nạp/cập nhật ${relInserted} liên kết sinh thái vào species_relationships!`);

  // 6) Cập nhật vào SEARCH_SPECIES_CATALOG trong speciesMock.js để đồng bộ cả Offline & Mock FE
  console.log("\n📦 Đang đồng bộ 50 loài vào Pacific-FE/frontend/src/mocks/speciesMock.js...");
  const MOCK_FILE = "Pacific-FE/frontend/src/mocks/speciesMock.js";
  if (fs.existsSync(MOCK_FILE)) {
    let mockContent = fs.readFileSync(MOCK_FILE, "utf-8");
    const targetIndex = mockContent.indexOf("export const OCEAN_FUN_FACTS = [");
    if (targetIndex !== -1) {
      const insertPos = mockContent.lastIndexOf("];", targetIndex);
      let newMockEntries = "";

      for (const sp of crawledSpeciesList) {
        if (mockContent.includes(`"${sp.slug}"`) || mockContent.includes(`'${sp.slug}'`)) {
          continue; // Đã có rồi thì bỏ qua
        }
        const catMap = {
          "ca-bien": { cat: "cartilage-fish", vi: "Cá biển", en: "Marine Fish" },
          "dong-vat-co-vu-bien": { cat: "mammal", vi: "Động vật có vú", en: "Mammals" },
          "bo-sat-bien": { cat: "turtle", vi: "Bò sát biển", en: "Reptiles" },
          "than-mem-khong-xuong-song": { cat: "mollusk", vi: "Thân mềm", en: "Mollusks" },
          "san-ho-thuc-vat-bien": { cat: "shellfish", vi: "San hô & TV biển", en: "Corals & Plants" },
          "sinh-vat-bien-sau": { cat: "cartilage-fish", vi: "Biển sâu", en: "Deep Sea" },
        };
        const cInfo = catMap[sp.group_slug] || { cat: "bony-fish", vi: "Cá biển", en: "Marine Fish" };
        const statusType =
          sp.status_code === "CR" || sp.status_code === "EN"
            ? "danger"
            : sp.status_code === "VU" || sp.status_code === "NT"
            ? "warning"
            : "safe";

        const primaryImg = sp.mediaList?.[0]?.url || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80";
        const galleryUrls = sp.mediaList?.map((m) => m.url) || [primaryImg];

        newMockEntries += `
  {
    id: "${sp.slug}",
    slug: "${sp.slug}",
    category: "${cInfo.cat}",
    categoryVi: "${cInfo.vi}",
    categoryEn: "${cInfo.en}",
    statusVi: "${sp.status_code}",
    statusEn: "${sp.status_code}",
    statusType: "${statusType}",
    nameVi: "${sp.common_name}",
    nameEn: "${sp.common_name_en}",
    sciName: "${sp.scientificName}",
    descVi: "${sp.description.slice(0, 180)}...",
    descEn: "${sp.description_en.slice(0, 180)}...",
    depth: "${sp.depth_min_m} - ${sp.depth_max_m}m",
    size: "${sp.size_min_cm}cm - ${sp.size_max_cm}cm",
    sizeEn: "${sp.size_min_cm}cm - ${sp.size_max_cm}cm",
    image: "${primaryImg}",
    gallery: ${JSON.stringify(galleryUrls, null, 6)},
    isFeatured: false,
  },`;
      }

      if (newMockEntries) {
        mockContent = mockContent.slice(0, insertPos) + newMockEntries + mockContent.slice(insertPos);
        fs.writeFileSync(MOCK_FILE, mockContent, "utf-8");
        console.log("   ✅ Đã thêm 50 loài mới vào speciesMock.js!");
      } else {
        console.log("   ℹ️ Các loài đã có sẵn trong speciesMock.js.");
      }
    }
  }

  // 7) Đồng bộ vector embeddings nếu có GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    console.log("\n🧠 Đang đồng bộ vector embeddings cho tìm kiếm ngữ nghĩa...");
    try {
      await vectorSearchService.syncAllSpeciesEmbeddings();
      console.log("   ✅ Đã đồng bộ xong embeddings!");
    } catch (err) {
      console.warn("   ⚠️ Đồng bộ embeddings gặp lỗi nhẹ (không ảnh hưởng DB chính):", err.message);
    }
  }

  const finalTotal = await prisma.species.count();
  const finalRels = await prisma.species_relationships.count();
  console.log(`\n🎉 HOÀN TẤT THÀNH CÔNG!`);
  console.log(`   📊 Tổng số sinh vật hiện có trong DB: ${finalTotal} loài`);
  console.log(`   🕸️  Tổng số liên kết mạng lưới sinh thái: ${finalRels} liên kết`);
}

run()
  .catch((err) => {
    console.error("❌ Lỗi:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
