import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import prisma from "../src/lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = path.resolve(__dirname, "../../../Pacific-FE/frontend/src/mocks/speciesMock.js");

const httpsAgent = new https.Agent({ keepAlive: false });

async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1200) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios({
        url,
        ...options,
        httpsAgent,
        timeout: options.timeout || 15000,
        headers: {
          "User-Agent": "PacificMarineEncyclopedia/1.0 (academic-research)",
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
}

async function getWoRMSId(scientificName) {
  try {
    const res = await fetchWithRetry(
      `https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(scientificName)}`,
      { method: "GET", timeout: 10000 }
    );
    const first = res?.data?.[0]?.[0];
    if (first?.valid_AphiaID || first?.AphiaID) {
      return `worms:${first.valid_AphiaID || first.AphiaID}`;
    }
  } catch {}
  return null;
}

async function getINaturalistPhotos(scientificName, commonNameVi, fallbackPhotos = []) {
  try {
    const res = await fetchWithRetry(
      "https://api.inaturalist.org/v1/observations",
      {
        method: "GET",
        params: {
          taxon_name: scientificName,
          photos: "true",
          per_page: 25,
          order_by: "votes",
        },
        timeout: 12000,
      }
    );

    const photos = [];
    for (const obs of res?.data?.results || []) {
      if (photos.length >= 4) break;
      for (const p of obs.photos || []) {
        if (photos.length >= 4) break;
        if (!p?.url) continue;
        const large = p.url
          .replace("/square.", "/large.")
          .replace("/medium.", "/large.")
          .replace("/small.", "/large.");
        const photographer = obs.user?.name || obs.user?.login || "Nhà nghiên cứu đại dương";
        photos.push({
          url: large,
          caption: `${commonNameVi} (${scientificName}) quan sát thực địa biển sâu — ảnh: ${photographer}`,
          is_primary: photos.length === 0,
        });
      }
    }

    if (photos.length >= 3) return photos;
  } catch {}

  const result = [];
  for (let i = 0; i < fallbackPhotos.length; i++) {
    result.push({
      url: fallbackPhotos[i],
      caption: `${commonNameVi} (${scientificName}) nghiên cứu hải dương học Biển Đông`,
      is_primary: i === 0,
    });
  }
  return result;
}

const ELEVEN_SPECIES = [
  // 1. Cá Nhám Ma (Cá Mập Thỏ)
  {
    code: "FSH-LC-0284",
    slug: "ca-nham-ma-ghost-shark",
    aliasId: "ghost-shark",
    common_name: "Cá Nhám Ma (Cá Mập Thỏ)",
    common_name_en: "Pacific Ghost Shark (Chimaera)",
    scientificName: "Hydrolagus mitsukurii",
    group_id: 6n,
    status_id: 1,
    zone_id: 2,
    description: "Cá nhám ma (Hydrolagus mitsukurii) thuộc nhánh cá Chimaera cổ xưa hơn 400 triệu năm tuổi. Chúng có làn da trơn láng không vảy, đôi mắt phát quang màu xanh ngọc bích ma mị và hệ thống cảm biến rung động chằng chịt trên sọ giúp phát hiện chuyển động của động vật giáp xác đáy.",
    description_en: "The ghost shark (Hydrolagus mitsukurii) is an ancient chimaera living fossil with smooth scaleless skin, eerie iridescent green eyes, and complex lateral lines detecting prey vibrations on the sea floor.",
    diet: "Cua biển sâu, sao biển, động vật thân mềm và giun biển",
    diet_en: "Deep-sea crabs, brittle stars, mollusks, and polychaete worms",
    size_min_cm: 60, size_max_cm: 105, weight_min_kg: 2.0, weight_max_kg: 5.5, lifespan_years: 30,
    depth_min_m: 300, depth_max_m: 1200, pressure_atm: 120.0, temperature_min_c: 4.0, temperature_max_c: 8.0,
    light_level: "Bóng tối tầng trung", visibility_m: 1.5, dissolved_oxygen_mg_l: 3.2,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Nhóm II", cites_appendix: "Không",
    east_sea_zone: "Sườn dốc lục địa ngoài khơi Quy Nhơn, Tuy Hòa và bồn trũng Biển Đông",
    local_distribution: "Tuần tra các sườn dốc đá sâu ngoài khơi duyên hải Nam Trung Bộ.",
    location_ids: [104, 105],
    facts: [
      "Được xem là 'hóa thạch sống' cổ xưa, tách nhánh tiến hóa khỏi cá mập thật từ trước thời kỳ khủng long thống trị Trái Đất.",
      "Đôi mắt to màu xanh ngọc bích phát sáng ma quái nhờ lớp màng phản quang tapetum lucidum cực lớn giúp hấp thụ tối đa hạt ánh sáng.",
      "Gai nhọn phía trước vây lưng có độc tính nhẹ giúp xua đuổi các loài thú săn mồi lớn hơn như cá nhà táng.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/167894523/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/228945612/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/194561278/large.jpg",
    ],
  },

  // 2. Cá Rồng Đen Biển Sâu
  {
    code: "FSH-LC-0285",
    slug: "ca-rong-den-bien-sau",
    aliasId: "black-dragonfish",
    common_name: "Cá Rồng Đen Biển Sâu",
    common_name_en: "Black Dragonfish",
    scientificName: "Stomias nebulosus",
    group_id: 6n,
    status_id: 1,
    zone_id: 2,
    description: "Cá rồng đen biển sâu (Stomias nebulosus) là kẻ săn mồi thượng thặng của tầng chạng vạng với làn da màu đen siêu việt hấp thụ 99.5% ánh sáng. Hàm răng nanh thủy tinh trong suốt nhô dài ra ngoài miệng và sợi râu dưới cằm gắn đèn lân tinh dùng để bẫy mồi.",
    description_en: "The black dragonfish (Stomias nebulosus) is an apex mesopelagic predator sporting ultra-black skin absorbing 99.5% of light, needle-like transparent fangs, and a bioluminescent chin barbel lure.",
    diet: "Cá đèn lồng, mực nhỏ và các loài giáp xác tầng trung",
    diet_en: "Lanternfish, small squid, and pelagic crustaceans",
    size_min_cm: 20, size_max_cm: 42, weight_min_kg: 0.1, weight_max_kg: 0.35, lifespan_years: 8,
    depth_min_m: 500, depth_max_m: 1500, pressure_atm: 150.0, temperature_min_c: 3.0, temperature_max_c: 6.0,
    light_level: "Bóng tối tuyệt đối", visibility_m: 1.0, dissolved_oxygen_mg_l: 2.8,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Vùng nước sâu bồn trũng trung tâm Biển Đông",
    local_distribution: "Tầng nước sâu 500 - 1500m vùng biển khơi xa bờ Trường Sa và Hoàng Sa.",
    location_ids: [104, 105],
    facts: [
      "Bộ răng nanh trong suốt như thủy tinh sắc nhọn đến mức không khép vừa miệng, khiến con mồi một khi lọt vào không thể trốn thoát.",
      "Da chứa sắc tố melanosome xếp lớp hấp thụ hơn 99.5% ánh sáng (hiện tượng đen siêu việt - ultra-black) giúp tàng hình hoàn hảo.",
      "Sợi râu đung đưa dưới cằm phát ra ánh sáng lân tinh màu xanh lơ để dụ dỗ những sinh vật biển tò mò bơi vào tầm đớp.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/184592314/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/201456987/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/219845612/large.jpg",
    ],
  },

  // 3. Mực Thủy Tinh Trong Suốt
  {
    code: "MOL-LC-0286",
    slug: "muc-thuy-tinh-glass-squid",
    aliasId: "glass-squid",
    common_name: "Mực Thủy Tinh Trong Suốt",
    common_name_en: "Glass Squid",
    scientificName: "Cranchia scabra",
    group_id: 4n,
    status_id: 1,
    zone_id: 2,
    description: "Mực thủy tinh (Cranchia scabra) có cơ thể trong suốt như pha lê quang học, cho phép ánh sáng xuyên qua tự do khiến chúng gần như vô hình. Khi gặp nguy hiểm, chúng có thể cuộn tròn đầu và xúc tu vào trong khoang áo phồng to như quả bóng gai.",
    description_en: "The glass squid (Cranchia scabra) possesses a completely transparent crystal-like body that renders it virtually invisible in midwater, rolling into a prickly ball when threatened.",
    diet: "Ấu trùng giáp xác, sinh vật phù du và cá con",
    diet_en: "Larval crustaceans, zooplankton, and larval fish",
    size_min_cm: 10, size_max_cm: 25, weight_min_kg: 0.05, weight_max_kg: 0.2, lifespan_years: 2,
    depth_min_m: 400, depth_max_m: 1200, pressure_atm: 120.0, temperature_min_c: 3.5, temperature_max_c: 7.0,
    light_level: "Bóng tối mờ ảo tầng trung", visibility_m: 2.0, dissolved_oxygen_mg_l: 3.0,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Vùng biển khơi sâu phía đông bờ biển miền Trung và quần đảo Hoàng Sa",
    local_distribution: "Lơ lửng trong cột nước sâu ngoài khơi bồn trũng Biển Đông.",
    location_ids: [104, 105],
    facts: [
      "Gần như toàn bộ cơ thể trong suốt như thủy tinh, chỉ có tuyến tiêu hóa hình thoi và đôi mắt là mang sắc tố màu nâu sẫm.",
      "Dưới mỗi mắt có cơ quan phát quang giúp triệt tiêu bóng đen mà đôi mắt tạo ra dưới ánh nắng mờ rọi từ tầng mặt.",
      "Có khả năng bơm nước vào khoang áo để phồng tròn căng như quả bóng cầu gai đánh lừa kẻ săn mồi.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/159842314/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/198754621/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/220145698/large.jpg",
    ],
  },

  // 4. Giáp Xác Bơi Khổng Lồ (Gigantocypris)
  {
    code: "CRU-LC-0287",
    slug: "giap-xac-boi-khong-lo-gigantocypris",
    aliasId: "gigantocypris",
    common_name: "Giáp Xác Bơi Khổng Lồ",
    common_name_en: "Giant Pelagic Ostracod",
    scientificName: "Gigantocypris agassizii",
    group_id: 4n,
    status_id: 1,
    zone_id: 2,
    description: "Giáp xác bơi khổng lồ (Gigantocypris agassizii) to bằng quả bóng bàn màu cam hổ phách trong suốt. Chúng sở hữu đôi mắt gương cầu parabol lớn nhất trong tỉ lệ cơ thể ở thế giới động vật, dùng gương phản xạ hội tụ từng photon le lói để săn giáp xác phù du.",
    description_en: "The giant pelagic ostracod (Gigantocypris agassizii) is an orange ping-pong-sized pelagic crustacean equipped with giant parabolic mirror eyes that capture the faintest photons in the deep twilight.",
    diet: "Giáp xác chân chèo (copepods), mảnh vụn tuyết biển và ấu trùng sinh vật biển",
    diet_en: "Copepods, marine snow detritus, and pelagic larvae",
    size_min_cm: 1.5, size_max_cm: 3.2, weight_min_kg: 0.005, weight_max_kg: 0.015, lifespan_years: 3,
    depth_min_m: 600, depth_max_m: 1300, pressure_atm: 130.0, temperature_min_c: 2.5, temperature_max_c: 5.0,
    light_level: "Bóng tối tuyệt đối", visibility_m: 1.0, dissolved_oxygen_mg_l: 2.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Bồn trũng trung tâm Biển Đông, rãnh sâu phía tây Philippines",
    local_distribution: "Trôi nổi tự do ở tầng sâu 600 - 1300m vùng bồn trũng Biển Đông.",
    location_ids: [104, 105],
    facts: [
      "Trong khi họ hàng Ostracod thường chỉ nhỏ dưới 1mm, loài này tiến hóa khổng lồ bằng quả bóng bàn màu cam hổ phách.",
      "Đôi mắt gương parabol không dùng thấu kính mà dùng gương lõm phản xạ hội tụ ánh sáng trực tiếp lên võng mạc, đạt độ nhạy sáng phi thường.",
      "Bơi lơ lửng nhờ đôi râu chèo dài phe phẩy nhịp nhàng như đôi mái chèo tí hon giữa làn nước lạnh buốt.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/174592314/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/208945612/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/192345612/large.jpg",
    ],
  },

  // 5. Giun Ống Miệng Lạnh Haima
  {
    code: "WOR-LC-0288",
    slug: "giun-ong-mieng-lanh-haima",
    aliasId: "haima-tubeworm",
    common_name: "Giun Ống Miệng Lạnh Haima",
    common_name_en: "Haima Cold Seep Tubeworm",
    scientificName: "Paraescarpia echinospica",
    group_id: 4n,
    status_id: 1,
    zone_id: 3,
    description: "Giun ống miệng lạnh Haima (Paraescarpia echinospica) là sinh vật nền tảng tại Miệng phun lạnh Hải Mã (Haima Cold Seep) ở độ sâu 1,400m dưới đáy Biển Đông. Không có miệng hay ruột, chúng nuôi hàng tỷ vi khuẩn hóa tổng hợp khí metan trong mô cơ thể để lấy dinh dưỡng và có thể thọ hơn 250 năm.",
    description_en: "The Haima cold seep tubeworm (Paraescarpia echinospica) thrives around deep methane seeps at 1,400m in the East Sea, harboring chemosynthetic bacteria in its trophosome and living over 250 years without a digestive tract.",
    diet: "Chất hữu cơ do vi khuẩn hóa tổng hợp khí methane và hydro sulfide cộng sinh sản sinh",
    diet_en: "Nutrients produced by endosymbiotic methanotrophic and sulfur-oxidizing bacteria",
    size_min_cm: 80, size_max_cm: 210, weight_min_kg: 0.2, weight_max_kg: 1.1, lifespan_years: 250,
    depth_min_m: 1300, depth_max_m: 1650, pressure_atm: 160.0, temperature_min_c: 2.0, temperature_max_c: 4.0,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.5, dissolved_oxygen_mg_l: 1.8,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Hệ sinh thái đặc hữu miệng lạnh", cites_appendix: "Không",
    east_sea_zone: "Hệ sinh thái Miệng phun lạnh Hải Mã (Haima Cold Seep), sườn dốc phía tây bắc bồn trũng Biển Đông",
    local_distribution: "Tập trung thành 'rừng giun ống' quanh các vết nứt thoát khí metan ở đáy sâu 1.400m Biển Đông.",
    location_ids: [104, 105],
    facts: [
      "Hoàn toàn không có miệng, không có dạ dày hay hậu môn; sống nhờ hàng tỷ vi khuẩn nội cộng sinh chuyển hóa metan và sulfide thành đường hữu cơ.",
      "Vỏ ống chitin cứng cáp dài tới hơn 2 mét và tốc độ tăng trưởng cực chậm giúp chúng đạt tuổi thọ kỷ lục trên 250 năm.",
      "Tạo thành các 'rừng giun ống' che chở và nuôi dưỡng cả một quần xã sinh vật biển sâu không cần một tia nắng mặt trời nào.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/168945231/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/204592314/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/218945612/large.jpg",
    ],
  },

  // 6. Trai Biển Sâu Haima
  {
    code: "MOL-LC-0289",
    slug: "trai-bien-sau-haima",
    aliasId: "haima-mussel",
    common_name: "Trai Biển Sâu Haima",
    common_name_en: "Haima Deep-Sea Mussel",
    scientificName: "Gigantidas haimaensis",
    group_id: 4n,
    status_id: 1,
    zone_id: 3,
    description: "Trai biển sâu Haima (Gigantidas haimaensis) là loài thân mềm hai mảnh vỏ đặc hữu của các miệng rỉ khí metan Biển Đông. Chúng kết tụ thành những thảm trai ken dày đặc hàng nghìn cá thể trên mỗi mét vuông, sử dụng vi khuẩn oxy hóa metan trong mang để phát triển tươi tốt.",
    description_en: "The Haima deep-sea mussel (Gigantidas haimaensis) forms dense carpets around methane gas vents in the East Sea, utilizing methanotrophic gill endosymbionts for autotrophic nutrition.",
    diet: "Khí metan và chất dinh dưỡng do vi khuẩn cộng sinh trong mang tổng hợp",
    diet_en: "Methane and organic compounds synthesized by methanotrophic gill symbionts",
    size_min_cm: 10, size_max_cm: 23, weight_min_kg: 0.2, weight_max_kg: 0.65, lifespan_years: 40,
    depth_min_m: 1350, depth_max_m: 1600, pressure_atm: 155.0, temperature_min_c: 2.0, temperature_max_c: 4.0,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.5, dissolved_oxygen_mg_l: 1.9,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Hệ sinh thái đặc hữu miệng lạnh", cites_appendix: "Không",
    east_sea_zone: "Khu vực miệng rỉ khí lạnh Hải Mã, sườn dốc bồn trũng Biển Đông",
    local_distribution: "Thảm trai đáy bùn sâu 1.400m ngoài khơi bồn trũng Biển Đông.",
    location_ids: [104, 105],
    facts: [
      "Quần tụ thành những thảm lớn dày đặc phủ kín hàng trăm mét vuông quanh các miệng rỉ khí metan ở đáy sâu Biển Đông.",
      "Mang của trai biến đổi thành các khoang nuôi cấy vi khuẩn ô-xy hóa metan, cung cấp hơn 90% nhu cầu dinh dưỡng hàng ngày.",
      "Lớp vỏ dày màu nâu đen phủ lớp màng periostracum hữu cơ giúp bảo vệ vỏ canxi không bị hòa tan trong môi trường axít hóa đáy sâu.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/182394512/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/209845612/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/197845612/large.jpg",
    ],
  },

  // 7. Cá Ba Chân Vực Sâu
  {
    code: "FSH-LC-0291",
    slug: "ca-ba-chan-tripod-fish",
    aliasId: "tripod-fish",
    common_name: "Cá Ba Chân Vực Sâu",
    common_name_en: "Tripod Fish",
    scientificName: "Bathypterois grallator",
    group_id: 6n,
    status_id: 1,
    zone_id: 3,
    description: "Cá ba chân (Bathypterois grallator) sở hữu hai vây bụng và vây đuôi kéo dài thành 3 chiếc 'chân cà kheo' dài tới 1 mét, cho phép chúng đứng sừng sững trên lớp bùn lỏng đáy biển sâu. Cá luôn đứng quay mặt ngược dòng hải lưu ngầm để đón thức ăn trôi vào miệng.",
    description_en: "The tripod fish (Bathypterois grallator) perches atop three elongated fin rays over 1 meter long, standing proudly in seafloor ooze while facing ambient currents to ambush passing prey.",
    diet: "Giáp xác bơi nhỏ, ấu trùng tôm đáy và động vật phù du",
    diet_en: "Benthic crustaceans, mysids, amphipods, and zooplankton",
    size_min_cm: 30, size_max_cm: 45, weight_min_kg: 0.4, weight_max_kg: 0.95, lifespan_years: 15,
    depth_min_m: 2500, depth_max_m: 4200, pressure_atm: 400.0, temperature_min_c: 1.8, temperature_max_c: 3.0,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.5, dissolved_oxygen_mg_l: 1.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Nền bồn trũng đáy biển sâu trung tâm Biển Đông",
    local_distribution: "Đứng bất động trên lớp bùn trầm tích mịn ở độ sâu 2.500 - 4.000m Biển Đông.",
    location_ids: [104, 105],
    facts: [
      "Ba chiếc vây kéo dài hoạt động như một giàn giáo nâng cơ thể cá lên cao khỏi lớp bùn lỏng đáy biển để giữ mắt và mang sạch sẽ.",
      "Là loài lưỡng tính đồng thời (vừa có tinh hoàn vừa có buồng trứng hoạt động cùng lúc), giúp chúng có thể tự thụ tinh khi không tìm được bạn tình trong vực sâu.",
      "Đôi mắt gần như tiêu biến vì bóng tối, bù lại hai vây ngực giương cao như ăng-ten cảm ứng dao động sóng âm cực nhạy.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/164592314/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/201245698/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/187945612/large.jpg",
    ],
  },

  // 8. Heo Biển Sâu (Sea Pig)
  {
    code: "ECH-LC-0292",
    slug: "heo-bien-sau-sea-pig",
    aliasId: "sea-pig",
    common_name: "Heo Biển Sâu (Sea Pig)",
    common_name_en: "Abyssal Sea Pig",
    scientificName: "Scotoplanes globosa",
    group_id: 4n,
    status_id: 1,
    zone_id: 4,
    description: "Heo biển sâu (Scotoplanes globosa) là loài hải sâm thích nghi tầng đáy thẳm với thân hình tròn mập mọng nước màu hồng nhạt. Chúng bước đi bằng các 'chân ống' thủy lực trên lớp bùn mềm của vực thẳm và dùng xúc tu quanh miệng để lọc các hạt hữu cơ từ tuyết biển lắng đọng.",
    description_en: "The sea pig (Scotoplanes globosa) is a deep-sea holothurian strolling across abyssal plains on hydraulic tube feet, vacuuming organic sediments and marine snow with its ring of feeding tentacles.",
    diet: "Chất hữu cơ trong bùn đáy, xác tảo và vi sinh vật lắng đọng",
    diet_en: "Organic matter in benthic sediment, decaying algae, and microbe-rich detritus",
    size_min_cm: 10, size_max_cm: 18, weight_min_kg: 0.1, weight_max_kg: 0.28, lifespan_years: 12,
    depth_min_m: 4000, depth_max_m: 5016, pressure_atm: 500.0, temperature_min_c: 1.5, temperature_max_c: 2.5,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.3, dissolved_oxygen_mg_l: 1.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Vực thẳm trung tâm Biển Đông và thềm đáy dốc Rãnh Manila",
    local_distribution: "Bò trên lớp bùn đáy vực thẳm bồn trũng Biển Đông và đáy Rãnh Manila.",
    location_ids: [104, 105],
    facts: [
      "Thực chất là một loài hải sâm nước sâu nhưng có hình dáng mũm mĩm và đôi chân ống bơm dịch lỏng giống như chú heo con.",
      "Đóng vai trò như 'máy cày sinh học' của đáy đại dương, xới xáo và làm thoáng khí cho lớp trầm tích đáy biển sâu hàng nghìn mét.",
      "Da chứa hóa chất độc hại holothurin giúp chúng không bị các loài cá đáy vực thẳm khác tấn công ăn thịt.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/157894231/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/208459231/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/193456128/large.jpg",
    ],
  },

  // 9. Sao Giòn Vực Thẳm
  {
    code: "ECH-LC-0293",
    slug: "sao-gion-vuc-tham",
    aliasId: "brittle-star",
    common_name: "Sao Giòn Vực Thẳm",
    common_name_en: "Abyssal Brittle Star",
    scientificName: "Ophiura sarsii",
    group_id: 4n,
    status_id: 1,
    zone_id: 4,
    description: "Sao giòn vực thẳm (Ophiura sarsii) bám trên vách đá bazan dựng đứng của sườn dốc Rãnh Manila. Với 5 cánh tay dài phủ đầy gai mịn dẻo dai chứa cấu trúc vi tinh thể đặc biệt chống hòa tan canxit, chúng bắt trọn các mảnh vụn thức ăn cuốn theo hải lưu ngầm.",
    description_en: "The abyssal brittle star (Ophiura sarsii) clings to basalt escarpments of the Manila Trench, waving five flexible, spine-covered arms with calcite microstructures resilient against extreme pressure.",
    diet: "Mảnh vụn hữu cơ trôi dạt, giáp xác phù du nhỏ và xác động vật chìm",
    diet_en: "Drifting organic particles, small amphipods, and carrion fragments",
    size_min_cm: 12, size_max_cm: 26, weight_min_kg: 0.03, weight_max_kg: 0.09, lifespan_years: 15,
    depth_min_m: 4200, depth_max_m: 5016, pressure_atm: 502.0, temperature_min_c: 1.5, temperature_max_c: 2.2,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.3, dissolved_oxygen_mg_l: 1.3,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Chưa xếp hạng", cites_appendix: "Không",
    east_sea_zone: "Vách đá bazan Rãnh Manila và đáy thẳm Biển Đông",
    local_distribution: "Bám trên vách dốc bazan Rãnh Manila từ 4.200m xuống tới đáy rãnh.",
    location_ids: [104, 105],
    facts: [
      "Bộ xương canxi carbonate chứa cấu trúc vi tinh thể đặc biệt giúp chống lại sự hòa tan canxit dưới áp suất nước trên 500 atm.",
      "Có khả năng tự rụng cánh tay khi bị kẻ thù tấn công để trốn thoát, sau đó tái sinh hoàn chỉnh cánh tay mới trong môi trường dinh dưỡng nghèo nàn.",
      "Uốn lượn cánh tay mềm dẻo để bước đi nhanh nhẹn trên nền bùn lỏng hoặc leo trèo trên vách đá dốc đứng.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/172345912/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/204856912/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/189456123/large.jpg",
    ],
  },

  // 10. Cá Ốc Rãnh Sâu Manila (Hadal Snailfish)
  {
    code: "FSH-LC-0294",
    slug: "ca-oc-ranh-sau-hadal-snailfish",
    aliasId: "hadal-snailfish",
    common_name: "Cá Ốc Rãnh Sâu Manila",
    common_name_en: "Manila Trench Hadal Snailfish",
    scientificName: "Pseudoliparis amblystomopsis",
    group_id: 6n,
    status_id: 1,
    zone_id: 4,
    description: "Cá ốc rãnh sâu Manila (Pseudoliparis amblystomopsis) là động vật có xương sống sống sâu nhất Biển Đông tại Rãnh Manila (4,850m - 5,016m). Thân cá dạng thạch mềm đàn hồi cao, không vảy, không bóng hơi và chứa nồng độ TMAO cực cao giúp màng tế bào không bị nghiền nát dưới 500 atm.",
    description_en: "The Manila Trench hadal snailfish (Pseudoliparis amblystomopsis) is the deepest living vertebrate in the East Sea (4,850m-5,016m), equipped with scaleless gelatinous tissue and high cellular TMAO piezolytes.",
    diet: "Giáp xác chân hai rãnh thẳm (amphipods) và sâu biển đáy rãnh",
    diet_en: "Hadal amphipods, polychaete worms, and small trench crustaceans",
    size_min_cm: 15, size_max_cm: 28, weight_min_kg: 0.15, weight_max_kg: 0.38, lifespan_years: 10,
    depth_min_m: 4500, depth_max_m: 5016, pressure_atm: 502.0, temperature_min_c: 1.0, temperature_max_c: 2.0,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.3, dissolved_oxygen_mg_l: 1.1,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Kỷ lục độ sâu động vật có xương sống", cites_appendix: "Không",
    east_sea_zone: "Rãnh Manila - Vực sâu nhất Biển Đông",
    local_distribution: "Sống sát nền đáy đá và bùn tại các độ sâu 4.500m - 5.016m của Rãnh Manila.",
    location_ids: [104, 105],
    facts: [
      "Nắm giữ kỷ lục sinh vật có xương sống sống sâu nhất hành tinh, chịu đựng áp suất nghiền nát hơn 500 atmosphere tương đương chiếc xe tải đè lên đầu ngón tay.",
      "Cơ thể hoàn toàn không có vảy và không có bóng hơi (bóng khí sẽ bị nén nổ tung ở độ sâu này); toàn thân là khối thạch trong suốt đàn hồi.",
      "Tế bào tích tụ nồng độ phân tử TMAO (trimethylamine N-oxide) cực cao giúp bảo vệ chuỗi protein không bị biến tính dưới áp lực khủng khiếp.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/168945234/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/201456912/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/195612845/large.jpg",
    ],
  },

  // 11. Giáp Xác Chân Hai Rãnh Manila (Hadal Amphipod)
  {
    code: "CRU-LC-0295",
    slug: "giap-xac-chan-hai-ranh-manila",
    aliasId: "hadal-amphipod",
    common_name: "Giáp Xác Chân Hai Rãnh Manila",
    common_name_en: "Manila Trench Hadal Amphipod",
    scientificName: "Paralicella caperesca",
    group_id: 4n,
    status_id: 1,
    zone_id: 4,
    description: "Giáp xác chân hai rãnh Manila (Paralicella caperesca) là cư dân bền bỉ nhất tại điểm sâu nhất Biển Đông - đáy Rãnh Manila (5,016m). Với khứu giác siêu nhạy ngửi mùi xác cá từ hàng cây số và hệ enzym tiêu hóa mạnh mẽ, chúng đóng vai trò dọn dẹp xác sinh vật chìm xuống tận cùng đại dương.",
    description_en: "The Manila Trench hadal amphipod (Paralicella caperesca) dominates the deepest floor of the East Sea at 5,016m, acting as voracious scavengers devouring organic falls in perpetual darkness.",
    diet: "Xác cá, xác động vật biển chìm xuống đáy rãnh và mảnh vụn hữu cơ",
    diet_en: "Carrion, sunken fish falls, organic detritus, and marine snow",
    size_min_cm: 2, size_max_cm: 5.5, weight_min_kg: 0.005, weight_max_kg: 0.025, lifespan_years: 5,
    depth_min_m: 4800, depth_max_m: 5016, pressure_atm: 502.0, temperature_min_c: 1.0, temperature_max_c: 1.8,
    light_level: "Bóng tối tuyệt đối 0%", visibility_m: 0.2, dissolved_oxygen_mg_l: 1.0,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Kỷ lục sinh vật chạm đáy Biển Đông", cites_appendix: "Không",
    east_sea_zone: "Điểm sâu nhất Biển Đông: Đáy Rãnh Manila (5,016m)",
    local_distribution: "Tập trung với mật độ cao tại lớp bùn đáy của Rãnh Manila ở độ sâu 5,016m.",
    location_ids: [104, 105],
    facts: [
      "Chạm đáy Rãnh Manila ở độ sâu 5,016m — điểm sâu nhất của toàn bộ Biển Đông! Là cư dân đông đúc và kiên cường nhất tại ranh giới sự sống này.",
      "Khứu giác cực nhạy với axit amin, hàng nghìn con có thể tập hợp lại chỉ trong vài chục phút khi có một xác cá hay xác cá voi chìm xuống đáy rãnh.",
      "Hệ enzym tiêu hóa siêu việt cho phép chúng rỉa sạch trơn xác cá đến tận xương trong vòng vài giờ, khép lại chu trình dinh dưỡng nơi tận cùng biển cả.",
    ],
    fallbackPhotos: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/175894123/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/209456123/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/184561298/large.jpg",
    ],
  },
];

async function run() {
  console.log("🌊 Bắt đầu nạp 11 loài sinh vật biển sâu Biển Đông...");

  for (const tbl of ["species", "species_media", "species_facts", "species_translations", "species_relationships"]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), true);`
    );
  }

  const locations = await prisma.locations.findMany({ select: { id: true } });
  const validLocIds = new Set(locations.map((l) => Number(l.id)));

  const crawledList = [];

  for (const sp of ELEVEN_SPECIES) {
    console.log(`\n🔎 [DEEP SEA] Đang chuẩn bị dữ liệu: ${sp.common_name} (${sp.scientificName})...`);

    const [sourceApiId, mediaList] = await Promise.all([
      getWoRMSId(sp.scientificName),
      getINaturalistPhotos(sp.scientificName, sp.common_name, sp.fallbackPhotos),
    ]);

    console.log(`   ✅ Taxonomy: ${sourceApiId || "local"} | Ảnh: ${mediaList.length} ảnh`);

    const existing = await prisma.species.findFirst({
      where: {
        OR: [
          { code: sp.code },
          { slug: sp.slug },
          { scientificName: sp.scientificName },
        ],
      },
    });

    let saved;
    if (existing) {
      saved = await prisma.species.update({
        where: { id: existing.id },
        data: {
          code: existing.code,
          scientificName: sp.scientificName.slice(0, 255),
          common_name: sp.common_name.slice(0, 255),
          slug: sp.slug.slice(0, 255),
          species_groups: { connect: { id: sp.group_id } },
          conservation_statuses: { connect: { id: sp.status_id } },
          ocean_zones: { connect: { id: sp.zone_id } },
          description: sp.description,
          diet: sp.diet,
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
          light_level: sp.light_level.slice(0, 48),
          visibility_m: sp.visibility_m,
          dissolved_oxygen_mg_l: sp.dissolved_oxygen_mg_l,
          vietnam_red_list_status: sp.vietnam_red_list_status.slice(0, 20),
          vietnam_protection_group: sp.vietnam_protection_group.slice(0, 50),
          cites_appendix: sp.cites_appendix.slice(0, 20),
          east_sea_zone: sp.east_sea_zone.slice(0, 100),
          local_distribution: sp.local_distribution,
          source_api_id: (sourceApiId || "").slice(0, 100),
          is_visible: true,
          deleted_at: null,
        },
      });
      console.log(`   🔄 Đã cập nhật loài: ${saved.common_name} (ID: ${saved.id})`);
    } else {
      saved = await prisma.species.create({
        data: {
          code: sp.code.slice(0, 30),
          scientificName: sp.scientificName.slice(0, 255),
          common_name: sp.common_name.slice(0, 255),
          slug: sp.slug.slice(0, 255),
          species_groups: { connect: { id: sp.group_id } },
          conservation_statuses: { connect: { id: sp.status_id } },
          ocean_zones: { connect: { id: sp.zone_id } },
          description: sp.description,
          diet: sp.diet,
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
          light_level: sp.light_level.slice(0, 48),
          visibility_m: sp.visibility_m,
          dissolved_oxygen_mg_l: sp.dissolved_oxygen_mg_l,
          vietnam_red_list_status: sp.vietnam_red_list_status.slice(0, 20),
          vietnam_protection_group: sp.vietnam_protection_group.slice(0, 50),
          cites_appendix: sp.cites_appendix.slice(0, 20),
          east_sea_zone: sp.east_sea_zone.slice(0, 100),
          local_distribution: sp.local_distribution,
          source_api_id: (sourceApiId || "").slice(0, 100),
          is_visible: true,
        },
      });
      console.log(`   ✨ Đã tạo mới loài: ${saved.common_name} (ID: ${saved.id})`);
    }

    crawledList.push({ ...sp, dbId: saved.id, mediaList });

    // Media
    if (mediaList.length > 0) {
      await prisma.species_media.deleteMany({ where: { species_id: saved.id } });
      await prisma.species_media.createMany({
        data: mediaList.map((m, idx) => ({
          species_id: saved.id,
          type: "image",
          url: m.url,
          caption: m.caption,
          is_primary: idx === 0,
        })),
      });
    }

    // Facts
    await prisma.species_facts.deleteMany({ where: { species_id: saved.id } });
    await prisma.species_facts.createMany({
      data: sp.facts.map((content, idx) => ({
        species_id: saved.id,
        content,
        sort_order: idx + 1,
      })),
    });

    // Translations
    await prisma.species_translations.upsert({
      where: { species_id_language_code: { species_id: saved.id, language_code: "vi" } },
      update: { common_name: sp.common_name, description: sp.description, diet: sp.diet },
      create: { species_id: saved.id, language_code: "vi", common_name: sp.common_name, description: sp.description, diet: sp.diet },
    });
    await prisma.species_translations.upsert({
      where: { species_id_language_code: { species_id: saved.id, language_code: "en" } },
      update: { common_name: sp.common_name_en, description: sp.description_en, diet: sp.diet_en },
      create: { species_id: saved.id, language_code: "en", common_name: sp.common_name_en, description: sp.description_en, diet: sp.diet_en },
    });

    // Locations
    const locLinks = sp.location_ids.filter((lid) => validLocIds.has(lid));
    for (const lid of locLinks) {
      await prisma.species_locations.upsert({
        where: { species_id_location_id: { species_id: saved.id, location_id: BigInt(lid) } },
        update: {},
        create: { species_id: saved.id, location_id: BigInt(lid) },
      });
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  // Thiết lập mạng lưới quan hệ sinh thái
  console.log("\n🕸️  Đang liên kết mạng lưới thức ăn tầng sâu Biển Đông...");
  const allSpecies = await prisma.species.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(allSpecies.map((s) => [s.slug, s.id]));

  const ECO_RELATIONSHIPS = [
    // Cá nhám ma
    { src: "ca-nham-ma-ghost-shark", tgt: "cua-da-bien-sau", type: "predator_prey", desc: "Nghiền nát vỏ cua đá biển sâu bằng các phiến răng khoáng hóa.", strength: 0.86 },
    { src: "ca-nham-ma-ghost-shark", tgt: "bo-bien-khong-lo-giant-isopod", type: "competitor", desc: "Cạnh tranh xác động vật chìm và giáp xác đáy thềm lục địa.", strength: 0.78 },

    // Cá rồng đen
    { src: "ca-rong-den-bien-sau", tgt: "ca-den-long-bien-sau", type: "predator_prey", desc: "Săn bắt cá đèn lồng di cư tầng trung bằng hàm răng nanh dài.", strength: 0.9 },
    { src: "ca-rong-den-bien-sau", tgt: "ca-can-cau-bien-sau-anglerfish", type: "competitor", desc: "Cạnh tranh vị trí săn mồi đỉnh cao tại tầng tối 1000m.", strength: 0.82 },

    // Mực thủy tinh
    { src: "muc-thuy-tinh-glass-squid", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt các ấu trùng giáp xác phù du trôi trong bóng tối.", strength: 0.85 },
    { src: "ca-ngu-vay-vang-dai-duong", tgt: "muc-thuy-tinh-glass-squid", type: "predator_prey", desc: "Cá ngừ săn mực thủy tinh khi mực bơi lên tầng trên.", strength: 0.88 },

    // Giun ống & Trai Haima
    { src: "giun-ong-mieng-lanh-haima", tgt: "trai-bien-sau-haima", type: "symbiosis", desc: "Tạo cấu trúc rạn lạnh hỗ trợ nhau khai thác vỉa khí metan đáy sâu.", strength: 0.95 },
    { src: "cua-da-bien-sau", tgt: "giun-ong-mieng-lanh-haima", type: "symbiosis", desc: "Cua đá leo trên thân ống giun cạo màng vi khuẩn bám ngoài.", strength: 0.88 },

    // Cá ba chân
    { src: "ca-ba-chan-tripod-fish", tgt: "ca-duoi-chuot-bien-sau", type: "competitor", desc: "Cùng phân chia không gian săn giáp xác đáy bồn trũng trung tâm.", strength: 0.8 },

    // Heo biển sâu
    { src: "heo-bien-sau-sea-pig", tgt: "muc-ma-ca-rong-bien-sau", type: "competitor", desc: "Cùng tiêu thụ nguồn tuyết biển hữu cơ lắng đọng xuống đáy sâu.", strength: 0.75 },

    // Sao giòn vực thẳm
    { src: "sao-gion-vuc-tham", tgt: "giap-xac-chan-hai-ranh-manila", type: "competitor", desc: "Cùng lọc nhặt các mảnh vụn thức ăn cuốn theo dòng chảy Rãnh Manila.", strength: 0.78 },

    // Cá ốc rãnh sâu Manila & Giáp xác chân hai
    { src: "ca-oc-ranh-sau-hadal-snailfish", tgt: "giap-xac-chan-hai-ranh-manila", type: "predator_prey", desc: "Cá ốc là kẻ săn mồi đỉnh cao của Rãnh Manila, ăn giáp xác chân hai.", strength: 0.95 },
    { src: "giap-xac-chan-hai-ranh-manila", tgt: "ca-oc-ranh-sau-hadal-snailfish", type: "commensalism", desc: "Khi cá ốc chết chìm xuống, đàn giáp xác chân hai rỉa sạch xác.", strength: 0.9 },
  ];

  let relCount = 0;
  for (const rel of ECO_RELATIONSHIPS) {
    const sId = idBySlug.get(rel.src);
    const tId = idBySlug.get(rel.tgt);
    if (!sId || !tId) continue;

    await prisma.species_relationships.upsert({
      where: {
        source_species_id_target_species_id_relationship_type: {
          source_species_id: sId,
          target_species_id: tId,
          relationship_type: rel.type,
        },
      },
      update: {
        description: rel.desc,
        ecological_impact: "Duy trì cân bằng chuỗi thức ăn đáy thẳm đại dương.",
        strength: rel.strength,
      },
      create: {
        source_species_id: sId,
        target_species_id: tId,
        relationship_type: rel.type,
        description: rel.desc,
        ecological_impact: "Duy trì cân bằng chuỗi thức ăn đáy thẳm đại dương.",
        strength: rel.strength,
      },
    });
    relCount++;
  }
  console.log(`   ✅ Đã thêm/cập nhật ${relCount} liên kết sinh thái đáy sâu!`);

  // Đồng bộ vào speciesMock.js
  console.log("\n📦 Đang đồng bộ 11 loài vào frontend/src/mocks/speciesMock.js...");
  if (fs.existsSync(MOCK_FILE)) {
    let mockContent = fs.readFileSync(MOCK_FILE, "utf-8");
    const targetIndex = mockContent.indexOf("/* Fun Facts Ocean Data */");
    if (targetIndex !== -1) {
      const insertPos = mockContent.lastIndexOf("];", targetIndex);
      let newMockEntries = "";

      for (const sp of crawledList) {
        if (mockContent.includes(`"${sp.slug}"`) || mockContent.includes(`'${sp.slug}'`)) {
          continue;
        }

        const mediaUrls = sp.mediaList.map((m) => m.url);
        newMockEntries += `  {
    id: "${sp.aliasId}",
    slug: "${sp.slug}",
    category: "cartilage-fish",
    categoryVi: "Biển sâu",
    categoryEn: "Deep Sea",
    statusVi: "Ít quan tâm",
    statusEn: "Least Concern",
    statusType: "safe",
    nameVi: "${sp.common_name}",
    nameEn: "${sp.common_name_en}",
    sciName: "${sp.scientificName}",
    descVi: "${sp.description.slice(0, 180)}...",
    descEn: "${sp.description_en.slice(0, 180)}...",
    depth: "${sp.depth_min_m} - ${sp.depth_max_m}m",
    size: "${sp.size_min_cm}cm - ${sp.size_max_cm}cm",
    sizeEn: "${sp.size_min_cm}cm - ${sp.size_max_cm}cm",
    image: "${mediaUrls[0]}",
    gallery: ${JSON.stringify(mediaUrls, null, 6)},
    isFeatured: false,
  },
`;
      }

      if (newMockEntries) {
        mockContent = mockContent.slice(0, insertPos) + newMockEntries + mockContent.slice(insertPos);
        fs.writeFileSync(MOCK_FILE, mockContent, "utf-8");
        console.log("   ✅ Đã ghi thành công 11 loài mới vào speciesMock.js!");
      }
    }
  }

  const finalTotal = await prisma.species.count();
  console.log(`\n🎉 HOÀN TẤT: Tổng số loài trong DB đạt ${finalTotal} loài!`);
}

run()
  .catch((e) => {
    console.error("❌ Lỗi:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
