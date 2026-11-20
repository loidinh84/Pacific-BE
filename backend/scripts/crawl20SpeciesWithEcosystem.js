import axios from "axios";
import https from "https";
import prisma from "../src/lib/prisma.js";
import vectorSearchService from "../src/services/vectorSearchService.js";

const BANNED_PHOTO_TERMS = [
  "dead", "deceased", "washed up", "stranded", "beached", "market", "fish market",
  "aquarium", "captive", "tank", "zoo", "specimen", "preserved", "museum",
  "fishing", "hooked", "caught", "trawl", "plate", "cooked", "food", "dried",
  "skeleton", "skull", "jaw", "shell only", "dissected", "necropsy",
];

const TWENTY_SPECIES = [
  // 1. Cá Mập Đầu Búa Lớn
  {
    code: "FSH-CR-0261",
    slug: "ca-map-dau-bua-lon",
    common_name: "Cá Mập Đầu Búa Lớn",
    common_name_en: "Great Hammerhead",
    scientificName: "Sphyrna mokarran",
    group_slug: "ca-bien",
    status_code: "CR",
    zone_id: 1,
    description: "Cá mập đầu búa lớn (Sphyrna mokarran) là loài cá mập búa lớn nhất thế giới với chiều dài vượt 6 mét và vây lưng thứ nhất dựng đứng hình lưỡi liềm khổng lồ. Chiếc đầu búa rộng giúp mở rộng trường cảm ứng điện từ và dùng làm đòn bẩy ghim chặt các loài cá đuối độc xuống đáy biển.",
    description_en: "The great hammerhead (Sphyrna mokarran) is the largest hammerhead shark species, renowned for its immense curved first dorsal fin and wide cephalofoil used to pin stingrays to the sea floor.",
    diet: "Cá đuối, cá mập nhỏ, cá xương biển khơi, mực và cua",
    diet_en: "Stingrays, smaller sharks, pelagic bony fish, squid, and crabs",
    size_min_cm: 350, size_max_cm: 610, weight_min_kg: 230, weight_max_kg: 500, lifespan_years: 44,
    depth_min_m: 1, depth_max_m: 300, pressure_atm: 31.0, temperature_min_c: 20.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh đến vừa tầng mặt và thềm lục địa", visibility_m: 25.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "CR", vietnam_protection_group: "Nhóm I - Cực kỳ nguy cấp, cấm đánh bắt", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vùng biển khơi xa bờ Trường Sa, Hoàng Sa, Bình Thuận",
    local_distribution: "Tuần tra các bãi rạn dốc ngoài khơi Trường Sa, Hoàng Sa và vùng biển nước sâu Nam Trung Bộ.",
    location_ids: [104, 105, 101],
    facts: [
      "Chiếc đầu hình búa (cephalofoil) chứa mạng lưới Ampullae of Lorenzini dày đặc, có thể cảm nhận nhịp tim của cá đuối vùi sâu dưới cát.",
      "Vây lưng thứ nhất của cá mập đầu búa lớn có thể cao tới gần 1 mét, cao nhất trong tất cả các loài cá mập.",
      "Chúng có khả năng miễn nhiễm đặc biệt với nọc độc từ gai đuôi của các loài cá đuối độc mà chúng săn bắt.",
    ],
  },
  // 2. Cá Mập Báo (Cá Nhám Báo)
  {
    code: "FSH-EN-0262",
    slug: "ca-nham-bao",
    common_name: "Cá Nhám Báo",
    common_name_en: "Zebra Shark (Leopard Shark)",
    scientificName: "Stegostoma tigrinum",
    group_slug: "ca-bien",
    status_code: "EN",
    zone_id: 1,
    description: "Cá nhám báo (Stegostoma tigrinum) là loài cá mập rạn san hô tuyệt đẹp với vây đuôi dài bằng nửa chiều dài cơ thể và lớp da vàng phủ đầy đốm đen giống báo gấm. Ban ngày chúng nằm nghỉ thanh bình trên đáy cát gần chân rạn san hô.",
    description_en: "The zebra shark (Stegostoma tigrinum) is a docile reef shark with a tail fin as long as the rest of its body and striking leopard-like spots covering its golden-brown dorsal surface.",
    diet: "Động vật thân mềm có vỏ, giáp xác, cá rạn nhỏ và giun biển",
    diet_en: "Shelled mollusks, crustaceans, small reef fishes, and sea snakes",
    size_min_cm: 180, size_max_cm: 250, weight_min_kg: 20, weight_max_kg: 35, lifespan_years: 30,
    depth_min_m: 0, depth_max_m: 70, pressure_atm: 8.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng rạn nông và bãi cát", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "EN", vietnam_protection_group: "Nhóm II - Loài rạn san hô nguy cấp", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô Nha Trang, Côn Đảo, Cù Lao Chàm, Phú Quốc",
    local_distribution: "Thường nằm nghỉ trên nền cát phẳng quanh các rạn san hô Hòn Mun (Nha Trang), Côn Đảo và đảo Nam Yết (Trường Sa).",
    location_ids: [101, 102, 103, 105],
    facts: [
      "Khi mới sinh chúng có sọc vằn đen trắng như ngựa vằn, khi trưởng thành các sọc vỡ ra thành từng đốm tròn tựa báo đốm.",
      "Vây đuôi cực kỳ linh hoạt và chiếm gần một nửa tổng chiều dài cơ thể giúp chúng luồn lách vào các hang san hô hẹp tìm mồi.",
      "Khác với cá mập trắng phải bơi liên tục, cá nhám báo có thể chủ động bơm nước qua khe mang để hô hấp trong khi nằm yên trên đáy biển.",
    ],
  },
  // 3. Cá Đuối Ó Đại Bàng
  {
    code: "FSH-VU-0263",
    slug: "ca-duoi-o-dai-bang",
    common_name: "Cá Đuối Ó Đại Bàng",
    common_name_en: "Ocellated Eagle Ray",
    scientificName: "Aetobatus ocellatus",
    group_slug: "ca-bien",
    status_code: "VU",
    zone_id: 1,
    description: "Cá đuối ó đại bàng (Aetobatus ocellatus) là một trong những loài cá đuối duyên dáng nhất đại dương với hai cánh vây ngực nhọn vút và hoa văn vòng trắng tròn phủ kín lưng đen tuyền. Chúng thường bơi thành đàn lớn lượn trên mặt rạn san hô như đàn chim bay trên bầu trời.",
    description_en: "The ocellated eagle ray (Aetobatus ocellatus) is a pelagic stingray characterized by a dark dorsal disc covered in white rings and duckbill-like snout used to dig for mollusks.",
    diet: "Nghêu sò, ốc rạn san hô, cua, tôm và giun biển",
    diet_en: "Clams, reef snails, crabs, shrimp, and polychaetes",
    size_min_cm: 120, size_max_cm: 300, weight_min_kg: 50, weight_max_kg: 180, lifespan_years: 25,
    depth_min_m: 1, depth_max_m: 80, pressure_atm: 9.0, temperature_min_c: 22.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng mặt và nước biển ven đảo", visibility_m: 22.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "VU", vietnam_protection_group: "Cần kiểm soát bảo vệ sinh cảnh di cư", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, quần đảo Trường Sa, Hoàng Sa",
    local_distribution: "Bơi thành đàn lướt trên các thảm san hô ngoài khơi vịnh Nha Trang, Côn Đảo và các đảo san hô Trường Sa.",
    location_ids: [101, 103, 104, 105],
    facts: [
      "Chiếc mõm nhô dài tựa mỏ vịt giúp chúng đào sâu vào lớp cát đáy để tìm các loài ốc và sò ẩn nấp.",
      "Hàm răng gồm các phiến dẹt xếp khít như đá lát đường, tạo lực nghiền nát tan vỏ sò cứng nhất.",
      "Chúng có tập tính nhảy vọt lên khỏi mặt nước cao tới 2-3 mét rồi đập mạnh thân xuống để giao tiếp hoặc rũ bỏ ký sinh trùng.",
    ],
  },
  // 4. Cá Đuối Điện Thái Bình Dương
  {
    code: "FSH-LC-0264",
    slug: "ca-duoi-dien-thai-binh-duong",
    common_name: "Cá Đuối Điện Thái Bình Dương",
    common_name_en: "Pacific Electric Ray",
    scientificName: "Torpedo californica",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 2,
    description: "Cá đuối điện Thái Bình Dương (Torpedo californica) có đĩa thân tròn trịa màu xám tro nhẵn bóng và vây đuôi mập mạp. Hai cơ quan phát điện thận lớn hai bên đầu có khả năng phóng ra dòng điện thế lên tới 45 vôn để làm tê liệt cá mồi và xua đuổi kẻ săn mồi.",
    description_en: "The Pacific electric ray (Torpedo californica) can generate strong electrical discharges up to 45 volts from kidney-shaped electrogenic organs to stun prey and deter predators.",
    diet: "Cá hồi, cá trích, cá bơn, mực và giáp xác biển sâu",
    diet_en: "Herring, flatfish, small schooling fish, and squid",
    size_min_cm: 60, size_max_cm: 140, weight_min_kg: 10, weight_max_kg: 40, lifespan_years: 16,
    depth_min_m: 10, depth_max_m: 420, pressure_atm: 43.0, temperature_min_c: 10.0, temperature_max_c: 20.0,
    light_level: "Ánh sáng yếu tầng trung biển sâu (Mesopelagic)", visibility_m: 12.0, dissolved_oxygen_mg_l: 5.8,
    vietnam_red_list_status: "DD", vietnam_protection_group: "Sinh vật nghiên cứu điện sinh học", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng thềm lục địa sâu Tây Thái Bình Dương và Biển Đông",
    local_distribution: "Phân bố ở các sườn thềm lục địa cát bùn sâu ngoài khơi vùng biển Nam Trung Bộ.",
    location_ids: [105, 5],
    facts: [
      "Mỗi cơ quan phát điện chứa hàng ngàn cột tế bào điện bào tử (electrocytes) hoạt động giống như các cục pin mắc nối tiếp.",
      "Chúng săn mồi bằng cách bơi ôm trọn con mồi vào đĩa thân rồi phóng luồng điện làm con mồi bất tỉnh trước khi nuốt chửng.",
      "Người La Mã cổ đại từng dùng cá đuối điện để giật nhẹ vào đầu giúp chữa đau nửa đầu — tiền thân của liệu pháp sốc điện y học.",
    ],
  },
  // 5. Cá Mặt Quỷ San Hô
  {
    code: "FSH-LC-0265",
    slug: "ca-mat-quy-san-ho",
    common_name: "Cá Mặt Quỷ San Hô",
    common_name_en: "Reef Stonefish",
    scientificName: "Synanceia verrucosa",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá mặt quỷ san hô (Synanceia verrucosa) là loài cá có nọc độc chết người nguy hiểm nhất thế giới. Lớp da sần sùi phủ đầy tảo và rêu giúp chúng ngụy trang giống hệt một hòn đá san hô chết, phục kích đớp trọn con mồi chỉ trong 0.015 giây.",
    description_en: "The reef stonefish (Synanceia verrucosa) is the most venomous fish in the world, with cryptic stone-like camouflage and 13 dorsal spines capable of delivering excruciating, lethal venom.",
    diet: "Cá rạn nhỏ, tôm, cua và giáp xác",
    diet_en: "Small reef fish, shrimp, crabs, and other crustaceans",
    size_min_cm: 25, size_max_cm: 40, weight_min_kg: 1.0, weight_max_kg: 2.5, lifespan_years: 15,
    depth_min_m: 0, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 23.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh tầng rạn nông ven bờ", visibility_m: 15.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài rạn san hô cần lưu ý an toàn lặn biển", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô Hòn Mun, Côn Đảo, Cù Lao Chàm, Phú Quốc",
    local_distribution: "Ngụy trang bất động trên nền san hô chết và vụn đá tại Hòn Mun (Nha Trang), Côn Đảo và Phú Quốc.",
    location_ids: [101, 102, 103, 106],
    facts: [
      "13 gai nhọn trên vây lưng nối liền với tuyến nọc độc thần kinh cực mạnh có thể gây tử vong cho người nếu vô tình giẫm phải.",
      "Tốc độ đớp mồi của cá mặt quỷ san hô đạt dưới 15 mili-giây — một trong những phản xạ săn mồi nhanh nhất hành tinh.",
      "Chúng có thể sống sót rời khỏi mặt nước trong vòng 24 giờ nếu môi trường giữ được độ ẩm xung quanh da.",
    ],
  },
  // 6. Cá Mao Tiên Cánh Quạt
  {
    code: "FSH-LC-0266",
    slug: "ca-mao-tien-canh-quat",
    common_name: "Cá Mao Tiên Cánh Quạt",
    common_name_en: "Clearfin Lionfish (Tailbar Lionfish)",
    scientificName: "Pterois radiata",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá mao tiên cánh quạt (Pterois radiata) là loài cá mao tiên đặc biệt quý hiếm với các tia vây ngực trắng dài thanh mảnh không có màng da và hoa văn sọc ngang đỏ nâu tương phản. Chúng bơi lững lờ quanh các vách đá san hô tối màu để lùa đàn tôm nhỏ.",
    description_en: "The clearfin lionfish (Pterois radiata) is recognized by its completely scaleless, filamentous white pectoral rays and reddish-brown body marked with thin white horizontal lines.",
    diet: "Tôm rạn, cua nhỏ và ấu trùng cá biển",
    diet_en: "Reef shrimp, small crabs, and fish larvae",
    size_min_cm: 15, size_max_cm: 24, weight_min_kg: 0.2, weight_max_kg: 0.6, lifespan_years: 10,
    depth_min_m: 1, depth_max_m: 35, pressure_atm: 4.5, temperature_min_c: 24.0, temperature_max_c: 29.5,
    light_level: "Ánh sáng khuếch tán trong hang hốc rạn san hô", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật rạn san hô cảnh quan quý", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vách rạn san hô Nha Trang, Côn Đảo, quần đảo Trường Sa",
    local_distribution: "Ẩn mình trong các hang vòm và gờ đá san hô sâu tại Côn Đảo, Hòn Mun và Trường Sa.",
    location_ids: [101, 103, 105],
    facts: [
      "Là loài cá mao tiên duy nhất có các tia vây ngực hoàn toàn trắng tinh khiết không hề có đốm màu hay màng vây.",
      "Gai lưng chứa độc tố peptide tự vệ làm tê liệt các loài cá ăn thịt lớn nếu cố tình tấn công.",
      "Chúng dùng đôi vây ngực xòe rộng như chiếc quạt để dồn con mồi vào góc chết của khe đá trước khi đớp gọn.",
    ],
  },
  // 7. Cá Đao Răng Nhọn
  {
    code: "FSH-CR-0267",
    slug: "ca-dao-rang-nhon",
    common_name: "Cá Đao Răng Nhọn",
    common_name_en: "Largetooth Sawfish",
    scientificName: "Pristis pristis",
    group_slug: "ca-bien",
    status_code: "CR",
    zone_id: 1,
    description: "Cá đao răng nhọn (Pristis pristis) là loài cá sụn kỳ vĩ với chiếc mỏ dài dẹt phẳng đính hàng chục cặp răng sắc nhọn hai bên trông như lưỡi cưa máy. Chúng bơi lướt sát đáy bùn cát cửa sông và rừng ngập mặn để quét chém đàn cá mồi.",
    description_en: "The largetooth sawfish (Pristis pristis) is a critically endangered ray bearing a formidable toothed rostrum used to slash through schools of fish and dig out benthic invertebrates.",
    diet: "Cá trích, cá mòi, cá đối, tôm và cua bùn",
    diet_en: "Mullet, herrings, mud crabs, and burrowing shrimp",
    size_min_cm: 300, size_max_cm: 650, weight_min_kg: 150, weight_max_kg: 600, lifespan_years: 30,
    depth_min_m: 0, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 22.0, temperature_max_c: 32.0,
    light_level: "Ánh sáng vùng nước lợ và rừng ngập mặn ven biển", visibility_m: 5.0, dissolved_oxygen_mg_l: 5.5,
    vietnam_red_list_status: "CR", vietnam_protection_group: "Nhóm I - Cực kỳ nguy cấp, cấm khai thác tuyệt đối", cites_appendix: "Phụ lục I",
    east_sea_zone: "Cửa sông rừng ngập mặn Cần Giờ, vịnh Bắc Bộ, Cà Mau",
    local_distribution: "Từng ghi nhận tại vùng nước lợ ven biển Hải Phòng, cửa sông Cần Giờ và vịnh Thái Lan.",
    location_ids: [107, 108],
    facts: [
      "Chiếc mỏ đao chứa hàng ngàn lỗ thụ cảm điện trường giúp phát hiện chuyển động của con mồi trong làn nước đục ngầu.",
      "Khi săn đàn cá nổi, cá đao quẫy chiếc mỏ sang hai bên với tốc độ chớp nhoáng để chém rách và làm choáng váng con mồi.",
      "Cá con trong bụng mẹ có một lớp màng bọc bảo vệ quanh răng cưa để không làm rách cơ thể mẹ khi sinh nở.",
    ],
  },
  // 8. Cá Bướm Hoàng Gia (Cá Bướm Yên Ngựa)
  {
    code: "FSH-LC-0268",
    slug: "ca-buom-yen-ngua",
    common_name: "Cá Bướm Yên Ngựa",
    common_name_en: "Saddle Butterflyfish",
    scientificName: "Chaetodon ephippium",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá bướm yên ngựa (Chaetodon ephippium) là một trong những loài cá bướm lớn và lộng lẫy nhất rạn san hô với mảng đen lớn hình yên ngựa viền trắng nổi bật ở lưng trên và chiếc mõm dài chuốt thanh mảnh.",
    description_en: "The saddle butterflyfish (Chaetodon ephippium) is a large, striking reef fish named for the large black saddle mark bordered by white on its upper back and long filamentous dorsal spine.",
    diet: "Polyp san hô sống, giun ống, hải quỳ nhỏ và tảo rạn",
    diet_en: "Live coral polyps, tube worms, small anemones, and filamentous algae",
    size_min_cm: 15, size_max_cm: 30, weight_min_kg: 0.2, weight_max_kg: 0.5, lifespan_years: 12,
    depth_min_m: 0, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 24.0, temperature_max_c: 29.5,
    light_level: "Ánh sáng mạnh vùng mặt rạn san hô giàu oxy", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài chỉ thị sức khỏe rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô Hoàng Sa, Trường Sa, Côn Đảo, Nha Trang",
    local_distribution: "Bơi thành cặp gắn kết suốt đời quanh các bãi san hô cành phát triển mạnh ở Côn Đảo và Trường Sa.",
    location_ids: [101, 103, 104, 105],
    facts: [
      "Chúng là loài chung thủy gắn kết theo từng cặp đực cái suốt cả vòng đời và luôn bơi sát cánh bên nhau.",
      "Chiếc mõm dài giống như kẹp nhíp chuyên biệt để tỉa từng polyp san hô nằm sâu trong kẽ nhánh cứng mà không bị trầy xước.",
      "Tia vây lưng phía sau vươn dài thành sợi ruy-băng bay bổng tạo nên vẻ đẹp quý phái bậc nhất rạn san hô.",
    ],
  },
  // 9. Cá Rồng Biển Lá
  {
    code: "FSH-NT-0269",
    slug: "ca-rong-bien-la",
    common_name: "Cá Rồng Biển Lá",
    common_name_en: "Leafy Seadragon",
    scientificName: "Phycodurus eques",
    group_slug: "ca-bien",
    status_code: "NT",
    zone_id: 1,
    description: "Cá rồng biển lá (Phycodurus eques) là kiệt tác ngụy trang tối thượng của đại dương với các chi phụ phát triển giống hệt những chiếc lá tảo bẹ bập bềnh trong nước. Chúng không dùng các chi này để bơi mà chỉ dùng các vây trong suốt gần như vô hình.",
    description_en: "The leafy seadragon (Phycodurus eques) is a marine fish celebrated for elaborate leaf-like appendages that provide exquisite camouflage within drifting kelp and seagrass beds.",
    diet: "Tôm nhỏ (mysid shrimp), ấu trùng giáp xác và sinh vật phù du",
    diet_en: "Mysid shrimp, sea lice, and larval crustaceans",
    size_min_cm: 20, size_max_cm: 35, weight_min_kg: 0.05, weight_max_kg: 0.15, lifespan_years: 10,
    depth_min_m: 3, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 12.0, temperature_max_c: 19.0,
    light_level: "Ánh sáng vừa vùng thảm tảo và rừng tảo bẹ", visibility_m: 15.0, dissolved_oxygen_mg_l: 6.8,
    vietnam_red_list_status: "NT", vietnam_protection_group: "Loài quý hiếm được bảo vệ quốc tế nghiêm ngặt", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng nước mát thềm lục địa Thái Bình Dương",
    local_distribution: "Ẩn mình trong các thảm cỏ biển sâu và rạn đá ngầm có dòng hải lưu mát giàu dinh dưỡng.",
    location_ids: [105, 3],
    facts: [
      "Toàn bộ các 'chiếc lá' phủ khắp thân chỉ có duy nhất công năng ngụy trang, hoàn toàn không tham gia vào việc bơi lội.",
      "Giống như cá ngựa, cá đực là cá thể mang trứng: trứng được cá cái đẻ dính vào đuôi cá đực rồi được thụ tinh và nuôi dưỡng tới khi nở.",
      "Ống miệng không có răng hoạt động như một chiếc ống hút chân không cực nhạy hút trọn từng con tôm nhỏ bơi ngang qua.",
    ],
  },
  // 10. Cá Hề Lửa
  {
    code: "FSH-LC-0270",
    slug: "ca-he-lua",
    common_name: "Cá Hề Lửa",
    common_name_en: "Fire Clownfish (Red and Black Anemonefish)",
    scientificName: "Amphiprion melanopus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá hề lửa (Amphiprion melanopus) có sắc đỏ cam rực rỡ như đốm lửa với vạt đen thẫm hai bên sườn và một dải sọc trắng sáng viền xanh sau mắt. Chúng bảo vệ bụi hải quỳ thảm của mình rất quyết liệt trước mọi kẻ xâm phạm.",
    description_en: "The fire clownfish (Amphiprion melanopus) is an aggressive, vibrant anemonefish with a blazing orange-red face, dark flanks, and a prominent single white head band.",
    diet: "Tảo rạn, sinh vật phù du và thức ăn thừa từ hải quỳ",
    diet_en: "Benthic algae, zooplankton, and anemone food scraps",
    size_min_cm: 8, size_max_cm: 14, weight_min_kg: 0.05, weight_max_kg: 0.15, lifespan_years: 12,
    depth_min_m: 1, depth_max_m: 18, pressure_atm: 2.8, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh rạn san hô nông ven đảo", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cộng sinh rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Quần đảo Hoàng Sa, Trường Sa, Côn Đảo",
    local_distribution: "Sống cộng sinh trong các bụi hải quỳ thảm tại các rạn san hô đảo Trường Sa và Hoàng Sa.",
    location_ids: [104, 105, 101],
    facts: [
      "Là một trong những loài cá hề có tính bảo vệ lãnh thổ hung hăng nhất, sẵn sàng bơi ra đớp vào tay thợ lặn nếu đến quá gần hải quỳ.",
      "Chất nhầy trên da có thành phần đặc biệt khiến hải quỳ nhận diện cá hề như một phần xúc tu của chính mình.",
      "Tất cả cá hề lửa sinh ra đều là giống đực; khi con cái đầu đàn chết, cá đực lớn nhất trong đàn sẽ chuyển giới thành con cái.",
    ],
  },
  // 11. Cá Bắp Nẻ Xanh (Cá Dory)
  {
    code: "FSH-LC-0271",
    slug: "ca-bap-ne-xanh",
    common_name: "Cá Bắp Nẻ Xanh",
    common_name_en: "Blue Tang (Palette Surgeonfish)",
    scientificName: "Paracanthurus hepatus",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá bắp nẻ xanh (Paracanthurus hepatus) nổi tiếng với sắc xanh lam hoàng gia óng ánh, vệt đen uốn lượn như bảng pha màu và đuôi màu vàng tươi rực rỡ. Chúng sở hữu chiếc gai xương sắc như dao mổ ở gốc đuôi dùng để tự vệ.",
    description_en: "The blue tang (Paracanthurus hepatus) is a brightly colored surgeonfish with an electric-blue body, bold black palette pattern, yellow tail, and sharp defensive caudal spines.",
    diet: "Tảo sợi, tảo rạn san hô và sinh vật phù du",
    diet_en: "Filamentous algae, macroalgae, and plankton",
    size_min_cm: 15, size_max_cm: 31, weight_min_kg: 0.2, weight_max_kg: 0.6, lifespan_years: 20,
    depth_min_m: 2, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng mạnh tầng rạn ngoài có dòng chảy tốt", visibility_m: 20.0, dissolved_oxygen_mg_l: 6.6,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài cá cảnh biển chỉ thị rạn san hô sạch", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, quần đảo Trường Sa",
    local_distribution: "Bơi thành đàn nhỏ trên đỉnh các nhánh san hô cành Acropora ở Hòn Mun, Côn Đảo và Trường Sa.",
    location_ids: [101, 102, 103, 105],
    facts: [
      "Khi gặp kẻ săn mồi, cả đàn có thể đồng loạt 'giả chết' bằng cách nằm nghiêng bất động trên mặt san hô.",
      "Đóng vai trò cực kỳ quan trọng đối với rạn san hô nhờ việc gặm sạch các loài tảo sợi ngăn không cho tảo bóp nghẹt san hô non.",
      "Gai đuôi sắc bén chứa độc tố nhẹ có thể bật ra như một chiếc dao găm khi cá quẫy đuôi tự vệ.",
    ],
  },
  // 12. Cá Ngựa Lùn Pygmy
  {
    code: "FSH-LC-0272",
    slug: "ca-ngua-lun-pygmy",
    common_name: "Cá Ngựa Lùn Pygmy",
    common_name_en: "Bargibant's Pygmy Seahorse",
    scientificName: "Hippocampus bargibanti",
    group_slug: "ca-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Cá ngựa lùn Pygmy (Hippocampus bargibanti) là một trong những loài động vật có xương sống nhỏ nhất hành tinh với kích thước chỉ khoảng 2 cm. Cơ thể phủ các nốt sần màu hồng hoặc vàng giúp chúng ngụy trang hòa lẫn tuyệt đối vào các nhánh san hô quạt Muricella.",
    description_en: "Bargibant's pygmy seahorse (Hippocampus bargibanti) is a master of camouflage under 2 cm in size, perfectly mimicking the bulbous polyps of its host Muricella sea fans.",
    diet: "Ấu trùng giáp xác, sinh vật phù du và giun nhỏ",
    diet_en: "Copepods, crustacean larvae, and tiny plankton",
    size_min_cm: 1.4, size_max_cm: 2.7, weight_min_kg: 0.0005, weight_max_kg: 0.002, lifespan_years: 3,
    depth_min_m: 16, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 23.0, temperature_max_c: 28.5,
    light_level: "Ánh sáng vừa vùng sườn dốc san hô sâu", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "DD", vietnam_protection_group: "Loài quý hiếm đặc hữu rạn san hô sâu", cites_appendix: "Phụ lục II",
    east_sea_zone: "Vách rạn san hô sâu vịnh Nha Trang, Côn Đảo",
    local_distribution: "Sống bám cố định trên các quạt biển Muricella tại các sườn dốc san hô ngoài khơi Côn Đảo và Nha Trang.",
    location_ids: [101, 103, 105],
    facts: [
      "Ngụy trang hoàn hảo đến mức mãi đến năm 1969 con người mới tình cờ phát hiện ra khi một nhà khoa học kiểm tra quạt biển dưới kính hiển vi.",
      "Suốt cả cuộc đời trưởng thành, một cặp cá ngựa lùn có thể chỉ sống gắn bó trên đúng một cây quạt biển duy nhất.",
      "Cá đực có một chiếc túi ấp trứng đặc biệt ở phần thân trước để mang và nuôi dưỡng trứng tới khi nở thành cá con.",
    ],
  },
  // 13. Cá Phù Thủy Biển Sâu (Hagfish)
  {
    code: "DPS-LC-0273",
    slug: "ca-phu-thuy-hagfish",
    common_name: "Cá Phù Thủy Biển Sâu",
    common_name_en: "Pacific Hagfish",
    scientificName: "Eptatretus stoutii",
    group_slug: "sinh-vat-bien-sau",
    status_code: "LC",
    zone_id: 3,
    description: "Cá phù thủy biển sâu (Eptatretus stoutii) là loài cá không hàm cổ xưa nhất hành tinh, có thân hình lươn và khả năng tiết ra lượng chất nhờn khổng lồ chỉ trong vài phần mười giây để làm tắc nghẽn mang của bất kỳ kẻ săn mồi nào.",
    description_en: "The Pacific hagfish (Eptatretus stoutii) is an ancient jawless marine craniate capable of producing vast quantities of microfibrous defensive slime in milliseconds.",
    diet: "Xác cá voi rơi xuống đáy biển, cá chết và giun biển đáy thẳm",
    diet_en: "Whale fall carrion, dead marine life, and benthic polychaetes",
    size_min_cm: 35, size_max_cm: 80, weight_min_kg: 0.5, weight_max_kg: 1.5, lifespan_years: 40,
    depth_min_m: 100, depth_max_m: 1000, pressure_atm: 101.0, temperature_min_c: 3.0, temperature_max_c: 12.0,
    light_level: "Bóng tối hoàn toàn tầng biển sâu (Bathyal zone)", visibility_m: 1.0, dissolved_oxygen_mg_l: 3.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật dọn sạch đáy đại dương", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vực thẳm đáy bùn Biển Đông và Tây Thái Bình Dương",
    local_distribution: "Sinh sống ở tầng đáy bùn lạnh sâu từ 300m đến hơn 900m ngoài khơi thềm lục địa miền Trung.",
    location_ids: [105, 2],
    facts: [
      "Chất nhờn của cá phù thủy chứa các sợi protein siêu bền bền gấp 10 lần tơ nhện, hiện đang được nghiên cứu để làm áo giáp sinh học.",
      "Chúng có thể tự thắt thân mình thành một chiếc nút thắt rồi trượt nút thắt từ đầu đến đuôi để tuốt sạch chất nhờn dính trên da.",
      "Không có hộp sọ hoàn chỉnh hay cột sống xương, chúng có tới 4 trái tim và có thể hấp thụ chất dinh dưỡng trực tiếp qua da.",
    ],
  },
  // 14. Bạch Tuộc Đốm Xanh Lớn
  {
    code: "INV-LC-0274",
    slug: "bach-tuoc-dom-xanh-lon",
    common_name: "Bạch Tuộc Đốm Xanh Lớn",
    common_name_en: "Blue-lined Octopus",
    scientificName: "Hapalochlaena fasciata",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Bạch tuộc đốm xanh (Hapalochlaena fasciata) là một trong những loài sinh vật biển có độc tính thần kinh cao nhất thế giới. Khi bị kích động, các vệt và đốm xanh lam dạ quang trên thân sẽ phát sáng nhấp nháy cảnh báo chứa chất độc Tetrodotoxin cực mạnh.",
    description_en: "The blue-lined octopus (Hapalochlaena fasciata) displays flashing iridescent blue lines when threatened, warning of lethal tetrodotoxin produced by symbiotic salivary bacteria.",
    diet: "Cua nhỏ, tôm rạn san hô và cá nhỏ đáy cát",
    diet_en: "Small crabs, reef shrimp, and small benthic fish",
    size_min_cm: 5, size_max_cm: 15, weight_min_kg: 0.02, weight_max_kg: 0.08, lifespan_years: 2,
    depth_min_m: 0, depth_max_m: 25, pressure_atm: 3.5, temperature_min_c: 20.0, temperature_max_c: 28.0,
    light_level: "Ánh sáng vùng vũng triều và rạn nông", visibility_m: 15.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật độc tố cao cần cảnh báo an toàn bờ biển", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vùng vũng triều đá ngầm ven biển miền Trung và hải đảo",
    local_distribution: "Thường ẩn mình trong vỏ sò rỗng, khe đá vũng triều ở Côn Đảo, Nha Trang và vịnh Thái Lan.",
    location_ids: [101, 103, 106],
    facts: [
      "Chất độc Tetrodotoxin trong tuyến nước bọt của một cá thể tí hon này đủ mạnh để làm tê liệt hơn 20 người trưởng thành.",
      "Độc tố không do bạch tuộc tự tạo ra mà do các vi khuẩn cộng sinh đặc biệt sống trong tuyến nước bọt của chúng sản sinh.",
      "Bình thường chúng ngụy trang màu vàng nâu xám nhạt, chỉ khi bị đe dọa các vòng tròn xanh neon mới nhấp nháy phát sáng cảnh báo.",
    ],
  },
  // 15. Ốc Nón Địa Lý
  {
    code: "MOL-LC-0275",
    slug: "oc-non-dia-ly",
    common_name: "Ốc Nón Địa Lý",
    common_name_en: "Geography Cone",
    scientificName: "Conus geographus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Ốc nón địa lý (Conus geographus) là loài ốc biển săn mồi nguy hiểm nhất đại dương với lớp vỏ hoa văn vân gỗ tinh xảo. Chúng phóng ra chiếc răng hình ngạnh lao tẩm độc tố conotoxin làm tê liệt cá mồi trong tích tắc trước khi mở rộng miệng nuốt chửng.",
    description_en: "The geography cone (Conus geographus) is the deadliest venomous cone snail, utilizing a modified harpoon-like radular tooth delivering hundreds of complex neurotoxins.",
    diet: "Cá rạn san hô ngủ ban đêm, tôm cua nhỏ",
    diet_en: "Sleeping reef fishes, marine mollusks, and worms",
    size_min_cm: 8, size_max_cm: 16, weight_min_kg: 0.1, weight_max_kg: 0.35, lifespan_years: 20,
    depth_min_m: 1, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 23.0, temperature_max_c: 29.5,
    light_level: "Ánh sáng vùng rạn san hô đáy cát ven bờ", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật có giá trị dược liệu thần kinh cao", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô quần đảo Hoàng Sa, Trường Sa, Côn Đảo",
    local_distribution: "Vùi mình dưới lớp cát mịn gần rạn san hô ở Côn Đảo, Trường Sa và vịnh Nha Trang.",
    location_ids: [101, 103, 104, 105],
    facts: [
      "Chất độc chứa hỗn hợp hàng trăm loại peptide conotoxin khác nhau, trong đó có chất giảm đau mạnh gấp 1.000 lần morphine mà không gây nghiện.",
      "Chiếc răng ngạnh rỗng được phóng ra với tốc độ đạn bắn nhờ áp lực dịch lỏng trong vòi săn mồi.",
      "Chúng còn biết tiết ra 'insulin địa lý' vào làn nước xung quanh làm hạ đường huyết đột ngột khiến cá bơi chậm chạp rơi vào trạng thái ngủ say.",
    ],
  },
  // 16. Sên Biển Thỏ Biển
  {
    code: "MOL-LC-0276",
    slug: "sen-bien-tho-bien",
    common_name: "Sên Biển Thỏ Biển",
    common_name_en: "Sea Bunny Nudibranch",
    scientificName: "Jorunna parva",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sên biển thỏ biển (Jorunna parva) nổi tiếng khắp thế giới nhờ ngoại hình đáng yêu trông như một chú thỏ bông tí hon với hai chiếc 'tai thỏ' vươn cao và chiếc đuôi hoa tròn. Cơ thể phủ các nốt gai cảm giác caryophyllidia li ti tạo cảm giác như lớp lông tơ mềm mại.",
    description_en: "The sea bunny (Jorunna parva) is a beloved dorid nudibranch resembling a fluffy bunny with ear-like sensory rhinophores and a flower-shaped gill rosette.",
    diet: "Hải miên độc (bọt biển) trên vách đá rạn san hô",
    diet_en: "Toxic marine sponges belonging to the Chalinidae family",
    size_min_cm: 1.0, size_max_cm: 2.5, weight_min_kg: 0.001, weight_max_kg: 0.005, lifespan_years: 1,
    depth_min_m: 5, depth_max_m: 30, pressure_atm: 4.0, temperature_min_c: 18.0, temperature_max_c: 26.0,
    light_level: "Ánh sáng vừa vùng rạn đá ngầm ven đảo", visibility_m: 16.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cảnh quan rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô vịnh Nha Trang, Côn Đảo, Cù Lao Chàm",
    local_distribution: "Bò trên các mảng hải miên bám vách đá ngầm tại Côn Đảo và đảo Hòn Mun (Nha Trang).",
    location_ids: [101, 102, 103],
    facts: [
      "Hai chiếc 'tai thỏ' thực chất là cơ quan khứu giác hóa học cực nhạy (rhinophores) giúp chúng ngửi thấy mùi hải miên từ xa.",
      "Chúng ăn các loài bọt biển chứa độc tố cao và hấp thụ chính các hợp chất độc đó vào cơ thể để kẻ săn mồi không dám ăn thịt.",
      "Là loài lưỡng tính: mỗi cá thể đều có cả cơ quan sinh dục đực và cái, khi gặp nhau cả hai sẽ cùng trao đổi tinh trùng.",
    ],
  },
  // 17. Sên Biển Vũ Công Tây Ban Nha
  {
    code: "MOL-LC-0277",
    slug: "sen-bien-vu-cong-tay-ban-nha",
    common_name: "Sên Biển Vũ Công Tây Ban Nha",
    common_name_en: "Spanish Dancer",
    scientificName: "Hexabranchus sanguineus",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Sên biển vũ công Tây Ban Nha (Hexabranchus sanguineus) là loài sên biển trần lớn nhất thế giới, dài tới 40–50 cm với sắc đỏ rực rỡ như chiếc váy xoè của vũ nữ flamenco. Khi bơi, chúng uốn lượn rìa thân lượn sóng nhịp nhàng giữa làn nước đêm đại dương.",
    description_en: "The Spanish dancer (Hexabranchus sanguineus) is the world's largest nudibranch, famed for brilliant scarlet coloration and graceful undulating swimming movements reminiscent of a flamenco dancer.",
    diet: "Hải miên độc, bọt biển chứa chất độc macrolide",
    diet_en: "Toxic Halichondria sponges and other noxious demosponges",
    size_min_cm: 20, size_max_cm: 52, weight_min_kg: 0.5, weight_max_kg: 1.8, lifespan_years: 5,
    depth_min_m: 2, depth_max_m: 50, pressure_atm: 6.0, temperature_min_c: 22.0, temperature_max_c: 29.5,
    light_level: "Ánh sáng yếu đến ban đêm vùng rạn san hô", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Loài chỉ thị thẩm mỹ và sinh thái rạn san hô", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, quần đảo Trường Sa",
    local_distribution: "Gặp khi lặn đêm trên các rạn san hô dốc ở Côn Đảo, Hòn Mun và đảo Nam Yết (Trường Sa).",
    location_ids: [101, 102, 103, 105],
    facts: [
      "Có thể đạt kích thước khổng lồ lên tới hơn nửa mét — lớn gấp hàng chục lần đa số các loài sên biển thông thường.",
      "Túi trứng của chúng đẻ ra có dạng một dải ruy-băng đỏ tươi xếp nếp hoa hồng tuyệt mỹ dính chặt trên đá san hô.",
      "Tích lũy chất độc cực mạnh kabiramide C từ bọt biển vào dải viền thân và trứng khiến cá không thể ăn được.",
    ],
  },
  // 18. Cầu Gai Lửa Hoa Phấn
  {
    code: "INV-LC-0278",
    slug: "cau-gai-lua",
    common_name: "Cầu Gai Lửa Hoa Phấn",
    common_name_en: "Red Fire Urchin",
    scientificName: "Asthenosoma varium",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 1,
    description: "Cầu gai lửa hoa phấn (Asthenosoma varium) là loài cầu gai rực rỡ nhất rạn san hô với các dải màu đỏ, tím, cam xen kẽ và các túi độc hình cầu nhỏ phát sáng như ngọc bích ở đầu gai. Vỏ cầu gai có tính đàn hồi linh hoạt độc đáo chứ không cứng nhắc như các loài cầu gai khác.",
    description_en: "The red fire urchin (Asthenosoma varium) is a venomous echinoderm with a flexible test and vibrant purple-red banding, tipped with glowing venom-bearing globiferous pedicellariae.",
    diet: "Tảo rạn san hô, mảnh vụn hữu cơ và vi sinh vật bám đá",
    diet_en: "Benthic algae, detritus, and encrusting organisms",
    size_min_cm: 12, size_max_cm: 25, weight_min_kg: 0.3, weight_max_kg: 0.8, lifespan_years: 15,
    depth_min_m: 3, depth_max_m: 70, pressure_atm: 8.0, temperature_min_c: 23.0, temperature_max_c: 29.0,
    light_level: "Ánh sáng vừa vùng chân rạn san hô và đống đổ nát", visibility_m: 15.0, dissolved_oxygen_mg_l: 6.4,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh vật cộng sinh vật chủ của tôm Coleman", cites_appendix: "Không liệt kê",
    east_sea_zone: "Rạn san hô vịnh Nha Trang, Côn Đảo, Cù Lao Chàm",
    local_distribution: "Di chuyển chậm chạp trên các bãi vụn san hô chân rạn tại Hòn Mun và Côn Đảo.",
    location_ids: [101, 102, 103],
    facts: [
      "Mỗi đầu gai ngắn được bọc bởi một nang chứa chất độc thần kinh nhạy cảm, chỉ cần chạm nhẹ nang sẽ vỡ và tiêm độc tức thì.",
      "Là 'ngôi nhà di động' cộng sinh an toàn tuyệt đối cho loài tôm rực rỡ Coleman (Periclimenes colemani) và cua sọc ngựa vằn.",
      "Vỏ của chúng không bị vôi hóa cứng đờ mà cấu tạo từ các phiến canxi xếp lợp có thể uốn lượn theo bề mặt đá gồ ghề.",
    ],
  },
  // 19. Cua Khổng Lồ Tasmania
  {
    code: "CRU-LC-0279",
    slug: "cua-khong-lo-tasmania",
    common_name: "Cua Khổng Lồ Tasmania",
    common_name_en: "Tasmanian Giant Crab",
    scientificName: "Pseudocarcinus gigas",
    group_slug: "than-mem-khong-xuong-song",
    status_code: "LC",
    zone_id: 2,
    description: "Cua khổng lồ Tasmania (Pseudocarcinus gigas) là loài cua nặng thứ hai trên thế giới với trọng lượng lên tới 13–15 kg và chiếc càng bên phải phát triển khổng lồ to như bắp tay người lớn. Chúng sống ở thềm lục địa biển sâu lạnh giá chuyên nghiền nát sao biển và ốc biển.",
    description_en: "The Tasmanian giant crab (Pseudocarcinus gigas) is one of the heaviest crabs on Earth, weighing up to 15 kg with an enormous crushing claw adapted for deep continental shelf life.",
    diet: "Xác động vật biển chết, sao biển, ốc biển và cua nhỏ",
    diet_en: "Carrion, sea stars, gastropods, and smaller benthic crabs",
    size_min_cm: 30, size_max_cm: 46, weight_min_kg: 8.0, weight_max_kg: 15.0, lifespan_years: 30,
    depth_min_m: 120, depth_max_m: 820, pressure_atm: 83.0, temperature_min_c: 7.0, temperature_max_c: 14.0,
    light_level: "Vùng nước sâu tối thềm lục địa (Bathyal slope)", visibility_m: 10.0, dissolved_oxygen_mg_l: 5.2,
    vietnam_red_list_status: "DD", vietnam_protection_group: "Giáp xác thềm lục địa sâu", cites_appendix: "Không liệt kê",
    east_sea_zone: "Thềm lục địa biển sâu Tây Thái Bình Dương",
    local_distribution: "Sinh sống ở các sườn thềm đá ngầm biển sâu lạnh từ 150m đến hơn 600m.",
    location_ids: [105, 5],
    facts: [
      "Chiếc càng búa khổng lồ của con đực có thể to hơn cả mai cua và tạo lực kẹp mạnh hàng ngàn Newton làm vỡ vụn vỏ sò đá.",
      "Chúng có thể sống nhiều tháng dưới đáy biển lạnh mà không cần ăn nhờ tích trữ năng lượng trong khối cơ bắp dồi dào.",
      "Con cái có thể mang tới hơn 2 triệu quả trứng dưới yếm bụng trong suốt 4 tháng trước khi trứng nở.",
    ],
  },
  // 20. Hải Quỳ Thảm San Hô
  {
    code: "CRL-LC-0280",
    slug: "hai-quy-tham-san-ho",
    common_name: "Hải Quỳ Thảm San Hô",
    common_name_en: "Haddon's Carpet Anemone",
    scientificName: "Stichodactyla haddoni",
    group_slug: "san-ho-thuc-vat-bien",
    status_code: "LC",
    zone_id: 1,
    description: "Hải quỳ thảm san hô (Stichodactyla haddoni) trải rộng như một tấm thảm nhung tròn màu xanh ngọc hoặc lục bảo trên đáy cát rạn san hô với đường kính lên tới 80 cm. Hàng vạn xúc tu ngắn dính như keo chứa chất độc châm tê liệt bất kỳ loài cá nào vô tình bơi qua.",
    description_en: "Haddon's carpet anemone (Stichodactyla haddoni) is a large sea anemone forming undulating emerald-green carpets across sandy reef flats, hosting clownfish and anemone shrimp.",
    diet: "Cá nhỏ vô tình chạm phải, sinh vật phù du và giáp xác",
    diet_en: "Invertebrates, small fishes, and zooxanthellae photosynthetic byproducts",
    size_min_cm: 40, size_max_cm: 80, weight_min_kg: 1.5, weight_max_kg: 5.0, lifespan_years: 100,
    depth_min_m: 1, depth_max_m: 40, pressure_atm: 5.0, temperature_min_c: 24.0, temperature_max_c: 30.0,
    light_level: "Ánh sáng mạnh vùng bãi cát rạn san hô", visibility_m: 18.0, dissolved_oxygen_mg_l: 6.5,
    vietnam_red_list_status: "LC", vietnam_protection_group: "Sinh cảnh bảo tồn rạn san hô trọng điểm", cites_appendix: "Không liệt kê",
    east_sea_zone: "Vịnh Nha Trang, Côn Đảo, Cù Lao Chàm, quần đảo Trường Sa",
    local_distribution: "Cắm chân sâu vào nền cát sỏi quanh rạn san hô Hòn Mun, Côn Đảo và Trường Sa.",
    location_ids: [101, 102, 103, 105],
    facts: [
      "Xúc tu của hải quỳ thảm cực kỳ dính, nếu chạm tay vào sẽ cảm giác như bị dính chặt vào băng keo dính siêu chắc.",
      "Là loài cộng sinh chủ yếu che chở cho cá hề lửa (Amphiprion melanopus), cá hề hải quỳ và tôm vằn ngực trong suốt.",
      "Bên trong mô của chúng chứa hàng triệu vi tảo Zooxanthellae quang hợp cung cấp hơn 80% năng lượng đường hữu cơ cho hải quỳ.",
    ],
  },
];

const httpsAgent = new https.Agent({
  keepAlive: false,
});

async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios({
        url,
        ...options,
        httpsAgent,
        timeout: options.timeout || 20000,
        headers: {
          "User-Agent": "PacificMarineEncyclopedia/1.0 (academic-research-bot)",
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`   ⚠️ Thử lại yêu cầu [${attempt}/${retries}] (${err.code || err.message})...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
}

async function getVerifiedSourceId(scientificName) {
  try {
    const wormsRes = await fetchWithRetry(
      `https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(scientificName)}`,
      { method: "GET", timeout: 12000 }
    );
    const first = wormsRes?.data?.[0]?.[0];
    if (first?.valid_AphiaID || first?.AphiaID) {
      return `worms:${first.valid_AphiaID || first.AphiaID}`;
    }
  } catch {}

  try {
    const gbifRes = await fetchWithRetry(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`,
      { method: "GET", timeout: 12000 }
    );
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
      per_page: 40,
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

  // Fallback nếu thiếu ảnh
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

  return chosen;
}

async function run() {
  console.log("🌊 Bắt đầu cào & nạp 20 loài sinh vật biển mới + Mạng lưới sinh thái...");

  // Đồng bộ PostgreSQL serial sequences
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

  for (const sp of TWENTY_SPECIES) {
    console.log(`\n🔎 [CRAWL] Đang cào dữ liệu cho: ${sp.common_name} (${sp.scientificName})...`);

    const [sourceApiId, mediaList] = await Promise.all([
      getVerifiedSourceId(sp.scientificName),
      crawlDiverPhotos(sp.scientificName, sp.common_name),
    ]);

    if (mediaList.length < 3) {
      throw new Error(`Loài ${sp.common_name} chỉ lấy được ${mediaList.length} ảnh hợp lệ, dừng để kiểm tra!`);
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
      ? await prisma.species.update({ where: { id: existing.id }, data: speciesData })
      : await prisma.species.create({ data: speciesData });

    crawledSpeciesList.push({ ...sp, dbId: saved.id, mediaList });

    // 1) Lưu 4 ảnh thật vào species_media
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

    await new Promise((r) => setTimeout(r, 600));
  }

  // 5) Thiết lập quan hệ sinh thái hai chiều cho 20 loài mới
  console.log("\n🕸️  Đang thiết lập Mạng lưới sinh thái & Chuỗi thức ăn cho 20 loài mới...");

  const allSpecies = await prisma.species.findMany({
    select: { id: true, slug: true, common_name: true },
  });
  const bySlug = new Map(allSpecies.map((s) => [s.slug, s]));

  const RELATIONSHIPS = [
    // Cá Mập Đầu Búa Lớn
    { src: "ca-map-dau-bua-lon", tgt: "ca-duoi-o-dai-bang", type: "predator_prey", desc: "Cá mập đầu búa lớn dùng đầu búa ghìm chặt cá đuối ó đại bàng xuống đáy cát trước khi ăn thịt.", impact: "Thiên địch đỉnh cao điều hòa số lượng các loài cá đuối lớn.", strength: 0.95 },
    { src: "ca-map-dau-bua-lon", tgt: "ca-duoi-dom-xanh", type: "predator_prey", desc: "Cá mập đầu búa lớn săn lùng các loài cá đuối rạn san hô ẩn mình dưới đáy cát.", impact: "Kiểm soát các loài cá đuối độc ven rạn san hô.", strength: 0.9 },
    { src: "ca-map-dau-bua-lon", tgt: "ca-map-ho-tiger-shark", type: "competitor", desc: "Cạnh tranh thức ăn là các loài cá đuối lớn và cá ngừ tại vùng nước sâu ngoài khơi.", impact: "Phân chia không gian săn mồi giữa hai loài cá mập khổng lồ.", strength: 0.82 },

    // Cá Nhám Báo
    { src: "ca-nham-bao", tgt: "cua-nhen-ran", type: "predator_prey", desc: "Cá nhám báo dùng miệng cơ bắp hút và nghiền nát cua rạn và ốc thân mềm trong khe đá.", impact: "Duy trì cân bằng động vật giáp xác và thân mềm tầng đáy rạn.", strength: 0.85 },
    { src: "ca-nham-bao", tgt: "tom-tit-bay-mau", type: "predator_prey", desc: "Săn bắt tôm tít khi tôm rời hang cát đi kiếm ăn vào lúc chạng vạng.", impact: "Điều tiết quần thể giáp xác đáy.", strength: 0.78 },
    { src: "ca-map-ho-tiger-shark", tgt: "ca-nham-bao", type: "predator_prey", desc: "Cá mập hổ tuần tra đáy rạn săn cá nhám báo khi chúng nằm nghỉ trên cát.", impact: "Tạo áp lực chọn lọc tự nhiên lên tập tính cảnh giác của cá nhám.", strength: 0.88 },
    { src: "tom-bac-si-van-do", tgt: "ca-nham-bao", type: "symbiosis", desc: "Tôm bác sĩ vằn đỏ làm sạch da và khe mang cho cá nhám báo khi cá nằm yên trên cát.", impact: "Giảm ký sinh trùng ngoài da và chăm sóc sức khỏe cho cá nhám.", strength: 0.92 },

    // Cá Đuối Ó Đại Bàng
    { src: "ca-duoi-o-dai-bang", tgt: "oc-ban-tay", type: "predator_prey", desc: "Dùng răng phiến nghiền nát vỏ dày của ốc bàn tay và các loài nghêu rạn san hô.", impact: "Kiểm soát số lượng động vật thân mềm ăn tảo quanh rạn.", strength: 0.88 },
    { src: "ca-duoi-o-dai-bang", tgt: "cau-gai-bo-duc", type: "predator_prey", desc: "Nghiền nát cầu gai bồ dục trên đáy cát rạn san hô.", impact: "Ngăn chặn cầu gai sinh sôi quá mức phá hủy nền san hô.", strength: 0.82 },
    { src: "ca-map-ho-tiger-shark", tgt: "ca-duoi-o-dai-bang", type: "predator_prey", desc: "Cá mập hổ săn cá đuối ó đại bàng khi đàn cá đuối bơi qua vùng nước sâu ngoài khơi.", impact: "Mắt xích truyền năng lượng lên đỉnh chuỗi thức ăn đại dương.", strength: 0.9 },

    // Cá Đuối Điện Thái Bình Dương
    { src: "ca-duoi-dien-thai-binh-duong", tgt: "ca-trich-mai", type: "predator_prey", desc: "Phóng điện 45 vôn làm tê liệt đàn cá trích trước khi nuốt trọn.", impact: "Phương thức săn mồi bằng điện sinh học đặc sắc của tầng trung.", strength: 0.88 },
    { src: "ca-duoi-dien-thai-binh-duong", tgt: "ca-nuc-so", type: "predator_prey", desc: "Làm choáng váng cá nục sồ bơi gần đáy bùn lạnh.", impact: "Điều hòa số lượng cá nổi di chuyển xuống tầng sâu.", strength: 0.84 },
    { src: "ca-map-dau-bua-lon", tgt: "ca-duoi-dien-thai-binh-duong", type: "predator_prey", desc: "Cá mập đầu búa có khả năng chịu xung điện và săn cá đuối điện ở thềm lục địa.", impact: "Thiên địch tự nhiên duy nhất của cá đuối điện.", strength: 0.75 },

    // Cá Mặt Quỷ San Hô
    { src: "ca-mat-quy-san-ho", tgt: "ca-thia-san-ho-xanh", type: "predator_prey", desc: "Ngụy trang thành hòn đá rồi há miệng hút trọn cá thia xanh bơi ngang chỉ trong 0.015 giây.", impact: "Kẻ săn mồi phục kích hiệu quả bậc nhất trên rạn san hô.", strength: 0.92 },
    { src: "ca-mat-quy-san-ho", tgt: "tom-tit-bay-mau", type: "predator_prey", desc: "Đớp gọn tôm tít nhỏ bò qua bề mặt san hô ngụy trang.", impact: "Điều tiết động vật giáp xác rạn san hô.", strength: 0.8 },
    { src: "san-ho-nao", tgt: "ca-mat-quy-san-ho", type: "habitat_provider", desc: "Nền khối san hô não cung cấp bề mặt ngụy trang hoàn hảo cho cá mặt quỷ ẩn nấp.", impact: "Mối liên hệ cấu trúc sinh cảnh quan trọng giữa san hô và cá phục kích.", strength: 0.9 },

    // Cá Mao Tiên Cánh Quạt
    { src: "ca-mao-tien-canh-quat", tgt: "ca-he-ocellaris-nemo", type: "predator_prey", desc: "Dùng đôi vây ngực xòe rộng dồn cá nhỏ vào góc chết trước khi đớp gọn.", impact: "Điều hòa số lượng cá rạn cỡ nhỏ quanh khe đá.", strength: 0.82 },
    { src: "ca-mu-nghe", tgt: "ca-mao-tien-canh-quat", type: "predator_prey", desc: "Cá mú nghệ khổng lồ có miệng lớn đủ sức nuốt chửng cá mao tiên mà không sợ gai độc.", impact: "Thiên địch hiếm hoi kiểm soát cá mao tiên trên rạn san hô.", strength: 0.85 },

    // Cá Đao Răng Nhọn
    { src: "ca-dao-rang-nhon", tgt: "ca-trich-mai", type: "predator_prey", desc: "Quẫy mỏ đao răng cưa sang hai bên để chém đàn cá trích trong làn nước đục.", impact: "Điều hòa nguồn cá nổi ở vùng cửa sông rừng ngập mặn.", strength: 0.9 },
    { src: "cay-duoc-doi-rung-ngap-man", tgt: "ca-dao-rang-nhon", type: "habitat_provider", desc: "Rễ đước rừng ngập mặn tạo bãi ươm giống an toàn cho cá đao con phát triển.", impact: "Sinh cảnh tối quan trọng sống còn cho sự sinh tồn của cá đao.", strength: 0.95 },

    // Cá Bướm Yên Ngựa
    { src: "ca-buom-yen-ngua", tgt: "san-ho-canh-acropora", type: "predator_prey", desc: "Dùng mõm dài gắp tỉa các polyp san hô cành sống mà không làm gãy nhánh san hô.", impact: "Kích thích san hô phân nhánh mới khỏe mạnh khi ở mật độ vừa phải.", strength: 0.88 },
    { src: "san-ho-canh-acropora", tgt: "ca-buom-yen-ngua", type: "habitat_provider", desc: "Cung cấp cả nguồn thức ăn và nơi ẩn náu trốn kẻ săn mồi cho đôi cá bướm.", impact: "Sự phụ thuộc sinh thái chặt chẽ giữa cá bướm và rạn san hô.", strength: 0.92 },

    // Cá Rồng Biển Lá
    { src: "ca-rong-bien-la", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Hút các ấu trùng giáp xác và sinh vật phù du nhỏ trôi dạt trong thảm tảo.", impact: "Mắt xích tiêu thụ sinh vật phù du tầng đáy thảm cỏ biển.", strength: 0.85 },
    { src: "co-bien-la-kim", tgt: "ca-rong-bien-la", type: "habitat_provider", desc: "Thảm cỏ biển và rong bẹ cung cấp sinh cảnh ngụy trang giúp cá rồng biển hòa lẫn hoàn hảo.", impact: "Bảo tồn thảm cỏ biển là điều kiện sống còn của cá rồng biển lá.", strength: 0.95 },

    // Cá Hề Lửa
    { src: "ca-he-lua", tgt: "hai-quy-tham-san-ho", type: "symbiosis", desc: "Cộng sinh tương hỗ chặt chẽ: Hải quỳ che chở cá hề lửa, cá hề bảo vệ và đem mồi cho hải quỳ.", impact: "Mối quan hệ cộng sinh kinh điển đặc trưng của rạn san hô nhiệt đới.", strength: 0.98 },
    { src: "ca-he-lua", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bơi ra khỏi hải quỳ để bắt sinh vật phù du nhỏ trôi ngang qua rồi nhanh chóng quay về tổ.", impact: "Chuyển hóa năng lượng phù du vào hệ sinh thái bụi hải quỳ.", strength: 0.8 },

    // Cá Bắp Nẻ Xanh (Dory)
    { src: "ca-bap-ne-xanh", tgt: "rong-cau-chi-vang", type: "herbivory", desc: "Gặm sạch rong câu và tảo bám quanh rạn san hô, ngăn chặn rong tảo lấn át san hô sống.", impact: "Duy trì sự sống còn cho rạn san hô bằng cách kiểm soát rong biển.", strength: 0.92 },
    { src: "san-ho-canh-acropora", tgt: "ca-bap-ne-xanh", type: "habitat_provider", desc: "Cá bắp nẻ xanh ẩn mình sâu bên trong các nhánh san hô cành Acropora khi ngủ ban đêm.", impact: "Cung cấp nơi trú ẩn thiết yếu bảo vệ đàn cá bắp nẻ khỏi kẻ săn mồi.", strength: 0.9 },
    { src: "ca-song-cham-xanh", tgt: "ca-bap-ne-xanh", type: "predator_prey", desc: "Cá song chấm xanh phục kích săn bắt cá bắp nẻ xanh khi chúng bơi ra khỏi nhánh san hô.", impact: "Chuỗi thức ăn rạn san hô tự nhiên.", strength: 0.82 },

    // Cá Ngựa Lùn Pygmy
    { src: "ca-ngua-lun-pygmy", tgt: "san-ho-quat-bien", type: "symbiosis", desc: "Sống gắn bó cả đời trên quạt biển san hô Muricella, ngụy trang tuyệt hảo giống hệt polyp quạt biển.", impact: "Bảo tồn quạt biển sâu giúp duy trì quần thể loài cá ngựa tí hon này.", strength: 0.96 },
    { src: "ca-ngua-lun-pygmy", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Hút các ấu trùng giáp xác phù du siêu nhỏ trôi qua quạt biển.", impact: "Tiêu thụ sinh vật phù du dòng chảy sâu.", strength: 0.8 },

    // Cá Phù Thủy Biển Sâu
    { src: "ca-phu-thuy-hagfish", tgt: "ca-voi-xanh", type: "commensalism", desc: "Khi xác cá voi chìm xuống đáy thẳm (Whale fall), cá phù thủy là sinh vật tiên phong đến dọn sạch xác thối.", impact: "Tái chế dưỡng chất quan trọng bậc nhất nuôi sống toàn bộ hệ sinh thái đáy biển sâu.", strength: 0.95 },
    { src: "ca-phu-thuy-hagfish", tgt: "trung-lo-khong-lo", type: "commensalism", desc: "Cùng chia sẻ sinh cảnh bùn đáy thẳm và tái phân phối khoáng chất đáy sâu.", impact: "Tái tạo trầm tích đáy thẳm đại dương.", strength: 0.75 },

    // Bạch Tuộc Đốm Xanh Lớn
    { src: "bach-tuoc-dom-xanh-lon", tgt: "cua-nhen-ran", type: "predator_prey", desc: "Tiêm nọc độc thần kinh Tetrodotoxin làm tê liệt cua nhện và động vật giáp xác nhỏ.", impact: "Kiểm soát số lượng các loài cua rạn tầng cạn.", strength: 0.92 },
    { src: "ca-nhong-van", tgt: "bach-tuoc-dom-xanh-lon", type: "predator_prey", desc: "Cá nhồng vằn tấn công chớp nhoáng từ xa trước khi bạch tuộc kịp phóng độc tự vệ.", impact: "Thiên địch hiếm hoi của các loài bạch tuộc độc.", strength: 0.76 },

    // Ốc Nón Địa Lý
    { src: "oc-non-dia-ly", tgt: "ca-thia-san-ho-xanh", type: "predator_prey", desc: "Phóng răng ngạnh tẩm conotoxin làm tê liệt cá thia ngủ ban đêm rồi nuốt chửng.", impact: "Săn mồi ban đêm điều hòa quần thể cá rạn nhỏ.", strength: 0.9 },
    { src: "oc-tu-va-hoang-hau", tgt: "oc-non-dia-ly", type: "predator_prey", desc: "Ốc tù và dùng vỏ dày miễn nhiễm nọc độc để săn và ăn thịt các loài ốc nón độc.", impact: "Kiểm soát tự nhiên các loài ốc độc trên rạn san hô.", strength: 0.85 },

    // Sên Biển Thỏ Biển
    { src: "sen-bien-tho-bien", tgt: "san-ho-than", type: "commensalism", desc: "Bò trên nền san hô thận và vách đá ngầm tìm ăn hải miên độc.", impact: "Kiểm soát sự phát triển của các loài bọt biển lấn át san hô.", strength: 0.8 },

    // Sên Biển Vũ Công Tây Ban Nha
    { src: "sen-bien-vu-cong-tay-ban-nha", tgt: "san-ho-lo-dia", type: "commensalism", desc: "Đẻ dải trứng hoa hồng đỏ rực rỡ dính chặt trên các mảng san hô lỗ đĩa.", impact: "Cung cấp dinh dưỡng cho ấu trùng giáp xác khi trứng nở.", strength: 0.85 },

    // Cầu Gai Lửa Hoa Phấn
    { src: "cau-gai-lua", tgt: "rong-nho-bien", type: "herbivory", desc: "Gặm tảo bám và rong biển chân rạn san hô giúp nền đá thông thoáng.", impact: "Duy trì sinh thái đáy rạn sạch tảo.", strength: 0.82 },
    { src: "tom-bac-si-van-do", tgt: "cau-gai-lua", type: "symbiosis", desc: "Tôm rạn bơi giữa các gai độc của cầu gai lửa để được bảo vệ an toàn khỏi cá săn mồi.", impact: "Cộng sinh che chở độc đáo trên rạn san hô.", strength: 0.92 },

    // Cua Khổng Lồ Tasmania
    { src: "cua-khong-lo-tasmania", tgt: "sao-bien-gai", type: "predator_prey", desc: "Dùng chiếc càng khổng lồ bóp vụn sao biển và động vật đáy vỏ cứng tầng sâu.", impact: "Kẻ săn mồi đỉnh cao dọn dẹp đáy thềm lục địa.", strength: 0.9 },
    { src: "cua-khong-lo-tasmania", tgt: "bo-bien-khong-lo-giant-isopod", type: "competitor", desc: "Cạnh tranh xác động vật chết rơi xuống đáy thềm lục địa sâu.", impact: "Phân chia nguồn dinh dưỡng quý giá ở đáy biển sâu.", strength: 0.8 },

    // Hải Quỳ Thảm San Hô
    { src: "hai-quy-tham-san-ho", tgt: "ca-he-ocellaris-nemo", type: "symbiosis", desc: "Tấm thảm hải quỳ khổng lồ là ngôi nhà che chở lý tưởng cho đàn cá hề Nemo.", impact: "Hạt nhân bảo tồn nguồn gen cá rạn san hô nhiệt đới.", strength: 0.98 },
    { src: "hai-quy-tham-san-ho", tgt: "sinh-vat-phu-du-bien-dong", type: "predator_prey", desc: "Bắt giữ sinh vật phù du và giáp xác nhỏ trôi dạt vào lòng thảm xúc tu dính.", impact: "Lọc sạch và thu nhận năng lượng phù du từ cột nước.", strength: 0.88 },
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

  // 6) Cập nhật vào SEARCH_SPECIES_CATALOG trong speciesMock.js để đồng bộ cả Offline & Mock FE
  console.log("\n📦 Đang đồng bộ 20 loài vào frontend/src/mocks/speciesMock.js...");
  const fs = await import("fs");
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
        const statusType = sp.status_code === "CR" || sp.status_code === "EN" ? "danger" : sp.status_code === "VU" || sp.status_code === "NT" ? "warning" : "safe";

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
    image: "${sp.mediaList[0].url}",
    gallery: ${JSON.stringify(sp.mediaList.map((m) => m.url), null, 6)},
    isFeatured: false,
  },`;
      }

      if (newMockEntries) {
        mockContent = mockContent.slice(0, insertPos) + newMockEntries + mockContent.slice(insertPos);
        fs.writeFileSync(MOCK_FILE, mockContent, "utf-8");
        console.log("   ✅ Đã thêm các loài mới vào speciesMock.js!");
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

