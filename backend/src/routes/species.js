import { Router } from "express";
import taxonomyService from "../services/taxonomyService.js";
import oceanAudioService from "../services/oceanAudioService.js";
import authenticateToken from "../middleware/auth.js";
import aiModerationService from "../services/aiModerationService.js";
import ecosystemService from "../services/ecosystemService.js";

const router = Router();

// Mapping các slug / id phổ biến từ mockup hoặc tiếng Anh sang slug chuẩn trong CSDL
const SLUG_ALIASES = {
  // Aliases cũ
  "giant-octopus-3": "bach-tuoc-dom-xanh",
  "octopus": "bach-tuoc-dom-xanh",
  "whale-shark": "ca-map-voi-nham-voi",
  "whale-shark-2": "ca-map-voi-nham-voi",
  "bluefin-tuna-1": "ca-ngu-vay-vang-dai-duong",
  "great-white-shark-1": "great-white-shark-1",

  // 32 loài trong Độ Sâu Đại Dương (OceanDepth)
  "dugong": "bo-bien-dugong",
  "clownfish": "ca-he-ocellaris-nemo",
  "hawksbill-turtle": "doi-moi-rua-bien",
  "bigfin-squid": "muc-la-dai-duong",
  "spotted-dolphin": "ca-heo-dom-nhiet-doi",
  "sailfish": "ca-co-gon",
  "hammerhead-shark": "ca-nham-bua-dau-bua",
  "yellowfin-tuna": "ca-ngu-vay-vang-dai-duong",
  "ocean-sunfish": "ca-mat-trang-mola-mola",
  "spotted-eagle-ray": "ca-duoi-o-hoa",
  "lanternfish": "ca-den-long-bien-sau",
  "giant-isopod": "bo-bien-khong-lo-giant-isopod",
  "hatchetfish": "ca-riu-bac-bien-sau",
  "cockeyed-squid": "muc-mat-choi-lac",
  "muc-mat-lech": "muc-mat-choi-lac",
  "deepsea-crab": "cua-da-bien-sau",
  "ghost-shark": "ca-nham-ma-ghost-shark",
  "black-dragonfish": "ca-rong-den-bien-sau",
  "glass-squid": "muc-thuy-tinh-glass-squid",
  "gigantocypris": "giap-xac-boi-khong-lo-gigantocypris",
  "anglerfish": "ca-can-cau-bien-sau-anglerfish",
  "haima-tubeworm": "giun-ong-mieng-lanh-haima",
  "haima-mussel": "trai-bien-sau-haima",
  "viperfish": "ca-rong-bien-sau-viperfish",
  "vampire-squid": "muc-ma-ca-rong-bien-sau",
  "dumbo-octopus": "bach-tuoc-dumbo",
  "tripod-fish": "ca-ba-chan-tripod-fish",
  "grenadier-fish": "ca-duoi-chuot-bien-sau",
  "sea-pig": "heo-bien-sau-sea-pig",
  "brittle-star": "sao-gion-vuc-tham",
  "hadal-snailfish": "ca-oc-ranh-sau-hadal-snailfish",
  "hadal-amphipod": "giap-xac-chan-hai-ranh-manila",
};

const resolveSpeciesSlug = (slugOrId = "") => {
  return SLUG_ALIASES[slugOrId] || slugOrId;
};

// GET /api/species/taxonomy-search - Tra cứu phân loại học đại dương
router.get("/taxonomy-search", async (req, res) => {
  try {
    const query = req.query.q || req.query.query || "";
    const provider = req.query.provider || "auto";
    const result = await taxonomyService.searchTaxonomy(query, provider);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/audio-library - Tải danh sách âm thanh đại dương
router.get("/audio-library", async (req, res) => {
  try {
    const query = req.query.q || "";
    const category = req.query.category || "Tất cả";
    const result = await oceanAudioService.getAudioLibrary(query, category);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/audio-search - Tìm kiếm nâng cao âm thanh đại dương trực tiếp từ Wikimedia
router.get("/audio-search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const result = await oceanAudioService.searchAdvanced(query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/audio-proxy - Proxy âm thanh hợp lệ từ các nguồn khoa học / Freesound đã xác thực
router.get("/audio-proxy", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("Missing target audio URL");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).send("Invalid audio URL");
    }

    const allowedHosts = [
      "freesound.org",
      "cdn.freesound.org",
      "upload.wikimedia.org",
      "commons.wikimedia.org",
      "localhost",
    ];
    const isAllowed = allowedHosts.some(
      (h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`),
    );
    if (!isAllowed || !["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(403).send("Audio source domain is not permitted");
    }

    const audioRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "PacificOceanApp/1.0 (https://pacific.org; educational bioacoustics)",
        "Accept": "audio/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!audioRes.ok) {
      return res.status(audioRes.status).send(`Failed to stream audio (status: ${audioRes.status})`);
    }

    res.setHeader("Content-Type", audioRes.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const arrayBuffer = await audioRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Lỗi Audio Proxy Stream:", error.message);
    return res.status(500).send("Audio Proxy Error");
  }
});

// GET /api/species/groups - Danh sách nhóm sinh vật biển
router.get("/groups", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const groups = await prisma.species_groups.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      success: true,
      data: groups.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        slug: g.slug,
        description: g.description,
        image_url: g.image_url,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/zones - Danh sách 5 tầng nước đại dương
router.get("/zones", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const zones = await prisma.ocean_zones.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ success: true, data: zones });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/statuses - Danh sách tình trạng bảo tồn IUCN
router.get("/statuses", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const statuses = await prisma.conservation_statuses.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/locations - Danh sách địa điểm phân bố của một loài
router.get("/:idOrSlug/locations", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    const isNum = /^\d+$/.test(targetSlug);

    let species = null;
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài." });
    }

    const speciesLocations = await prisma.species_locations.findMany({
      where: { species_id: species.id },
      include: {
        locations: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true,
            description: true,
            image_url: true,
            ocean_zone_id: true,
            is_featured: true,
          },
        },
      },
    });

    const locations = speciesLocations
      .map((sl) => sl.locations)
      .filter((loc) => loc.latitude != null && loc.longitude != null)
      .map((loc) => ({
        id: loc.id.toString(),
        name: loc.name,
        slug: loc.slug,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        description: loc.description,
        image_url: loc.image_url,
        ocean_zone_id: loc.ocean_zone_id,
        is_featured: loc.is_featured,
      }));

    return res.status(200).json({ success: true, data: locations });
  } catch (error) {
    console.error("Lỗi lấy địa điểm phân bố loài:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/depth-distribution - Phân bố sinh vật theo độ sâu đại dương (Thước đo độ sâu Biển Đông)
router.get("/depth-distribution", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const { default: prisma } = await import("../lib/prisma.js");

    const [dbZones, dbSpecies] = await Promise.all([
      prisma.ocean_zones.findMany({
        orderBy: { depth_min_m: "asc" },
      }),
      prisma.species.findMany({
        where: {
          is_visible: true,
          deleted_at: null,
          OR: [
            { depth_min_m: { not: null } },
            { depth_max_m: { not: null } },
          ],
        },
        select: {
          id: true,
          slug: true,
          code: true,
          common_name: true,
          scientificName: true,
          description: true,
          depth_min_m: true,
          depth_max_m: true,
          ocean_zone_id: true,
          ocean_zones: {
            select: { id: true, name: true, depth_min_m: true, depth_max_m: true, description: true },
          },
          species_groups: {
            select: { id: true, name: true, slug: true },
          },
          species_media: {
            where: { type: "image" },
            take: 1,
            select: { url: true },
          },
          conservation_statuses: {
            select: { id: true, code: true, name: true },
          },
          vietnam_red_list_status: true,
          east_sea_zone: true,
        },
        orderBy: [
          { depth_min_m: "asc" },
          { depth_max_m: "asc" },
        ],
      }),
    ]);

    // Chuẩn hóa và tính độ sâu đặc trưng cho từng sinh vật (tối đa 5,016m - Rãnh Manila)
    const allCreatures = dbSpecies.map((sp) => {
      const minD = sp.depth_min_m != null ? Number(sp.depth_min_m) : 0;
      const maxD = sp.depth_max_m != null ? Number(sp.depth_max_m) : minD;

      let displayDepth = minD;
      if (maxD > minD && maxD <= 200) {
        displayDepth = Math.round(minD + (maxD - minD) * 0.4);
      } else if (maxD > 200) {
        displayDepth = Math.round((minD + maxD) / 2);
      }
      displayDepth = Math.min(5016, Math.max(1, displayDepth));

      return {
        id: sp.id.toString(),
        slug: sp.slug,
        code: sp.code,
        nameVi: sp.common_name,
        nameEn: sp.scientificName,
        sciName: sp.scientificName,
        descVi: sp.description || "",
        descEn: sp.description || "",
        depth: displayDepth,
        depthMin: minD,
        depthMax: maxD,
        depthText: `${minD}m – ${maxD}m`,
        image: sp.species_media[0]?.url || "",
        groupId: sp.species_groups?.slug || "ca-bien",
        groupName: sp.species_groups?.name || "Cá biển",
        redList: sp.vietnam_red_list_status || sp.conservation_statuses?.code || "LC",
        conservationName: sp.conservation_statuses?.name || (sp.vietnam_red_list_status ? `Sách Đỏ VN (${sp.vietnam_red_list_status})` : "Ít lo ngại"),
        oceanZone: sp.ocean_zones?.name || "Tầng mặt (Epipelagic)",
      };
    });

    // Sắp xếp sinh vật theo độ sâu tăng dần từ 0m đến 5,016m
    const sortedCreatures = allCreatures.sort((a, b) => a.depth - b.depth);

    // Tính toán phân bổ 4 làn hiển thị rộng khắp màn hình (18%, 38%, 58%, 78%)
    const lanePositions = [18, 38, 58, 78];
    const distributedCreatures = sortedCreatures.map((c, idx) => ({
      ...c,
      left: lanePositions[idx % 4],
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalSpecies: allCreatures.length,
        species: distributedCreatures,
        zones: dbZones,
        maxDepth: 5016,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy phân bố độ sâu sinh vật:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/map-distribution - Phân bố sinh vật và địa điểm trên bản đồ Biển Đông
router.get("/map-distribution", async (req, res) => {
  try {
    // Vô hiệu hóa triệt để HTTP cache trình duyệt để luôn nhận tọa độ chuẩn xác mới nhất
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const { default: prisma } = await import("../lib/prisma.js");

    const dbLocations = await prisma.locations.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        species_locations: {
          include: {
            species: {
              select: {
                id: true,
                slug: true,
                common_name: true,
                scientificName: true,
                species_media: {
                  where: { type: "image" },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const dbSpecies = await prisma.species.findMany({
      where: {
        is_visible: true,
        deleted_at: null,
      },
      select: {
        id: true,
        slug: true,
        code: true,
        common_name: true,
        scientificName: true,
        depth_min_m: true,
        depth_max_m: true,
        east_sea_zone: true,
        vietnam_red_list_status: true,
        conservation_statuses: {
          select: { id: true, code: true, name: true },
        },
        group_id: true,
        species_groups: {
          select: { id: true, name: true, slug: true },
        },
        species_media: {
          where: { type: "image" },
          take: 1,
          select: { url: true },
        },
        species_locations: {
          include: {
            locations: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    // Lọc chỉ lấy các phân vùng biển thuộc chủ quyền và phạm vi hải dương học Biển Đông
    const eastSeaLocations = dbLocations.filter((loc) => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      return lat >= 4 && lat <= 25 && lng >= 102 && lng <= 122;
    });

    const locations = eastSeaLocations.map((loc) => ({
      id: loc.id.toString(),
      nameVi: loc.name,
      nameEn: loc.name,
      slug: loc.slug,
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
      depth: loc.description || "45m",
      coordText: `${Number(loc.latitude).toFixed(2)}° B, ${Number(loc.longitude).toFixed(2)}° Đ`,
      categoryVi: "Khu bảo tồn & Vùng biển trọng điểm",
      categoryEn: "Marine Protected Area",
      descVi: loc.description || "",
      descEn: loc.description || "",
      residentSpecies: loc.species_locations.map((sl) => ({
        id: sl.species.id.toString(),
        slug: sl.species.slug,
        nameVi: sl.species.common_name,
        nameEn: sl.species.scientificName,
        image: sl.species.species_media[0]?.url || "",
      })),
    }));

    // Bảng đếm số lượng loài tại từng phân vùng để phân bổ tọa độ xoắn ốc vàng (Golden Spiral)
    // Giúp các loài trong cùng khu bảo tồn tản đều ra vùng biển xung quanh, không bao giờ dính đè lên nhau
    const zoneDistributionTracker = {};

    // Helper đổi tọa độ thập phân sang định dạng độ - phút - giây chuẩn hải quân
    const formatDMS = (lat, lng) => {
      const formatPart = (val, isLat) => {
        const abs = Math.abs(val);
        let deg = Math.floor(abs);
        const minFloat = (abs - deg) * 60;
        let min = Math.floor(minFloat);
        let sec = Math.round((minFloat - min) * 60);
        if (sec === 60) {
          sec = 0;
          min += 1;
        }
        if (min === 60) {
          min = 0;
          deg += 1;
        }
        const dir = isLat ? (val >= 0 ? "B" : "N") : (val >= 0 ? "Đ" : "T");
        return `${deg}°${String(min).padStart(2, "0")}'${String(sec).padStart(2, "0")}" ${dir}`;
      };
      return `${formatPart(lat, true)}, ${formatPart(lng, false)}`;
    };

    // Helper xác định toạ độ dựa vào locations hoặc east_sea_zone với tỷ lệ phân tán hải dương học thực tế
    // Đảm bảo tuyệt đối 100% sinh vật biển phân bổ trên mặt nước/thềm lục địa, không bao giờ nằm trên đất liền
    const getSpeciesCoords = (sp) => {
      let centerLat = 13.8;
      let centerLng = 113.2;
      let zoneName = "Biển Đông";
      let spreadScale = 0.5;

      // 1. Ưu tiên toạ độ từ bảng liên kết species_locations nếu thuộc vùng Biển Đông
      if (sp.species_locations && sp.species_locations.length > 0) {
        const firstLoc = sp.species_locations[0].locations;
        const locLat = Number(firstLoc?.latitude);
        const locLng = Number(firstLoc?.longitude);
        if (locLat >= 4 && locLat <= 25 && locLng >= 102 && locLng <= 122) {
          centerLat = locLat;
          centerLng = locLng;
          zoneName = firstLoc.name;

          if (zoneName.includes("Trường Sa")) {
            spreadScale = 0.42;
          } else if (zoneName.includes("Hoàng Sa")) {
            spreadScale = 0.35;
          } else if (zoneName.includes("Côn Đảo")) {
            spreadScale = 0.16;
            centerLng = 106.68;
          } else if (zoneName.includes("Nha Trang") || zoneName.includes("Hòn Mun")) {
            spreadScale = 0.20;
            centerLat = 12.2150;
            centerLng = 109.3200;
          } else if (zoneName.includes("Phú Quốc")) {
            spreadScale = 0.18;
            centerLng = 104.08;
          } else if (zoneName.includes("Cù Lao Chàm")) {
            spreadScale = 0.14;
            centerLng = 108.56;
          } else if (zoneName.includes("Bạch Long Vĩ")) {
            spreadScale = 0.10;
          } else {
            spreadScale = 0.20;
          }
        }
      } else {
        // 2. Nếu không có bảng liên kết, suy diễn từ phân vùng biển east_sea_zone của CSDL
        const z = (sp.east_sea_zone || "").toLowerCase();
        if (z.includes("hoàng sa")) {
          centerLat = 16.5333; centerLng = 112.0333; zoneName = "Quần đảo Hoàng Sa"; spreadScale = 0.35;
        } else if (z.includes("trường sa")) {
          centerLat = 10.1833; centerLng = 114.3667; zoneName = "Quần đảo Trường Sa"; spreadScale = 0.42;
        } else if (z.includes("côn đảo")) {
          centerLat = 8.6833; centerLng = 106.6800; zoneName = "Vườn Quốc gia Côn Đảo"; spreadScale = 0.16;
        } else if (z.includes("phú quốc") || z.includes("thái lan")) {
          centerLat = 10.1500; centerLng = 104.0800; zoneName = "Khu Bảo tồn Biển Phú Quốc"; spreadScale = 0.18;
        } else if (z.includes("nha trang") || z.includes("hòn mun")) {
          centerLat = 12.2150; centerLng = 109.3200; zoneName = "Vịnh Nha Trang & Hòn Mun"; spreadScale = 0.20;
        } else if (z.includes("cù lao chàm")) {
          centerLat = 15.9600; centerLng = 108.5600; zoneName = "Khu BTTB Cù Lao Chàm"; spreadScale = 0.14;
        } else if (z.includes("hạ long") || z.includes("bái tử long")) {
          centerLat = 20.8200; centerLng = 107.2800; zoneName = "Vịnh Hạ Long & Bái Tử Long"; spreadScale = 0.18;
        } else if (z.includes("bạch long vĩ")) {
          centerLat = 20.1333; centerLng = 107.7167; zoneName = "Đảo Bạch Long Vĩ"; spreadScale = 0.10;
        } else if (z.includes("hòn cau") || z.includes("ninh thuận") || z.includes("bình thuận")) {
          centerLat = 11.2333; centerLng = 108.8900; zoneName = "Khu bảo tồn Hòn Cau"; spreadScale = 0.15;
        } else if (z.includes("rãnh") || z.includes("vực thẳm") || z.includes("manila") || z.includes("đáy sâu") || z.includes("hố sâu")) {
          centerLat = 14.3500; centerLng = 117.5000; zoneName = "Vực thẳm Manila Biển Đông"; spreadScale = 0.38;
        } else if (z.includes("bắc bộ")) {
          centerLat = 19.8000; centerLng = 107.5000; zoneName = "Vịnh Bắc Bộ"; spreadScale = 0.85;
        } else if (z.includes("trung bộ") || z.includes("miền trung")) {
          centerLat = 13.5000; centerLng = 109.6000; zoneName = "Vùng biển Trung Bộ"; spreadScale = 1.25;
        } else if (z.includes("nam bộ")) {
          centerLat = 9.3000; centerLng = 107.3000; zoneName = "Vùng biển Nam Bộ"; spreadScale = 0.65;
        } else {
          zoneName = sp.east_sea_zone || "Biển Đông";
          spreadScale = 0.95;
        }
      }

      // Phân bổ tọa độ chuẩn xác theo từng vùng hải văn tự nhiên
      const zoneKey = zoneName;
      const count = zoneDistributionTracker[zoneKey] || 0;
      zoneDistributionTracker[zoneKey] = count + 1;

      let finalLat, finalLng;
      if (zoneKey === "Vùng biển Trung Bộ") {
        // Trải dọc theo thềm lục địa hải phận duyên hải miền Trung (12.20° B đến 15.30° B)
        // Luôn cách bờ biển tối thiểu 35km đến 80km (nằm hoàn toàn ngoài biển sâu phía Đông)
        const latStep = 12.25 + ((count * 5) % 15) * 0.21;
        let baseLng;
        if (latStep < 13.2) {
          // Khu vực Khánh Hòa - Mũi Đại Lãnh - Phú Yên: thềm biển mở ngoài khơi
          baseLng = 109.70 + ((count % 3) * 0.10);
        } else if (latStep < 14.2) {
          // Khu vực Bình Định - Quy Nhơn: thềm biển mở
          baseLng = 109.60 + ((count % 3) * 0.10);
        } else {
          // Khu vực Quảng Ngãi - Quảng Nam - Đà Nẵng: thềm biển mở
          baseLng = 109.45 + ((count % 3) * 0.10);
        }
        finalLat = Number(latStep.toFixed(4));
        finalLng = Number(baseLng.toFixed(4));
      } else if (zoneKey.includes("Nha Trang") || zoneKey.includes("Hòn Mun")) {
        // Vùng biển sâu Vịnh Nha Trang & khu bảo tồn Hòn Mun (phía Đông đảo Hòn Tre & đảo Hòn Mun)
        // Vùng nước biển mở 100% không đảo, không bán đảo: vĩ độ 12.140° - 12.240° B, kinh độ 109.345° - 109.470° Đ
        const row = Math.floor(count / 7);
        const col = count % 7;
        finalLat = Number((12.1450 + (row * 0.0125) + ((count % 3) * 0.0025)).toFixed(4));
        finalLng = Number((109.3450 + (col * 0.0180) + (((count * 2) % 5) * 0.0035)).toFixed(4));
      } else if (zoneKey.includes("Hoàng Sa")) {
        const isAnVinh = count % 2 === 0;
        const subCenterLat = isAnVinh ? 16.85 : 16.35;
        const subCenterLng = isAnVinh ? 112.45 : 111.65;
        const angle = count * 2.39996;
        const r = 0.08 + (count * 0.012);
        finalLat = Number((subCenterLat + r * Math.sin(angle)).toFixed(4));
        finalLng = Number((subCenterLng + r * Math.cos(angle) * 1.1).toFixed(4));
      } else if (zoneKey.includes("Trường Sa")) {
        const angle = count * 2.39996;
        const r = 0.25 + (count * 0.035);
        finalLat = Number((centerLat + r * Math.sin(angle)).toFixed(4));
        finalLng = Number((centerLng + r * Math.cos(angle) * 1.2).toFixed(4));
      } else if (zoneKey.includes("Cù Lao Chàm")) {
        // Cù Lao Chàm: Biển mở phía Đông cụm đảo (108.56 - 108.70)
        const row = Math.floor(count / 5);
        const col = count % 5;
        finalLat = Number((15.9100 + (row * 0.012) + ((count % 2) * 0.003)).toFixed(4));
        finalLng = Number((108.5650 + (col * 0.022) + (((count * 2) % 4) * 0.004)).toFixed(4));
      } else if (zoneKey.includes("Côn Đảo")) {
        // Côn Đảo: Vùng rạn san hô và biển sâu phía Đông / Đông Nam (106.70 - 106.86)
        const row = Math.floor(count / 6);
        const col = count % 6;
        finalLat = Number((8.6200 + (row * 0.012) + ((count % 3) * 0.002)).toFixed(4));
        finalLng = Number((106.7050 + (col * 0.022) + (((count * 2) % 4) * 0.004)).toFixed(4));
      } else if (zoneKey.includes("Phú Quốc")) {
        // Phú Quốc: Vùng rạn phía Đông và biển sâu quần đảo An Thới (104.10 - 104.26)
        const row = Math.floor(count / 6);
        const col = count % 6;
        finalLat = Number((10.0800 + (row * 0.018) + ((count % 3) * 0.003)).toFixed(4));
        finalLng = Number((104.1050 + (col * 0.024) + (((count * 2) % 4) * 0.004)).toFixed(4));
      } else if (zoneKey.includes("Hòn Cau")) {
        // Hòn Cau: Vùng biển trồi phía Đông Hòn Cau (108.92 - 109.05)
        const angle = count * 2.39996;
        const r = 0.02 + Math.min(0.01 * Math.sqrt(count), 0.06);
        finalLat = Number((11.2100 + r * Math.sin(angle)).toFixed(4));
        finalLng = Number((108.9300 + Math.abs(r * Math.cos(angle)) + 0.02).toFixed(4));
      } else if (zoneKey.includes("Hạ Long") || zoneKey.includes("Bái Tử Long")) {
        // Vịnh Hạ Long & Bái Tử Long: Luồng vịnh mở phía ngoài (107.28 - 107.42)
        const angle = count * 2.39996;
        const r = 0.03 + Math.min(0.012 * Math.sqrt(count), 0.08);
        finalLat = Number((20.7800 + r * Math.sin(angle)).toFixed(4));
        finalLng = Number((107.3000 + Math.abs(r * Math.cos(angle)) + 0.02).toFixed(4));
      } else {
        const goldenAngle = count * 2.39996;
        // Bán kính an toàn để luôn nằm gọn trong lòng chảo biển sâu Biển Đông
        const radius = count === 0 ? 0 : Math.min(1.8, (spreadScale * 0.15 + spreadScale * 0.08 * Math.sqrt(count)));
        finalLat = Number((centerLat + radius * Math.sin(goldenAngle)).toFixed(4));
        finalLng = Number((centerLng + radius * Math.cos(goldenAngle) * 1.05).toFixed(4));
      }

      // HÀNG RÀO KIỂM TRA HẢI PHẬN AN TOÀN (100% NGOÀI BIỂN, KHÔNG CHẠM ĐẤT LIỀN)
      // Khắc phục triệt để hiện tượng sinh vật biển xuất hiện trên các dãy núi đất liền duyên hải miền Trung
      if (finalLat >= 11.0 && finalLat <= 13.5) {
        if (finalLng < 109.3400) finalLng = Number((109.3500 + ((count % 6) * 0.025)).toFixed(4));
      } else if (finalLat > 13.5 && finalLat <= 15.0) {
        if (finalLng < 109.3000) finalLng = Number((109.3200 + ((count % 6) * 0.025)).toFixed(4));
      } else if (finalLat > 15.0 && finalLat <= 16.5) {
        if (finalLng < 108.5500) finalLng = Number((108.6000 + ((count % 6) * 0.025)).toFixed(4));
      } else if (finalLat > 16.5 && finalLat <= 18.5) {
        if (finalLng < 107.2000) finalLng = Number((107.4000 + ((count % 6) * 0.030)).toFixed(4));
      }

      return {
        lat: finalLat,
        lng: finalLng,
        zoneName,
        coordText: formatDMS(finalLat, finalLng),
        coordDecimal: `${finalLat.toFixed(3)}° B, ${finalLng.toFixed(3)}° Đ`,
      };
    };

    return res.status(200).json({
      success: true,
      data: {
        locations,
        species: dbSpecies.map((sp) => {
          const coords = getSpeciesCoords(sp);
          return {
            id: sp.id.toString(),
            slug: sp.slug,
            code: sp.code,
            nameVi: sp.common_name,
            nameEn: sp.scientificName,
            sciName: sp.scientificName,
            depth: `${sp.depth_min_m ?? 0}m - ${sp.depth_max_m ?? 200}m`,
            zoneNameVi: coords.zoneName,
            lat: coords.lat,
            lng: coords.lng,
            coordText: coords.coordText,
            coordDecimal: coords.coordDecimal,
            image: sp.species_media[0]?.url || "",
            groupId: sp.species_groups?.slug || "ca-bien",
            groupName: sp.species_groups?.name || "Cá biển",
            redList: sp.vietnam_red_list_status || sp.conservation_statuses?.code || "LC",
            conservationName: sp.conservation_statuses?.name || (sp.vietnam_red_list_status ? `Sách Đỏ VN (${sp.vietnam_red_list_status})` : "Ít lo ngại"),
          };
        }),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy map-distribution:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/locations - Danh sách địa điểm khám phá đại dương
router.get("/locations", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const locations = await prisma.locations.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      success: true,
      data: locations.map((loc) => ({
        id: loc.id.toString(),
        name: loc.name,
        slug: loc.slug,
        latitude: loc.latitude,
        longitude: loc.longitude,
        ocean_zone_id: loc.ocean_zone_id,
        is_featured: loc.is_featured,
        description: loc.description,
        image_url: loc.image_url,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/ecosystem/graph - Đồ thị đa dạng sinh thái Biển Đông
router.get("/ecosystem/graph", async (req, res) => {
  try {
    const result = await ecosystemService.getKnowledgeGraph(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy đồ thị sinh thái:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/ecosystem/auto-link - Quét và tự động dệt liên kết chuỗi thức ăn cho toàn bộ loài chưa có liên kết
router.post("/ecosystem/auto-link", async (req, res) => {
  try {
    const { default: ecosystemAutoLinker } = await import("../services/ecosystemAutoLinker.js");
    const result = await ecosystemAutoLinker.autoLinkAllUnlinkedSpecies();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Lỗi khi tự động liên kết sinh thái:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/ecosystem/stats - Thống kê đa dạng sinh học & Sách Đỏ Biển Đông
router.get("/ecosystem/stats", async (req, res) => {
  try {
    const result = await ecosystemService.getEastSeaStats();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy thống kê Biển Đông:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/ecosystem - Hệ sinh thái và chuỗi thức ăn của loài
router.get("/:idOrSlug/ecosystem", async (req, res) => {
  try {
    const result = await ecosystemService.getSpeciesEcosystem(req.params.idOrSlug);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy hệ sinh thái loài:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/search/semantic - Tìm kiếm Ngữ nghĩa Sinh thái Biển Đông
router.get("/search/semantic", async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || "").trim();
    const result = await ecosystemService.searchSemantic(query);

    // Ghi nhận lượt tìm kiếm vào search_logs không chặn phản hồi
    if (query.length >= 2) {
      import("../lib/prisma.js")
        .then(async ({ default: prisma }) => {
          let userId = null;
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
              const jwt = (await import("jsonwebtoken")).default;
              const decoded = jwt.verify(
                authHeader.slice(7),
                process.env.JWT_SECRET || "pacific_ocean_secret_key_2026"
              );
              if (decoded?.id) userId = BigInt(decoded.id);
            } catch {
              // Bỏ qua token hết hạn cho tìm kiếm công khai
            }
          }
          await prisma.search_logs.create({
            data: {
              keyword: query.slice(0, 255),
              result_count: Number(result?.count || 0),
              user_id: userId,
            },
          });
        })
        .catch(() => {});
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi tìm kiếm ngữ nghĩa:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/comments - Danh sách bình luận công khai của loài sinh vật
router.get("/:idOrSlug/comments", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    // Tìm sinh vật theo id hoặc slug
    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, slug: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(200).json({ success: true, data: [] });
    }

    const comments = await prisma.comments.findMany({
      where: {
        species_id: species.id,
        deleted_at: null,
        status: "visible",
      },
      orderBy: { created_at: "desc" },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
      },
    });

    const formatted = comments.map((c) => ({
      id: c.id.toString(),
      content: c.content,
      createdAt: c.created_at,
      user: c.users
        ? {
            id: c.users.id.toString(),
            username: c.users.username,
            fullName: c.users.full_name || c.users.username,
            avatarUrl: c.users.avatar_url || "",
            role: c.users.role,
          }
        : {
            id: "0",
            username: "Người dùng ẩn danh",
            fullName: "Người dùng ẩn danh",
            avatarUrl: "",
            role: "user",
          },
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Lỗi lấy danh sách bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/:idOrSlug/comments - Gửi bình luận mới cho loài sinh vật
router.post("/:idOrSlug/comments", authenticateToken, async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Nội dung bình luận không được để trống" });
    }

    const { default: prisma } = await import("../lib/prisma.js");

    let species = null;
    const isNum = /^\d+$/.test(idOrSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(idOrSlug) },
        select: { id: true, slug: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    // 1. Tải cấu hình kiểm duyệt từ bảng system_settings
    let settings = null;
    try {
      const settingRecord = await prisma.system_settings.findFirst({
        where: { setting_key: "general_config" },
      });
      if (settingRecord?.setting_value) {
        settings =
          typeof settingRecord.setting_value === "string"
            ? JSON.parse(settingRecord.setting_value)
            : settingRecord.setting_value;
      }
    } catch {}
    const contentSettings = settings?.content || {};

    // 2. Kiểm tra Cooldown thời gian chờ giữa 2 lần bình luận
    const cooldownSec = Number(contentSettings.commentCooldownSeconds ?? 0);
    if (cooldownSec > 0) {
      const lastComment = await prisma.comments.findFirst({
        where: { user_id: BigInt(userId) },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      });
      if (lastComment) {
        const diffSec = (Date.now() - new Date(lastComment.created_at).getTime()) / 1000;
        if (diffSec < cooldownSec) {
          const waitSec = Math.ceil(cooldownSec - diffSec);
          return res.status(429).json({
            success: false,
            message: `Bạn đang bình luận quá nhanh. Vui lòng đợi ${waitSec} giây trước khi gửi tiếp.`,
          });
        }
      }
    }

    let processedContent = content.trim();

    // 3. Kiểm tra danh sách từ khóa cấm
    if (contentSettings.filterProfanity !== false) {
      const bannedWords = Array.isArray(contentSettings.customBannedWords)
        ? contentSettings.customBannedWords
        : ["scam", "lừa đảo", "chửi bậy", "xúc phạm", "hack"];

      const profanityAction = contentSettings.profanityAction || "mask";

      for (const word of bannedWords) {
        if (!word) continue;
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        if (regex.test(processedContent)) {
          if (profanityAction === "reject") {
            return res.status(400).json({
              success: false,
              message: "Bình luận chứa từ ngữ không phù hợp theo quy định cộng đồng. Vui lòng chỉnh sửa trước khi đăng.",
            });
          } else {
            processedContent = processedContent.replace(regex, "*".repeat(word.length));
          }
        }
      }
    }

    // 4. Kiểm duyệt tự động nội dung bình luận
    let initialStatus = contentSettings.requireApprovalFirst ? "pending" : "visible";
    let aiFlagReason = "";

    if (contentSettings.autoModeration !== false) {
      try {
        const aiCheck = await aiModerationService.moderateComment(
          processedContent,
          contentSettings.aiSensitivity || "medium"
        );
        if (aiCheck?.isFlagged) {
          initialStatus = "hidden"; // Tự động tạm ẩn bình luận vi phạm
          aiFlagReason = aiCheck.reason || "AI phát hiện vi phạm tiêu chuẩn cộng đồng";
        }
      } catch (err) {
        console.warn("⚠️ [AI Moderation Check Skipped]:", err.message);
      }
    }

    const newComment = await prisma.comments.create({
      data: {
        species_id: species.id,
        user_id: BigInt(userId),
        content: processedContent,
        status: initialStatus,
        report_count: aiFlagReason ? 1 : 0,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
      },
    });

    // Tạo phiếu báo cáo khi bình luận có dấu hiệu vi phạm
    if (aiFlagReason) {
      try {
        await prisma.comment_reports.create({
          data: {
            comment_id: newComment.id,
            reported_by: BigInt(userId),
            reason: `[AI Gemini Gắn Cờ]: ${aiFlagReason}`,
            status: "pending",
          },
        });
      } catch (e) {
        console.warn("Không thể ghi phiếu báo cáo AI:", e.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Bình luận thành công",
      data: {
        id: newComment.id.toString(),
        content: newComment.content,
        createdAt: newComment.created_at,
        user: newComment.users
          ? {
              id: newComment.users.id.toString(),
              username: newComment.users.username,
              fullName: newComment.users.full_name || newComment.users.username,
              avatarUrl: newComment.users.avatar_url || "",
              role: newComment.users.role,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/species/comments/:commentId - Xóa bình luận của chính mình hoặc admin xóa
router.delete("/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { default: prisma } = await import("../lib/prisma.js");

    const comment = await prisma.comments.findUnique({
      where: { id: BigInt(commentId) },
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận" });
    }

    // Kiểm tra quyền: Admin / Super Admin hoặc chính người tạo
    if (role !== "admin" && role !== "super_admin" && comment.user_id.toString() !== userId?.toString()) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bình luận này" });
    }

    await prisma.comments.update({
      where: { id: BigInt(commentId) },
      data: {
        deleted_at: new Date(),
        status: "deleted",
      },
    });

    return res.status(200).json({ success: true, message: "Đã xóa bình luận thành công" });
  } catch (error) {
    console.error("Lỗi xóa bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/:idOrSlug/view - Ghi nhận lượt xem sinh vật
router.post("/:idOrSlug/view", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const authHeader = req.headers.authorization;
    let currentUser = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const jwtSecret = process.env.JWT_SECRET || "dinhthanhloi08042005&nguyentranlebao23012005";
        const decoded = (await import("jsonwebtoken")).default.verify(token, jwtSecret);
        currentUser = decoded;
      } catch {
        // Token không hợp lệ hoặc hết hạn -> xử lý như khách vãng lai
      }
    }

    // Nếu người xem là Admin hoặc Super Admin -> BỎ QUA không ghi nhận lượt xem
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "super_admin")) {
      return res.status(200).json({
        success: true,
        message: "Lượt xem của quản trị viên được bỏ qua để giữ độ chính xác của số liệu phân tích.",
        ignored: true,
      });
    }

    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, view_count: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, view_count: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    // Tăng view_count trên bảng species
    await prisma.species.update({
      where: { id: species.id },
      data: {
        view_count: { increment: 1 },
      },
    });

    // Ghi log vào bảng species_views nếu có thể
    try {
      await prisma.species_views.create({
        data: {
          species_id: species.id,
          user_id: currentUser?.userId ? BigInt(currentUser.userId) : null,
        },
      });
    } catch {
      // Bỏ qua lỗi log phụ
    }

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận lượt xem",
      ignored: false,
    });
  } catch (error) {
    console.error("Lỗi ghi nhận view:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/:idOrSlug/favorite - Toggle lưu hoặc bỏ lưu sinh vật yêu thích
router.post("/:idOrSlug/favorite", authenticateToken, async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const userId = BigInt(req.user.userId);
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
          ],
        },
        select: { id: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    const existing = await prisma.favorites.findUnique({
      where: {
        user_id_species_id: {
          user_id: userId,
          species_id: species.id,
        },
      },
    });

    if (existing) {
      await prisma.favorites.delete({
        where: {
          user_id_species_id: {
            user_id: userId,
            species_id: species.id,
          },
        },
      });
      return res.status(200).json({
        success: true,
        isFavorited: false,
        message: "Đã xóa khỏi danh sách yêu thích",
      });
    } else {
      await prisma.favorites.create({
        data: {
          user_id: userId,
          species_id: species.id,
        },
      });
      return res.status(200).json({
        success: true,
        isFavorited: true,
        message: "Đã lưu vào danh sách yêu thích",
      });
    }
  } catch (error) {
    console.error("Lỗi toggle favorite:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/favorite-status - Kiểm tra trạng thái yêu thích
router.get("/:idOrSlug/favorite-status", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    let userId = null;
    try {
      const token = authHeader.split(" ")[1];
      const jwtSecret = process.env.JWT_SECRET || "dinhthanhloi08042005&nguyentranlebao23012005";
      const decoded = (await import("jsonwebtoken")).default.verify(token, jwtSecret);
      userId = decoded.userId;
    } catch {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    if (!userId) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    const { default: prisma } = await import("../lib/prisma.js");
    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
          ],
        },
        select: { id: true },
      });
    }

    if (!species) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    const existing = await prisma.favorites.findUnique({
      where: {
        user_id_species_id: {
          user_id: BigInt(userId),
          species_id: species.id,
        },
      },
    });

    return res.status(200).json({
      success: true,
      isFavorited: !!existing,
    });
  } catch (error) {
    return res.status(200).json({ success: true, isFavorited: false });
  }
});

// GET /api/species - Lấy danh sách loài sinh vật biển
router.get("/", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const {
      page = 1,
      limit = 20,
      search = "",
      zone = "",
      redList = "",
      groupId = "",
      category = "",
      sortBy = "az",
      featured = "",
    } = req.query;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(500, parseInt(limit, 10));
    const take = Math.min(500, parseInt(limit, 10));

    const where = {
      deleted_at: null,
      is_visible: true,
    };

    if (search && search.trim() !== "") {
      const q = search.trim();
      const searchConditions = [
        { common_name: { contains: q, mode: "insensitive" } },
        { scientificName: { contains: q, mode: "insensitive" } },
      ];
      if (/^SPEC[-_]?[0-9]+/i.test(q)) {
        searchConditions.push({ code: { equals: q, mode: "insensitive" } });
      }
      where.OR = searchConditions;
    }

    if (zone && zone.trim() !== "") {
      where.east_sea_zone = { contains: zone.trim(), mode: "insensitive" };
    }

    if (redList && redList.trim() !== "") {
      where.vietnam_red_list_status = redList.trim();
    }

    if (groupId) {
      where.group_id = BigInt(groupId);
    } else if (category && category.trim() !== "") {
      const catTrim = category.trim();
      if (/^\d+$/.test(catTrim)) {
        where.group_id = BigInt(catTrim);
      } else {
        where.species_groups = {
          OR: [
            { slug: { equals: catTrim, mode: "insensitive" } },
            { name: { contains: catTrim, mode: "insensitive" } },
          ],
        };
      }
    }

    let orderBy = [{ id: "asc" }];
    if (sortBy === "az") {
      orderBy = [{ common_name: "asc" }];
    } else if (sortBy === "depth") {
      orderBy = [{ depth_max_m: "asc" }, { depth_min_m: "asc" }];
    } else if (sortBy === "status") {
      orderBy = [{ conservation_status_id: "desc" }, { common_name: "asc" }];
    } else if (sortBy === "views" || sortBy === "popular" || featured === "true") {
      orderBy = [{ view_count: "desc" }];
    } else if (sortBy === "newest") {
      orderBy = [{ created_at: "desc" }];
    }

    const [total, speciesList] = await Promise.all([
      prisma.species.count({ where }),
      prisma.species.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          species_groups: { select: { id: true, name: true, slug: true } },
          conservation_statuses: { select: { id: true, code: true, name: true } },
          ocean_zones: { select: { id: true, name: true } },
          species_media: {
            where: { is_primary: true },
            select: { url: true, caption: true },
            take: 1,
          },
        },
      }),
    ]);

    const formatted = speciesList.map((s) => ({
      id: s.id.toString(),
      code: s.code,
      commonName: s.common_name,
      scientificName: s.scientificName,
      slug: s.slug,
      description: s.description || "",
      group: s.species_groups
        ? {
            id: s.species_groups.id.toString(),
            name: s.species_groups.name,
            slug: s.species_groups.slug,
          }
        : null,
      conservationStatus: s.conservation_statuses ? s.conservation_statuses.code : null,
      vietnamRedListStatus: s.vietnam_red_list_status,
      vietnamProtectionGroup: s.vietnam_protection_group,
      citesAppendix: s.cites_appendix,
      eastSeaZone: s.east_sea_zone,
      localDistribution: s.local_distribution,
      oceanZone: s.ocean_zones ? s.ocean_zones.name : null,
      depthMin: s.depth_min_m,
      depthMax: s.depth_max_m,
      sizeMinCm: s.size_min_cm ? Number(s.size_min_cm) : null,
      sizeMaxCm: s.size_max_cm ? Number(s.size_max_cm) : null,
      weightMinKg: s.weight_min_kg ? Number(s.weight_min_kg) : null,
      weightMaxKg: s.weight_max_kg ? Number(s.weight_max_kg) : null,
      lifespanYears: s.lifespan_years,
      diet: s.diet,
      image: s.species_media?.[0]?.url || "",
      viewCount: Number(s.view_count || 0),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách sinh vật:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:id/anatomy - Lấy danh sách bộ phận giải phẫu sinh vật
router.get("/:id/anatomy", async (req, res) => {
  try {
    const { default: anatomyController } = await import("../controller/anatomyController.js");
    return anatomyController.getAnatomyBySpecies(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/related - Lấy tối đa 4 loài sinh vật tương tự thực tế (cùng nhóm / cùng tầng nước)
router.get("/:idOrSlug/related", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    const isNum = /^\d+$/.test(targetSlug);

    const current = isNum
      ? await prisma.species.findUnique({
          where: { id: BigInt(targetSlug) },
          select: { id: true, group_id: true, ocean_zone_id: true, scientificName: true },
        })
      : await prisma.species.findFirst({
          where: { OR: [{ slug: targetSlug }, { slug: idOrSlug }, { code: idOrSlug }], deleted_at: null },
          select: { id: true, group_id: true, ocean_zone_id: true, scientificName: true },
        });

    if (!current) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sinh vật" });
    }

    const includeCfg = {
      species_groups: true,
      conservation_statuses: true,
      ocean_zones: true,
      species_media: {
        where: { type: "image" },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }, { id: "asc" }],
        take: 2,
      },
    };

    const baseNot = {
      deleted_at: null,
      id: { not: current.id },
      scientificName: { not: current.scientificName },
      species_media: { some: { type: "image" } },
    };

    // Truy vấn theo mức độ tương đồng: cùng nhóm & tầng -> cùng nhóm -> cùng tầng
    const [sameGroupAndZone, sameGroup, sameZone] = await Promise.all([
      current.group_id && current.ocean_zone_id
        ? prisma.species.findMany({
            where: { ...baseNot, group_id: current.group_id, ocean_zone_id: current.ocean_zone_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
      current.group_id
        ? prisma.species.findMany({
            where: { ...baseNot, group_id: current.group_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
      current.ocean_zone_id
        ? prisma.species.findMany({
            where: { ...baseNot, ocean_zone_id: current.ocean_zone_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
    ]);

    const seenIds = new Set();
    const seenSciNames = new Set([String(current.scientificName || "").toLowerCase()]);
    const seenImages = new Set();
    const picked = [];

    for (const candidate of [...sameGroupAndZone, ...sameGroup, ...sameZone]) {
      const sid = candidate.id.toString();
      const sciLower = String(candidate.scientificName || "").toLowerCase();
      const imgUrl = candidate.species_media?.[0]?.url || null;

      if (!imgUrl || seenIds.has(sid) || seenSciNames.has(sciLower) || seenImages.has(imgUrl)) {
        continue;
      }
      seenIds.add(sid);
      seenSciNames.add(sciLower);
      seenImages.add(imgUrl);
      picked.push(candidate);
      if (picked.length >= 4) break;
    }

    return res.status(200).json({
      success: true,
      data: picked.map((sp) => ({
        id: sp.id.toString(),
        slug: sp.slug,
        commonName: sp.common_name,
        scientificName: sp.scientificName,
        image: sp.species_media?.[0]?.url || null,
        group: sp.species_groups
          ? { id: sp.species_groups.id.toString(), name: sp.species_groups.name, slug: sp.species_groups.slug }
          : null,
        oceanZone: sp.ocean_zones ? { id: sp.ocean_zones.id, name: sp.ocean_zones.name } : null,
        sizeMinCm: sp.size_min_cm,
        sizeMaxCm: sp.size_max_cm,
        depthMinM: sp.depth_min_m,
        depthMaxM: sp.depth_max_m,
        conservationStatus: sp.conservation_statuses
          ? { id: sp.conservation_statuses.id, code: sp.conservation_statuses.code, name: sp.conservation_statuses.name }
          : null,
        vietnamRedListStatus: sp.vietnam_red_list_status,
      })),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách sinh vật tương tự:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug - Chi tiết một loài sinh vật biển
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);

    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        include: {
          species_groups: true,
          conservation_statuses: true,
          ocean_zones: true,
          species_media: true,
          species_facts: true,
        },
      });
    }

    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        include: {
          species_groups: true,
          conservation_statuses: true,
          ocean_zones: true,
          species_media: true,
          species_facts: true,
        },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    const taxonomy = await taxonomyService.getTaxonHierarchy(
      species.source_api_id,
      species.scientificName
    );

    return res.status(200).json({
      success: true,
      data: {
        id: species.id.toString(),
        code: species.code,
        commonName: species.common_name,
        scientificName: species.scientificName,
        slug: species.slug,
        description: species.description,
        diet: species.diet,
        sizeMinCm: species.size_min_cm,
        sizeMaxCm: species.size_max_cm,
        weightMinKg: species.weight_min_kg,
        weightMaxKg: species.weight_max_kg,
        depthMinM: species.depth_min_m,
        depthMaxM: species.depth_max_m,
        temperatureMinC: species.temperature_min_c,
        temperatureMaxC: species.temperature_max_c,
        lifespanYears: species.lifespan_years,
        sourceApiId: species.source_api_id,
        taxonomy,
        vietnamRedListStatus: species.vietnam_red_list_status,
        vietnamProtectionGroup: species.vietnam_protection_group,
        citesAppendix: species.cites_appendix,
        eastSeaZone: species.east_sea_zone,
        localDistribution: species.local_distribution,
        group: species.species_groups
          ? { id: species.species_groups.id.toString(), name: species.species_groups.name, slug: species.species_groups.slug }
          : null,
        conservationStatus: species.conservation_statuses
          ? { id: species.conservation_statuses.id, code: species.conservation_statuses.code, name: species.conservation_statuses.name }
          : null,
        oceanZone: species.ocean_zones
          ? { id: species.ocean_zones.id, name: species.ocean_zones.name }
          : null,
        media: species.species_media.map((m) => ({
          id: m.id.toString(),
          type: m.type,
          url: m.url,
          caption: m.caption,
          isPrimary: m.is_primary,
        })),
        facts: species.species_facts.map((f) => ({
          id: f.id.toString(),
          content: f.content,
        })),
        viewCount: Number(species.view_count || 0),
        soundUrl: species.sound_url || null,
        model3dUrl: species.model_3d_url || null,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết loài:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

