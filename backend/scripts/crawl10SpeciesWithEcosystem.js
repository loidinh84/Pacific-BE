import axios from "axios";
import prisma from "../src/lib/prisma.js";
import vectorSearchService from "../src/services/vectorSearchService.js";

/**
 * Crawler & Seeder 10 loài sinh vật biển tiêu biểu Biển Đông - Thái Bình Dương:
 * 1. Lấy taxonomy ID thật từ WoRMS / GBIF API
 * 2. Cào 4 ảnh thợ lặn / động vật hoang dã dưới nước thật 100% từ iNaturalist (Research Grade, captive=false)
 * 3. Nạp đầy đủ bảng species, species_media, species_facts, species_translations, species_locations
 * 4. Xây dựng mạng lưới sinh thái & chuỗi thức ăn (species_relationships) liên kết với hệ sinh thái hiện có
 * 5. Đồng bộ vector embeddings cho tìm kiếm ngữ nghĩa
 */

const BANNED_PHOTO_TERMS = [
  "dead",
  "deceased",
  "washed up",
  "stranded",
  "beached",
  "market",
  "fish market",
  "aquarium",
  "captive",
  "tank",
  "zoo",
  "specimen",
  "preserved",
  "museum",
  "fishing",
  "hooked",
  "caught",
  "trawl",
  "plate",
  "cooked",
  "food",
  "dried",
  "skeleton",
  "skull",
  "jaw",
  "shell only",
  "dissected",
  "necropsy",
];

const TEN_SPECIES = [
  {
    code: "FSH-NT-0251",
    slug: "ca-map-ho-tiger-shark",
    common_name: "Cá Mập Hổ",
    common_name_en: "Tiger Shark",
    scientificName: "Galeocerdo cuvier",
    group_slug: "ca-bien",
    status_code: "NT",
    zone_id: 1,
    description:
      "Cá mập hổ (Galeocerdo cuvier) là một trong những loài cá mập lớn và hung dữ bậc nhất đại dương nhiệt đới. Chúng nổi bật với các sọc vằn sẫm giống vằn hổ dọc hai bên thân khi còn non và hàm răng hình răng cưa cong sắc bén có thể cắn vỡ cả mai rùa biển.",
    description_en:
      "The tiger shark (Galeocerdo cuvier) is a large macropredator of tropical oceans, named for the dark vertical stripes along its flanks and renowned for serrated teeth capable of cracking sea turtle shells.",
    diet: "Rùa biển, cá đuối, rắn biển, cá ngừ, mực lớn và xác động vật biển",
    diet_en: "Sea turtles, rays, sea snakes, tuna, large squid, and marine carrion",
    size_min_cm: 325,
    size_max_cm: 550,
    weight_min_kg: 385,
    weight_max_kg: 850,
    lifespan_years: 30,
    depth_min_m: 0,
    depth_max_m: 350,
    pressure_atm: 36.0,
    temperature_min_c: 19.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng yếu đến trung bình (Epipelagic - Mesopelagic)",
    visibility_m: 20.0,
    dissolved_oxygen_mg_l: 6.2,
    vietnam_red_list_status: "VU",
    vietnam_protection_group: "Nhóm II - Cần kiểm soát khai thác",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Quần đảo Trường Sa, Hoàng Sa, vùng biển khơi Nam Trung Bộ",
    local_distribution:
      "Thường xuất hiện theo mùa quanh các rạn san hô xa bờ tại Trường Sa, Hoàng Sa, Phú Quý và vùng nước sâu ngoài khơi Bình Thuận - Khánh Hòa.",
    location_ids: [104, 105, 101],
    facts: [
      "Răng cá mập hổ có dạng lưỡi cưa vát xéo độc đáo giúp chúng cắt xuyên mai cứng của rùa biển dễ dàng.",
      "Chúng có khả năng di cư hàng ngàn kilômét xuyên đại dương giữa các bãi san hô săn mồi và vùng sinh sản.",
      "Là loài duy nhất trong họ Carcharhinidae đẻ con thay vì đẻ trứng, mỗi lứa có thể sinh tới 30-80 cá mập con.",
    ],
    fallback_queries: ["Galeocerdo cuvier"],
  },
  {
    code: "FSH-LC-0252",
    slug: "ca-duoi-dom-xanh",
    common_name: "Cá Đuối Đốm Xanh",
    common_name_en: "Bluespotted Ribbontail Ray",
    scientificName: "Taeniura lymma",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description:
      "Cá đuối đốm xanh (Taeniura lymma) là loài cá đuối rạn san hô có màu sắc rực rỡ đặc trưng với thân hình bầu dục màu nâu vàng phủ đầy các đốm tròn xanh lam sáng rực. Hai bên đuôi có hai dải sọc xanh chạy dọc và sở hữu gai độc tự vệ ở gốc đuôi.",
    description_en:
      "The bluespotted ribbontail ray (Taeniura lymma) is a vibrant reef stingray featuring bright electric-blue spots across a golden-olive disc and twin venomous tail spines.",
    diet: "Giun biển, tôm nhỏ, cua rạn san hô và động vật thân mềm đáy cát",
    diet_en: "Marine worms, reef crabs, small shrimp, and benthic mollusks",
    size_min_cm: 25,
    size_max_cm: 70,
    weight_min_kg: 1.5,
    weight_max_kg: 5.0,
    lifespan_years: 15,
    depth_min_m: 1,
    depth_max_m: 30,
    pressure_atm: 4.0,
    temperature_min_c: 23.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng rạn cạn (Photic zone)",
    visibility_m: 15.0,
    dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Loài rạn san hô cần bảo vệ sinh cảnh",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô Côn Đảo, Phú Quốc, Nha Trang, Cù Lao Chàm",
    local_distribution:
      "Phân bố phổ biến dưới các gờ đá san hô và bãi cát ven rạn nông tại Hòn Mun (Nha Trang), Côn Đảo, Phú Quốc và Cù Lao Chàm.",
    location_ids: [101, 102, 103, 106],
    facts: [
      "Ban ngày chúng thường ẩn mình trong hang hốc dưới tán san hô, đến khi thủy triều lên mới bơi theo nhóm nhỏ đi sục cát tìm mồi.",
      "Những đốm xanh neon không phải sắc tố thông thường mà được tạo ra bởi các tinh thể cấu trúc nano phản chiếu ánh sáng dưới nước.",
      "Gai đuôi có ngạnh chứa nọc độc chỉ dùng để tự vệ khi bị cá nhám hoặc động vật săn mồi lớn tấn công.",
    ],
    fallback_queries: ["Taeniura lymma"],
  },
  {
    code: "FSH-LC-0253",
    slug: "ca-song-cham-xanh",
    common_name: "Cá Song Chấm Xanh",
    common_name_en: "Leopard Coral Grouper",
    scientificName: "Plectropomus leopardus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description:
      "Cá song chấm xanh (Plectropomus leopardus), còn gọi là cá mú đỏ chấm xanh, là loài cá săn mồi rạn san hô có giá trị sinh thái và thẩm mỹ cao. Thân cá có sắc đỏ cam rực rỡ hoặc nâu oliu điểm xuyết hàng trăm chấm nhỏ màu xanh lam óng ánh.",
    description_en:
      "The leopard coral grouper (Plectropomus leopardus) is an apex reef predator recognizable by its vivid orange-red body speckled with iridescent blue dots.",
    diet: "Cá rạn san hô nhỏ, mực nang, tôm và cua rạn",
    diet_en: "Small reef fishes, cuttlefish, reef shrimp, and crabs",
    size_min_cm: 45,
    size_max_cm: 120,
    weight_min_kg: 3.0,
    weight_max_kg: 24.0,
    lifespan_years: 26,
    depth_min_m: 3,
    depth_max_m: 100,
    pressure_atm: 11.0,
    temperature_min_c: 22.0,
    temperature_max_c: 29.5,
    light_level: "Ánh sáng vừa vùng rạn dốc (Reef slope)",
    visibility_m: 18.0,
    dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "NT",
    vietnam_protection_group: "Quản lý kích thước khai thác tối thiểu",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Cù Lao Chàm, Lý Sơn, Trường Sa",
    local_distribution:
      "Sinh sống quanh các sườn dốc rạn san hô nhiều hang hốc từ vịnh Hạ Long, Cù Lao Chàm đến Nha Trang, Ninh Thuận và Trường Sa.",
    location_ids: [102, 103, 105],
    facts: [
      "Là loài lưỡng tính chuyển giới: đa số cá thể khởi đầu là cá cái rồi chuyển thành cá đực đầu đàn khi đạt kích thước lớn.",
      "Đôi khi chúng hợp tác săn mồi đầy thông minh cùng cá chình biển để lùa cá nhỏ ra khỏi khe đá san hô.",
      "Có khả năng thay đổi sắc thái từ đỏ tươi sang nâu sẫm tức thì để ngụy trang khi rình mồi.",
    ],
    fallback_queries: ["Plectropomus leopardus"],
  },
  {
    code: "FSH-LC-0254",
    slug: "ca-bo-picasso",
    common_name: "Cá Bò Picasso",
    common_name_en: "Lagoon Triggerfish",
    scientificName: "Rhinecanthus aculeatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description:
      "Cá bò Picasso (Rhinecanthus aculeatus) sở hữu bộ hoa văn hình học ấn tượng như một bức tranh lập thể với các mảng đen, trắng, xanh lam và vàng cam xen kẽ. Chúng có tính lãnh thổ rất cao và biết khóa chặt gai vây lưng vào khe đá san hô để tự vệ.",
    description_en:
      "The lagoon triggerfish (Rhinecanthus aculeatus), nicknamed Picasso triggerfish, displays bold geometric patterns and locks its dorsal spine tightly inside reef crevices at night.",
    diet: "Cầu gai, cua nhỏ, giáp xác, giun nhiều tơ và tảo đáy",
    diet_en: "Sea urchins, small crabs, polychaete worms, and benthic algae",
    size_min_cm: 15,
    size_max_cm: 30,
    weight_min_kg: 0.3,
    weight_max_kg: 0.9,
    lifespan_years: 10,
    depth_min_m: 0,
    depth_max_m: 50,
    pressure_atm: 6.0,
    temperature_min_c: 23.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng đầm phá và rạn nông",
    visibility_m: 15.0,
    dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Loài chỉ thị sức khỏe rạn san hô",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Đầm phá rạn san hô Hoàng Sa, Trường Sa, Nha Trang",
    local_distribution:
      "Cư trú ở các đầm phá đáy cát pha san hô vụn và rạn cạn tại Côn Đảo, Hòn Mun, Hoàng Sa và Trường Sa.",
    location_ids: [101, 103, 104, 105],
    facts: [
      "Khi gặp nguy hiểm, chúng chui tọt vào khe san hô hẹp rồi dựng thẳng gai vây lưng thứ nhất và khóa chặt bằng gai thứ hai như chốt cò súng.",
      "Để ăn cầu gai có gai nhọn, cá bò Picasso thổi luồng nước mạnh từ miệng để lật ngửa con mồi rồi tấn công phần bụng mềm.",
      "Có thể phát ra âm thanh rít trầm bằng cách rung bóng hơi và nghiến răng để cảnh báo kẻ xâm phạm lãnh thổ.",
    ],
    fallback_queries: ["Rhinecanthus aculeatus"],
  },
  {
    code: "FSH-LC-0255",
    slug: "ca-khe-khong-lo",
    common_name: "Cá Khế Khổng Lồ",
    common_name_en: "Giant Trevally",
    scientificName: "Caranx ignobilis",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description:
      "Cá khế khổng lồ (Caranx ignobilis) là loài cá săn mồi cơ bắp lớn nhất trong họ Cá khế, có thân ánh bạc dày dặn, vầng trán dốc khỏe khoắn và đuôi chẻ tạo gia tốc cực nhanh. Chúng thường tuần tra theo đàn dọc mép rạn san hô và cửa biển sâu.",
    description_en:
      "The giant trevally (Caranx ignobilis) is the largest member of the jack family, an apex reef-edge predator known for explosive bursts of speed and muscular silver flanks.",
    diet: "Cá chuồn, cá trích, mực ống, bạch tuộc và giáp xác",
    diet_en: "Flying fish, herrings, squid, reef octopus, and crustaceans",
    size_min_cm: 80,
    size_max_cm: 170,
    weight_min_kg: 15.0,
    weight_max_kg: 80.0,
    lifespan_years: 24,
    depth_min_m: 5,
    depth_max_m: 100,
    pressure_atm: 11.0,
    temperature_min_c: 20.0,
    temperature_max_c: 29.0,
    light_level: "Ánh sáng mạnh đến vừa vùng mép rạn dốc",
    visibility_m: 20.0,
    dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Quản lý bảo tồn nguồn lợi thủy sản",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Côn Đảo, Phú Quốc, Trường Sa, đảo Bạch Long Vĩ",
    local_distribution:
      "Bơi tuần tra thành từng nhóm quanh các rạn đá dốc, bãi cạn và vùng nước chảy xiết tại Côn Đảo, Trường Sa, Phú Quốc và Bạch Long Vĩ.",
    location_ids: [101, 105, 106, 108],
    facts: [
      "Cá khế khổng lồ thậm chí có thể tung mình vọt khỏi mặt nước để đớp chim biển bay thấp gần mặt sóng.",
      "Chúng thường bơi kèm sát bên cá mập hoặc cá mú lớn để tận dụng lúc con mồi hoảng loạn và chia cắt đàn cá nhỏ.",
      "Cá đực trưởng thành thường chuyển sang sắc màu đen tuyền sẫm uy nghi trong mùa sinh sản.",
    ],
    fallback_queries: ["Caranx ignobilis"],
  },
  {
    code: "MAM-EN-0256",
    slug: "ca-voi-xanh",
    common_name: "Cá Voi Xanh",
    common_name_en: "Blue Whale",
    scientificName: "Balaenoptera musculus",
    group_slug: "dong-vat-co-vu-bien",
    status_code: "EN",
    zone_id: 1,
    description:
      "Cá voi xanh (Balaenoptera musculus) là loài động vật lớn nhất từng tồn tại trong lịch sử Trái Đất, có thể dài tới 30 mét và nặng hơn 150 tấn. Dù khổng lồ, chúng chỉ ăn lọc các đàn nhuyễn thể và sinh vật phù du qua hệ thống tấm sừng hàm khổng lồ.",
    description_en:
      "The blue whale (Balaenoptera musculus) is the largest animal known to have ever lived on Earth, reaching up to 30 meters and filter-feeding vast swarms of krill and plankton.",
    diet: "Nhuyễn thể (krill), giáp xác chân kiếm và sinh vật phù du",
    diet_en: "Krill, copepods, and dense planktonic swarms",
    size_min_cm: 2200,
    size_max_cm: 3000,
    weight_min_kg: 90000,
    weight_max_kg: 160000,
    lifespan_years: 90,
    depth_min_m: 0,
    depth_max_m: 500,
    pressure_atm: 51.0,
    temperature_min_c: 2.0,
    temperature_max_c: 28.0,
    light_level: "Tầng mặt đến tầng trung đại dương khơi",
    visibility_m: 25.0,
    dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "EN",
    vietnam_protection_group: "Nhóm IB - Nghiêm cấm khai thác",
    cites_appendix: "Phụ lục I",
    east_sea_zone: "Vùng biển khơi sâu Tây Thái Bình Dương và thềm Biển Đông",
    local_distribution:
      "Di cư qua vùng nước sâu ngoài khơi Biển Đông và Tây Thái Bình Dương vào mùa di chuyển tìm nguồn thức ăn và sinh sản.",
    location_ids: [105, 4],
    facts: [
      "Trái tim của cá voi xanh nặng khoảng 180 kg — tương đương kích thước một chiếc xe hơi nhỏ và có nhịp đập nghe được từ xa.",
      "Tiếng gọi tần số thấp của cá voi xanh đạt cường độ hơn 180 dB, truyền đi hàng trăm kilômét dưới lòng đại dương.",
      "Mỗi ngày một con cá voi xanh trưởng thành có thể tiêu thụ tới 4 tấn sinh vật phù du và nhuyễn thể.",
    ],
    fallback_queries: ["Balaenoptera musculus"],
  },
  {
    code: "MAM-LC-0257",
    slug: "ca-heo-mui-chai",
    common_name: "Cá Heo Mũi Chai",
    common_name_en: "Common Bottlenose Dolphin",
    scientificName: "Tursiops truncatus",
    group_slug: "dong-vat-co-vu-bien",
    status_code: "LC",
    zone_id: 1,
    description:
      "Cá heo mũi chai (Tursiops truncatus) là loài thú biển nổi tiếng thông minh với chiếc mõm ngắn bo tròn như cổ chai và nụ cười thân thiện tự nhiên. Chúng sống theo bầy đàn xã hội chặt chẽ và sử dụng sóng định vị tiếng vang (echolocation) cực nhạy.",
    description_en:
      "The common bottlenose dolphin (Tursiops truncatus) is a highly social, intelligent marine mammal famed for coordinated pod hunting and precision acoustic echolocation.",
    diet: "Cá trích, cá nục, mực ống và tôm cá ven bờ",
    diet_en: "Herring, scads, squid, and schooling coastal fish",
    size_min_cm: 200,
    size_max_cm: 380,
    weight_min_kg: 150,
    weight_max_kg: 450,
    lifespan_years: 45,
    depth_min_m: 0,
    depth_max_m: 300,
    pressure_atm: 31.0,
    temperature_min_c: 12.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng mặt biển khơi và ven đảo",
    visibility_m: 20.0,
    dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "VU",
    vietnam_protection_group: "Nhóm IB - Bảo vệ thú biển Việt Nam",
    cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Bắc Bộ, vùng biển Côn Đảo, Phú Quốc, vịnh Vân Phong",
    local_distribution:
      "Thường bắt gặp bơi theo đàn gần tàu thuyền ở vùng biển Côn Đảo, Phú Quốc, Bình Thuận, Khánh Hòa và vịnh Bắc Bộ.",
    location_ids: [101, 103, 106, 108],
    facts: [
      "Mỗi cá thể cá heo mũi chai tự sáng tạo một 'tiếng huýt chữ ký' riêng biệt để đồng loại nhận ra nhau như tên gọi.",
      "Khi ngủ, chỉ một nửa bán cầu não nghỉ ngơi trong khi nửa còn lại giữ cho chúng nổi lên thở định kỳ và cảnh giác thiên địch.",
      "Đàn cá heo biết phối hợp vây tròn đàn cá trích thành quả cầu bạc rồi thay phiên lao vào săn mồi hiệu quả.",
    ],
    fallback_queries: ["Tursiops truncatus"],
  },
  {
    code: "INV-LC-0258",
    slug: "sen-bien-rong-xanh",
    common_name: "Sên Biển Rồng Xanh",
    common_name_en: "Blue Dragon Sea Slug",
    scientificName: "Glaucus atlanticus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description:
      "Sên biển rồng xanh (Glaucus atlanticus) là loài động vật thân mềm trôi nổi tuyệt đẹp với hình dáng như một chú rồng nhỏ màu xanh lam dạ quang. Chúng trôi ngửa bụng trên mặt nước biển nhờ bọt khí trong dạ dày và chuyên ăn sứa độc rồi tích trữ tế bào châm độc để tự vệ.",
    description_en:
      "The blue dragon (Glaucus atlanticus) is a pelagic aeolid nudibranch that floats upside down on the ocean surface tension, feeding on venomous siphonophores and incorporating their stinging nematocysts.",
    diet: "Sứa lửa biển, sứa chiến hạm Bồ Đào Nha, sứa mặt trăng",
    diet_en: "Physalia physalis, Porpita porpita, and pelagic jellyfish",
    size_min_cm: 2,
    size_max_cm: 4,
    weight_min_kg: 0.002,
    weight_max_kg: 0.005,
    lifespan_years: 1,
    depth_min_m: 0,
    depth_max_m: 5,
    pressure_atm: 1.5,
    temperature_min_c: 20.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng tầng mặt biển khơi (Neuston)",
    visibility_m: 20.0,
    dissolved_oxygen_mg_l: 6.8,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Sinh vật phù du chỉ thị dòng hải lưu",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng biển khơi Trung Bộ, Hoàng Sa, Trường Sa",
    local_distribution:
      "Trôi nổi theo các dòng hải lưu nước ấm ngoài khơi Đà Nẵng, Quảng Nam, Bình Thuận và hai quần đảo Hoàng Sa, Trường Sa.",
    location_ids: [104, 105, 102],
    facts: [
      "Chúng nuốt một bóng khí vào dạ dày để nổi ngược bụng lên mặt nước, tận dụng lực căng bề mặt đại dương.",
      "Màu xanh lam rực rỡ ở bụng giúp chúng ngụy trang hòa vào màu nước biển khi nhìn từ trên xuống, còn lưng bạc hòa vào bầu trời khi nhìn từ dưới lên.",
      "Không hề bị tổn thương bởi độc tố cực mạnh của sứa lửa, trái lại chúng còn hấp thụ nguyên vẹn các nang gai độc vào các đầu tua cerata của mình để chích lại kẻ thù.",
    ],
    fallback_queries: ["Glaucus atlanticus"],
  },
  {
    code: "INV-LC-0259",
    slug: "tom-tit-bay-mau",
    common_name: "Tôm Tít Bảy Màu",
    common_name_en: "Peacock Mantis Shrimp",
    scientificName: "Odontodactylus scyllarus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description:
      "Tôm tít bảy màu (Odontodactylus scyllarus) là kiệt tác sắc màu của rạn san hô Biển Đông với lớp vỏ xanh ngọc lục bảo pha đỏ cam rực rỡ. Chúng sở hữu cặp càng đập búa nhanh như đạn bắn với lực va chạm đủ làm vỡ vỏ cua, sò cứng nhất.",
    description_en:
      "The peacock mantis shrimp (Odontodactylus scyllarus) is a brilliantly colored coral-reef crustacean wielding spring-loaded raptorial clubs and the ocean's most complex eyes.",
    diet: "Ốc biển, cua rạn, trai sò và giáp xác nhỏ",
    diet_en: "Marine snails, reef crabs, bivalves, and small crustaceans",
    size_min_cm: 10,
    size_max_cm: 18,
    weight_min_kg: 0.05,
    weight_max_kg: 0.2,
    lifespan_years: 6,
    depth_min_m: 3,
    depth_max_m: 40,
    pressure_atm: 5.0,
    temperature_min_c: 23.0,
    temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh đến trung bình vùng đáy rạn",
    visibility_m: 15.0,
    dissolved_oxygen_mg_l: 6.3,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Loài đặc hữu rạn san hô nhiệt đới",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô Nha Trang, Cù Lao Chàm, Phú Quốc, Côn Đảo",
    local_distribution:
      "Làm hang hình chữ U trong nền cát sỏi gần chân rạn san hô tại Hòn Mun (Nha Trang), Phú Quốc, Côn Đảo và Cù Lao Chàm.",
    location_ids: [101, 102, 103, 106],
    facts: [
      "Mắt của tôm tít bảy màu có tới 12–16 loại tế bào thụ cảm màu sắc (con người chỉ có 3) và nhìn được cả ánh sáng phân cực tròn.",
      "Cú đấm của càng búa đạt vận tốc hơn 80 km/h, tạo ra bọt khí xâm thực phát sáng nhiệt độ tức thời lên tới hàng nghìn độ K.",
      "Từng cá thể bảo vệ hang ngầm rất kỹ và thường xếp vỏ sò, vụn san hô quanh miệng hang.",
    ],
    fallback_queries: ["Odontodactylus scyllarus"],
  },
  {
    code: "INV-LC-0260",
    slug: "tom-bac-si-van-do",
    common_name: "Tôm Bác Sĩ Vằn Đỏ",
    common_name_en: "Scarlet Skunk Cleaner Shrimp",
    scientificName: "Lysmata amboinensis",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description:
      "Tôm bác sĩ vằn đỏ (Lysmata amboinensis) là 'bác sĩ vệ sinh' nổi tiếng của các trạm làm sạch trên rạn san hô với râu dài trắng muốt và sọc đỏ trắng nổi bật dọc lưng. Chúng dũng cảm chui vào tận mang và miệng của các loài cá săn mồi lớn để gắp ký sinh trùng.",
    description_en:
      "The scarlet skunk cleaner shrimp (Lysmata amboinensis) runs underwater cleaning stations on coral reefs, removing parasites from the gills and mouths of large reef predators.",
    diet: "Ký sinh trùng ngoài da cá, mô chết và sinh vật phù du nhỏ",
    diet_en: "External fish parasites, dead tissue, and tiny planktonic particles",
    size_min_cm: 4,
    size_max_cm: 6,
    weight_min_kg: 0.005,
    weight_max_kg: 0.015,
    lifespan_years: 3,
    depth_min_m: 1,
    depth_max_m: 40,
    pressure_atm: 5.0,
    temperature_min_c: 24.0,
    temperature_max_c: 29.5,
    light_level: "Ánh sáng vừa trong khe rạn và hang san hô",
    visibility_m: 15.0,
    dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC",
    vietnam_protection_group: "Loài cộng sinh giữ cân bằng rạn san hô",
    cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, Trường Sa",
    local_distribution:
      "Sống thành đôi hoặc nhóm nhỏ trong các hốc đá san hô trên toàn bộ hệ thống rạn san hô Biển Đông.",
    location_ids: [101, 102, 103, 105],
    facts: [
      "Tôm bác sĩ vẫy đôi râu trắng dài như tín hiệu vẫy cờ để mời các loài cá lớn tới 'khám bệnh' tại trạm làm sạch.",
      "Ngay cả cá chình bông hung dữ hay cá mú khổng lồ cũng há miệng bất động cho tôm bác sĩ vào dọn răng mà không bao giờ ăn thịt bạn đồng minh này.",
      "Giúp giảm tới hơn 70% mật độ ký sinh trùng ngoài da cho quần thể cá rạn san hô xung quanh.",
    ],
    fallback_queries: ["Lysmata amboinensis"],
  },
];

async function getVerifiedSourceId(scientificName) {
  try {
    const wormsRes = await axios.get(
      `https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(
        scientificName,
      )}`,
      { timeout: 10000 },
    );
    const first = wormsRes?.data?.[0]?.[0];
    if (first?.valid_AphiaID || first?.AphiaID) {
      return `worms:${first.valid_AphiaID || first.AphiaID}`;
    }
  } catch {
    // fallback to GBIF
  }

  try {
    const gbifRes = await axios.get(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`,
      { timeout: 10000 },
    );
    if (gbifRes?.data?.usageKey) {
      return `gbif:${gbifRes.data.usageKey}`;
    }
  } catch {
    // ignore
  }

  return null;
}

async function isValidImageUrl(url) {
  try {
    const res = await axios.head(url, { timeout: 8000 });
    const ct = String(res.headers["content-type"] || "");
    return res.status >= 200 && res.status < 300 && ct.startsWith("image/");
  } catch {
    return false;
  }
}

function cleanTextForCheck(obs) {
  const tagText = Array.isArray(obs.tags) ? obs.tags.join(" ") : "";
  return `${obs.description || ""} ${tagText} ${obs.place_guess || ""}`.toLowerCase();
}

async function crawlDiverPhotos(scientificName, commonNameVi) {
  const url = "https://api.inaturalist.org/v1/observations";
  const res = await axios.get(url, {
    params: {
      taxon_name: scientificName,
      quality_grade: "research",
      captive: "false",
      photos: "true",
      per_page: 45,
      order_by: "votes",
    },
    timeout: 15000,
    headers: { "User-Agent": "PacificMarineEncyclopedia/1.0" },
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

    // Prefer landscape / wide underwater shots (width >= height when metadata available)
    const candidatePhoto =
      obsPhotos.find(
        (p) =>
          p.original_dimensions &&
          p.original_dimensions.width >= p.original_dimensions.height,
      ) || obsPhotos[0];

    if (!candidatePhoto?.url || usedPhotoIds.has(candidatePhoto.id)) continue;

    // Prioritize diverse photographers first, fall back to same user if needed
    const userId = obs.user?.id;
    if (userId && usedUsers.has(userId) && chosen.length < 3 && results.length > 10) {
      continue;
    }

    const largeUrl = candidatePhoto.url
      .replace("/square.", "/large.")
      .replace("/medium.", "/large.")
      .replace("/small.", "/large.");

    const ok = await isValidImageUrl(largeUrl);
    if (!ok) continue;

    usedPhotoIds.add(candidatePhoto.id);
    if (userId) usedUsers.add(userId);

    const photographer = obs.user?.name || obs.user?.login || "iNaturalist Observer";
    chosen.push({
      url: largeUrl,
      caption: `${commonNameVi} (${scientificName}) trong môi trường biển tự nhiên — ảnh: ${photographer}`,
      is_primary: chosen.length === 0,
    });
  }

  // Second pass without photographer diversity restriction if fewer than 4
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
        const ok = await isValidImageUrl(largeUrl);
        if (!ok) continue;

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

  return chosen;
}

async function run() {
  console.log("🌊 Bắt đầu cào & nạp 10 loài sinh vật biển mới + Mạng lưới sinh thái...");

  // Đồng bộ PostgreSQL serial sequence tránh lỗi P2002 (id out-of-sync)
  for (const tbl of [
    "species",
    "species_media",
    "species_facts",
    "species_translations",
    "species_relationships",
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), true);`,
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

  const insertedSpeciesMap = new Map();

  for (const sp of TEN_SPECIES) {
    console.log(`\n🔎 Đang cào dữ liệu thật cho: ${sp.common_name} (${sp.scientificName})...`);

    const [sourceApiId, mediaList] = await Promise.all([
      getVerifiedSourceId(sp.scientificName),
      crawlDiverPhotos(sp.scientificName, sp.common_name),
    ]);

    if (mediaList.length < 3) {
      throw new Error(
        `Loài ${sp.common_name} chỉ lấy được ${mediaList.length} ảnh hợp lệ, dừng để kiểm tra!`,
      );
    }

    console.log(
      `   ✅ Taxonomy: ${sourceApiId || "local"} | Ảnh dưới nước: ${mediaList.length} ảnh`,
    );

    const groupId = groupBySlug.get(sp.group_slug);
    const statusId = statusByCode.get(sp.status_code);
    if (!groupId || !statusId) {
      throw new Error(`Thiếu group_id hoặc status_id cho ${sp.common_name}`);
    }

    // Kiểm tra xem đã tồn tại theo slug/scientificName/code chưa để upsert sạch
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
      group_id: groupId,
      conservation_status_id: statusId,
      ocean_zone_id: sp.zone_id,
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
      ? await prisma.species.update({
          where: { id: existing.id },
          data: speciesData,
        })
      : await prisma.species.create({
          data: speciesData,
        });

    insertedSpeciesMap.set(sp.slug, saved);

    // 1) Cập nhật 4 ảnh thật dưới nước vào species_media
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

    // 2) Nạp species_facts (3 sự thật thú vị)
    await prisma.species_facts.deleteMany({ where: { species_id: saved.id } });
    await prisma.species_facts.createMany({
      data: sp.facts.map((content, idx) => ({
        species_id: saved.id,
        content,
        sort_order: idx + 1,
      })),
    });

    // 3) Nạp species_translations (VI + EN)
    if (langCodes.has("vi")) {
      await prisma.species_translations.upsert({
        where: {
          species_id_language_code: {
            species_id: saved.id,
            language_code: "vi",
          },
        },
        update: {
          common_name: sp.common_name,
          description: sp.description,
          diet: sp.diet,
        },
        create: {
          species_id: saved.id,
          language_code: "vi",
          common_name: sp.common_name,
          description: sp.description,
          diet: sp.diet,
        },
      });
    }
    if (langCodes.has("en")) {
      await prisma.species_translations.upsert({
        where: {
          species_id_language_code: {
            species_id: saved.id,
            language_code: "en",
          },
        },
        update: {
          common_name: sp.common_name_en,
          description: sp.description_en,
          diet: sp.diet_en,
        },
        create: {
          species_id: saved.id,
          language_code: "en",
          common_name: sp.common_name_en,
          description: sp.description_en,
          diet: sp.diet_en,
        },
      });
    }

    // 4) Gắn các khu bảo tồn biển vào species_locations
    const locLinks = sp.location_ids.filter((lid) => validLocIds.has(lid));
    for (const lid of locLinks) {
      await prisma.species_locations.upsert({
        where: {
          species_id_location_id: {
            species_id: saved.id,
            location_id: BigInt(lid),
          },
        },
        update: {},
        create: {
          species_id: saved.id,
          location_id: BigInt(lid),
        },
      });
    }
  }

  // 5) Xây dựng Mạng lưới sinh thái & Chuỗi thức ăn (species_relationships)
  console.log("\n🕸️  Đang thiết lập Mạng lưới sinh thái & Chuỗi thức ăn cho 10 loài...");

  const allSpecies = await prisma.species.findMany({
    select: { id: true, slug: true, common_name: true },
  });
  const bySlug = new Map(allSpecies.map((s) => [s.slug, s]));

  // Định nghĩa các mối quan hệ chuẩn theo ROLE_MAP trong ecosystemService.js:
  // - predator_prey / herbivory: source = kẻ săn / ăn, target = con mồi / thực vật
  // - symbiosis / commensalism / competitor: hai chiều cùng nhóm
  // - habitat_provider: source = loài tạo sinh cảnh, target = loài cư trú
  const RELATIONSHIPS = [
    // --- Cá Mập Hổ (đỉnh chuỗi thức ăn) ---
    {
      src: "ca-map-ho-tiger-shark",
      tgt: "rua-xanh-vich",
      type: "predator_prey",
      desc: "Cá mập hổ là thiên địch lớn nhất săn rùa xanh trưởng thành nhờ hàm răng răng cưa có thể cắn vỡ mai rùa.",
      impact: "Kiểm soát mật độ và chọn lọc cá thể khỏe mạnh trong quần thể rùa biển.",
      strength: 0.92,
    },
    {
      src: "ca-map-ho-tiger-shark",
      tgt: "vich-bien-dong",
      type: "predator_prey",
      desc: "Cá mập hổ săn bắt rùa Quản Đồng trên các bãi kiếm ăn ven rạn và vùng biển khơi.",
      impact: "Điều hòa phân bố không gian của rùa biển quanh các bãi cỏ biển.",
      strength: 0.88,
    },
    {
      src: "ca-map-ho-tiger-shark",
      tgt: "ca-duoi-o-hoa",
      type: "predator_prey",
      desc: "Cá đuối ó hoa là nguồn con mồi ưa thích của cá mập hổ gần mép rạn san hô.",
      impact: "Duy trì cân bằng số lượng các loài cá đuối tầng đáy.",
      strength: 0.85,
    },
    {
      src: "ca-map-ho-tiger-shark",
      tgt: "ca-duoi-dom-xanh",
      type: "predator_prey",
      desc: "Cá mập hổ tuần tra rạn nông vào ban đêm để săn các loài cá đuối rạn như cá đuối đốm xanh.",
      impact: "Kiểm soát quần thể cá đuối nhỏ tầng đáy rạn.",
      strength: 0.8,
    },
    {
      src: "ca-map-ho-tiger-shark",
      tgt: "great-white-shark-1",
      type: "competitor",
      desc: "Hai loài cá mập đỉnh cao cạnh tranh nguồn con mồi lớn (rùa biển, thú biển, cá ngừ) tại vùng chuyển tiếp nước sâu.",
      impact: "Phân chia lãnh thổ săn mồi giữa vùng nhiệt đới và cận nhiệt đới.",
      strength: 0.78,
    },

    // --- Cá Đuối Đốm Xanh ---
    {
      src: "ca-duoi-dom-xanh",
      tgt: "tom-tich-trang",
      type: "predator_prey",
      desc: "Cá đuối đốm xanh dùng đĩa thân khuấy cát săn tôm tít và giáp xác nhỏ vùi mình dưới đáy.",
      impact: "Giúp xáo trộn oxy cho lớp trầm tích đáy cát quanh rạn san hô.",
      strength: 0.85,
    },
    {
      src: "ca-duoi-dom-xanh",
      tgt: "cua-nhen-ran",
      type: "predator_prey",
      desc: "Răng nghiền phẳng của cá đuối đốm xanh chuyên nghiền nát mai cua nhỏ sống quanh rạn.",
      impact: "Giữ cân bằng quần thể động vật giáp xác tầng đáy.",
      strength: 0.82,
    },
    {
      src: "ca-nham-bua-dau-bua",
      tgt: "ca-duoi-dom-xanh",
      type: "predator_prey",
      desc: "Cá nhám búa dùng cơ quan cảm ứng điện từ trên búa đầu định vị cá đuối đốm xanh ẩn dưới cát.",
      impact: "Thiên địch tự nhiên chủ yếu kiểm soát số lượng cá đuối rạn.",
      strength: 0.9,
    },
    {
      src: "san-ho-canh-acropora",
      tgt: "ca-duoi-dom-xanh",
      type: "habitat_provider",
      desc: "Các tán san hô cành tạo gờ hang bóng râm an toàn cho cá đuối đốm xanh trú ẩn vào ban ngày.",
      impact: "Cung cấp nơi tránh kẻ săn mồi tối quan trọng cho cá đuối rạn.",
      strength: 0.88,
    },

    // --- Cá Song Chấm Xanh ---
    {
      src: "ca-song-cham-xanh",
      tgt: "ca-thia-san-ho-xanh",
      type: "predator_prey",
      desc: "Cá song chấm xanh phục kích săn bắt các đàn cá thia xanh bơi quanh nhánh san hô.",
      impact: "Điều tiết mật độ cá rạn cỡ nhỏ trên sườn dốc san hô.",
      strength: 0.9,
    },
    {
      src: "ca-song-cham-xanh",
      tgt: "muc-coc-san-ho",
      type: "predator_prey",
      desc: "Cá song chấm xanh tấn công chớp nhoáng mực cóc và mực nang nhỏ kiếm ăn ban ngày.",
      impact: "Là mắt xích săn mồi bậc trung cốt lõi trên rạn san hô.",
      strength: 0.85,
    },
    {
      src: "ca-song-cham-xanh",
      tgt: "ca-chinh-bong-khong-lo",
      type: "symbiosis",
      desc: "Cá song chấm xanh lắc đầu gọi hiệu và phối hợp cùng cá chình bông lùa cá nhỏ từ hai đầu khe đá san hô.",
      impact: "Ví dụ hiếm có về hợp tác săn mồi liên loài làm tăng tỷ lệ thành công gấp nhiều lần.",
      strength: 0.95,
    },
    {
      src: "tom-bac-si-van-do",
      tgt: "ca-song-cham-xanh",
      type: "symbiosis",
      desc: "Tôm bác sĩ vằn đỏ chui vào mang và khoang miệng cá song chấm xanh để dọn sạch ký sinh trùng và mô chết.",
      impact: "Giúp cá song khỏe mạnh, lành vết thương nhanh và giảm tỷ lệ nhiễm bệnh.",
      strength: 0.94,
    },

    // --- Cá Bò Picasso ---
    {
      src: "ca-bo-picasso",
      tgt: "cau-gai-bo-duc",
      type: "predator_prey",
      desc: "Cá bò Picasso thổi tia nước lật ngửa cầu gai bồ dục rồi dùng hàm răng khỏe cắn vỡ vỏ đá.",
      impact: "Kiểm soát mật độ cầu gai, ngăn chặn cầu gai gặm xói mòn nền san hô chết.",
      strength: 0.92,
    },
    {
      src: "ca-bo-picasso",
      tgt: "rong-duoi-cong",
      type: "herbivory",
      desc: "Cá bò Picasso gặm các mảng rong đuôi công và tảo bám quanh đầm phá rạn nông.",
      impact: "Giữ bề mặt nền cứng sạch tảo cho san hô non phát triển.",
      strength: 0.78,
    },
    {
      src: "ca-khe-khong-lo",
      tgt: "ca-bo-picasso",
      type: "predator_prey",
      desc: "Cá khế khổng lồ tuần tra mép đầm phá săn bắt cá bò Picasso khi chúng bơi rời xa khe đá san hô.",
      impact: "Thúc đẩy tập tính cảnh giác và phụ thuộc vào rạn san hô của cá bò.",
      strength: 0.75,
    },
    {
      src: "san-ho-nao",
      tgt: "ca-bo-picasso",
      type: "habitat_provider",
      desc: "Các khe nứt trên khối san hô não là ổ ngủ ban đêm nơi cá bò Picasso khóa gai lưng tự vệ.",
      impact: "Bảo vệ cá bò khỏi các loài săn mồi ban đêm như cá chình và cá mập.",
      strength: 0.9,
    },

    // --- Cá Khế Khổng Lồ ---
    {
      src: "ca-khe-khong-lo",
      tgt: "ca-chuon-canh-xanh",
      type: "predator_prey",
      desc: "Cá khế khổng lồ bứt tốc lao vút săn đàn cá chuồn gần mặt nước ngoài khơi.",
      impact: "Kiểm soát đàn cá nổi cỡ nhỏ và trung bình quanh vùng đảo.",
      strength: 0.9,
    },
    {
      src: "ca-khe-khong-lo",
      tgt: "muc-la-dai-duong",
      type: "predator_prey",
      desc: "Săn bắt mực lá đại dương bơi theo đàn vào ban đêm và bình minh gần rạn san hô.",
      impact: "Mắt xích chuyển năng lượng từ động vật chân đầu lên tầng săn mồi đỉnh.",
      strength: 0.88,
    },
    {
      src: "ca-khe-khong-lo",
      tgt: "bach-tuoc-dua",
      type: "predator_prey",
      desc: "Tấn công nhanh các loài bạch tuộc đáy cát khi chúng rời vỏ dừa đi kiếm ăn.",
      impact: "Giữ cân bằng quần thể động vật thân mềm đáy cát ven rạn.",
      strength: 0.8,
    },
    {
      src: "ca-map-san-ho-vay-den",
      tgt: "ca-khe-khong-lo",
      type: "competitor",
      desc: "Cùng săn các đàn cá nổi và cá rạn cỡ trung ở khu vực rạn ngoài khơi có dòng chảy mạnh.",
      impact: "Tạo áp lực chọn lọc tự nhiên lên tốc độ và tập tính bầy đàn của cá mồi.",
      strength: 0.82,
    },

    // --- Cá Voi Xanh ---
    {
      src: "ca-voi-xanh",
      tgt: "sinh-vat-phu-du-bien-dong",
      type: "predator_prey",
      desc: "Cá voi xanh há miệng khổng lồ lọc hàng tấn nhuyễn thể và sinh vật phù du trong một lần lặn kiếm ăn.",
      impact: "Đóng góp 'bơm cá voi' tái phân phối đạm, sắt giúp sinh vật phù du tầng mặt phát triển mạnh và hấp thụ CO2.",
      strength: 1.0,
    },
    {
      src: "ca-voi-sat-thu",
      tgt: "ca-voi-xanh",
      type: "predator_prey",
      desc: "Đàn cá voi sát thủ đôi khi phối hợp vây đuổi tấn công cá voi xanh non hoặc cá thể yếu trong mùa di cư.",
      impact: "Thiên địch tự nhiên duy nhất của loài động vật lớn nhất hành tinh.",
      strength: 0.72,
    },
    {
      src: "ca-voi-xanh",
      tgt: "ca-voi-lung-gu",
      type: "competitor",
      desc: "Cạnh tranh gián tiếp nguồn sinh vật phù du và nhuyễn thể dày đặc trên các tuyến di cư đại dương.",
      impact: "Thúc đẩy sự phân tầng độ sâu kiếm ăn khác nhau giữa các loài cá voi tấm sừng.",
      strength: 0.7,
    },

    // --- Cá Heo Mũi Chai ---
    {
      src: "ca-heo-mui-chai",
      tgt: "ca-trich-mai",
      type: "predator_prey",
      desc: "Đàn cá heo mũi chai phối hợp dồn đàn cá trích mai thành khối cầu rồi thay phiên lao vào săn mồi.",
      impact: "Điều hòa mật độ các đàn cá nổi nhỏ ven bờ.",
      strength: 0.94,
    },
    {
      src: "ca-heo-mui-chai",
      tgt: "ca-nuc-so",
      type: "predator_prey",
      desc: "Dùng sóng siêu âm echolocation định vị và săn đàn cá nục sồ ở tầng nước nông và trung.",
      impact: "Duy trì sức khỏe nguồn cá nổi bằng cách loại bỏ cá thể chậm chạp.",
      strength: 0.9,
    },
    {
      src: "ca-heo-mui-chai",
      tgt: "muc-la-dai-duong",
      type: "predator_prey",
      desc: "Mực lá đại dương là nguồn dinh dưỡng giàu đạm quan trọng của cá heo mũi chai ngoài khơi.",
      impact: "Ổn định cân bằng giữa thú biển và nhóm động vật chân đầu.",
      strength: 0.86,
    },
    {
      src: "ca-heo-mui-chai",
      tgt: "ca-ngu-vay-vang-dai-duong",
      type: "competitor",
      desc: "Thường cùng xuất hiện săn chung đàn cá trích và cá nục ở vùng nước khơi giàu sinh vật phù du.",
      impact: "Phân chia vùng săn theo nhóm giúp tối ưu khai thác nguồn cá nổi.",
      strength: 0.76,
    },

    // --- Rùa Quản Đồng (vich-bien-dong) ---
    {
      src: "vich-bien-dong",
      tgt: "sua-mat-trang",
      type: "predator_prey",
      desc: "Rùa Quản Đồng di cư thường xuyên bơi qua tầng mặt để ăn sứa mặt trăng trôi nổi.",
      impact: "Kiểm soát hiện tượng bùng phát sứa biển trên đại dương.",
      strength: 0.88,
    },
    {
      src: "vich-bien-dong",
      tgt: "cau-gai-bo-duc",
      type: "predator_prey",
      desc: "Bộ hàm cực khỏe của rùa Quản Đồng dễ dàng nghiền nát lớp vỏ đá gai nhọn của cầu gai.",
      impact: "Giúp cân bằng thảm rong tảo và cấu trúc đáy rạn.",
      strength: 0.85,
    },
    {
      src: "vich-bien-dong",
      tgt: "cua-huynh-de",
      type: "predator_prey",
      desc: "Kiếm ăn trên nền cát biển sâu vừa để săn các loài cua giáp xác vỏ cứng.",
      impact: "Tạo xáo trộn sinh học giúp thông khí trầm tích đáy biển.",
      strength: 0.8,
    },
    {
      src: "vich-bien-dong",
      tgt: "oc-vu-nang",
      type: "commensalism",
      desc: "Các loài ốc nhỏ và sinh vật bám sống hội sinh trên mai rùa Quản Đồng để di chuyển tới vùng nước giàu thức ăn hơn.",
      impact: "Mai rùa trở thành 'ốc đảo di động' lan tỏa đa dạng sinh học đại dương.",
      strength: 0.78,
    },

    // --- Sên Biển Rồng Xanh ---
    {
      src: "sen-bien-rong-xanh",
      tgt: "sua-lua-bien-dong",
      type: "predator_prey",
      desc: "Sên biển rồng xanh săn sứa lửa biển và hấp thụ các tế bào châm độc nematocysts vào đầu xúc tu để tự vệ.",
      impact: "Khống chế số lượng sứa biển độc trôi nổi tầng mặt.",
      strength: 0.95,
    },
    {
      src: "sen-bien-rong-xanh",
      tgt: "sua-mat-trang",
      type: "predator_prey",
      desc: "Bơi ngửa bụng áp sát mặt nước để rỉa ăn các loài sứa trôi nổi theo dòng hải lưu.",
      impact: "Chuyển hóa năng lượng từ động vật trôi nổi tầng mặt.",
      strength: 0.9,
    },
    {
      src: "sen-bien-rong-xanh",
      tgt: "sinh-vat-phu-du-bien-dong",
      type: "commensalism",
      desc: "Sên biển rồng xanh trôi nổi tự do trong cộng đồng sinh vật phù du tầng mặt neuston.",
      impact: "Là loài chỉ thị chuyển dịch dòng hải lưu ấm ngoài khơi.",
      strength: 0.85,
    },

    // --- Tôm Tít Bảy Màu ---
    {
      src: "tom-tit-bay-mau",
      tgt: "oc-ban-tay",
      type: "predator_prey",
      desc: "Tôm tít bảy màu dùng càng búa đập vỡ lớp vỏ dày của các loài ốc rạn san hô.",
      impact: "Kiểm soát số lượng ốc ăn tảo và giáp xác có vỏ cứng trên rạn.",
      strength: 0.9,
    },
    {
      src: "tom-tit-bay-mau",
      tgt: "cua-nhen-ran",
      type: "predator_prey",
      desc: "Rình mồi từ miệng hang cát để tung cú đập sấm sét săn cua nhện và giáp xác nhỏ.",
      impact: "Giữ cân bằng hệ động vật đáy không xương sống.",
      strength: 0.86,
    },
    {
      src: "ca-su-tu-do-mao-tien",
      tgt: "tom-tit-bay-mau",
      type: "predator_prey",
      desc: "Cá sư tử đỏ săn tôm tít bảy màu non vào lúc chạng vạng khi tôm rời hang đi kiếm mồi.",
      impact: "Giới hạn sự phát tán mật độ tôm tít ở vùng rạn cạn.",
      strength: 0.78,
    },
    {
      src: "san-ho-canh-acropora",
      tgt: "tom-tit-bay-mau",
      type: "habitat_provider",
      desc: "Chân rạn san hô cành và nền vụn san hô cung cấp kết cấu bền vững để tôm tít đào hang chữ U.",
      impact: "Bảo tồn nơi cư trú ổn định cho các loài giáp xác đáy rạn.",
      strength: 0.88,
    },

    // --- Tôm Bác Sĩ Vằn Đỏ ---
    {
      src: "tom-bac-si-van-do",
      tgt: "ca-mu-nghe",
      type: "symbiosis",
      desc: "Cá mú nghệ khổng lồ thường ghé trạm vệ sinh để tôm bác sĩ vằn đỏ làm sạch ký sinh trùng quanh mang và răng.",
      impact: "Tăng tuổi thọ và giảm stress bệnh tật cho loài cá rạn kích thước lớn.",
      strength: 0.96,
    },
    {
      src: "tom-bac-si-van-do",
      tgt: "ca-chinh-bong-khong-lo",
      type: "symbiosis",
      desc: "Tôm bác sĩ dọn sạch ký sinh trùng bám trên da trần và hàm răng sắc của cá chình bông khổng lồ.",
      impact: "Mối quan hệ hợp tác làm sạch đặc trưng tại các hang rạn san hô.",
      strength: 0.95,
    },
    {
      src: "tom-bac-si-van-do",
      tgt: "ca-map-san-ho-vay-trang",
      type: "symbiosis",
      desc: "Cá mập san hô vây trắng nằm yên trên đáy cát hoặc bơi chậm qua trạm vệ sinh để tôm bác sĩ loại bỏ giáp xác ký sinh.",
      impact: "Duy trì sức khỏe cho nhóm cá mập rạn đầu bảng.",
      strength: 0.9,
    },
    {
      src: "hai-quy-khong-lo",
      tgt: "tom-bac-si-van-do",
      type: "habitat_provider",
      desc: "Tôm bác sĩ thường lập trạm làm sạch ngay cạnh gốc hải quỳ khổng lồ hoặc khe san hô để vừa thu hút cá khách vừa tránh kẻ thù.",
      impact: "Tạo điểm nút tương tác sinh thái tập trung trên rạn san hô.",
      strength: 0.87,
    },
  ];

  let relInserted = 0;
  for (const rel of RELATIONSHIPS) {
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

  // 6) Đồng bộ vector embeddings nếu có GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    console.log("\n🧠 Đang đồng bộ vector embeddings cho tìm kiếm ngữ nghĩa...");
    try {
      await vectorSearchService.syncAllSpeciesEmbeddings();
      console.log("   ✅ Đã đồng bộ xong embeddings!");
    } catch (err) {
      console.warn("   ⚠️ Đồng bộ embeddings gặp lỗi nhẹ (không ảnh hưởng DB chính):", err.message);
    }
  }

  const totalSpecies = await prisma.species.count();
  const totalRel = await prisma.species_relationships.count();
  console.log(`\n🎉 HOÀN TẤT! Tổng sinh vật hiện có: ${totalSpecies} | Tổng liên kết sinh thái: ${totalRel}`);
}

run()
  .catch((err) => {
    console.error("❌ Lỗi:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
