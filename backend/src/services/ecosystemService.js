import prisma from "../lib/prisma.js";
import vectorSearchService from "./vectorSearchService.js";

// ─── GEMINI AI SEMANTIC MATCH HELPER ────────────────────────────────────────
/**
 * Gọi Gemini AI để phân tích câu truy vấn tự nhiên và tìm loài phù hợp nhất.
 * Chỉ được gọi khi toàn bộ các lớp tìm kiếm cục bộ đều thất bại.
 * Trả về danh sách { speciesId, reason } được Gemini đề xuất.
 */
async function callGeminiSemanticMatch(rawQuery, allSpecies) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  // Tạo danh sách loài gọn nhẹ đưa vào prompt với mô tả sinh học thực tế
  const speciesList = allSpecies
    .map((sp) => {
      const descSnippet = (sp.description || "").replace(/\s+/g, " ").slice(0, 180);
      const diet = sp.diet ? ` | Ăn: ${sp.diet}` : "";
      const zone = sp.east_sea_zone ? ` | Vùng: ${sp.east_sea_zone}` : "";
      return `ID:${sp.id} | ${sp.common_name} (${sp.scientificName})${zone}${diet} | Mô tả: ${descSnippet}`;
    })
    .join("\n");

  const prompt = `Bạn là chuyên gia sinh thái và phân loại học biển Việt Nam (Biển Đông).
Người dùng nhập câu tìm kiếm/mô tả bằng tiếng Việt tự nhiên: "${rawQuery}"

Danh sách 29 loài sinh vật biển có trong hệ sinh thái Pacific:
${speciesList}

YÊU CẦU:
1. Phân tích đặc điểm hình thái, tập tính, tên gọi hoặc sinh thái trong câu truy vấn của người dùng.
2. Tìm trong danh sách trên những loài phù hợp nhất với mô tả (tối đa 5 loài).
3. CHỈ CHỌN loài CÓ TRONG danh sách trên theo đúng ID số tương ứng. Nếu truy vấn hoàn toàn không liên quan đến bất kỳ loài nào, hãy trả về [].

Trả về mảng JSON đúng cấu trúc:
[
  {
    "speciesId": 6,
    "role": "Thân hình tròn dẹt",
    "reason": "Cá mặt trăng có thân hình tròn ngắn, dẹt hai bên trông tựa như chiếc đĩa lớn trôi nổi trên đại dương."
  }
]`;

  const models = ["gemini-3-flash-preview", "gemini-3.5-flash"];
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Gemini Semantic] Model ${model} returned status ${response.status}`);
        continue;
      }
      const resData = await response.json();
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item) => item.speciesId && item.reason);
      }
    } catch (err) {
      console.warn(`[Gemini Semantic] Model ${model} error:`, err.message);
    }
  }

  return [];
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ecosystemService.js
 * Dịch vụ xử lý Hệ tri thức & Đồ thị Sinh thái Biển Đông (Knowledge Graph & Trophic Network)
 */

// Định nghĩa nhãn & màu sắc trực quan cho các loại quan hệ sinh thái
export const RELATIONSHIP_META = {
  predator_prey: {
    label: "Vật dữ - Con mồi",
    verb: "săn bắt",
    reverseVerb: "bị săn bắt bởi",
    color: "#ef4444", // Đỏ cảnh báo
    lineStyle: "solid",
  },
  herbivory: {
    label: "Ăn thực vật",
    verb: "ăn thực vật",
    reverseVerb: "là nguồn thức ăn cho",
    color: "#84cc16", // Xanh lá mạ
    lineStyle: "solid",
  },
  symbiosis: {
    label: "Cộng sinh tương hỗ",
    verb: "cộng sinh cùng",
    reverseVerb: "cộng sinh cùng",
    color: "#3b82f6", // Xanh dương tươi
    lineStyle: "dashed",
  },
  commensalism: {
    label: "Hội sinh",
    verb: "hội sinh cùng",
    reverseVerb: "mang lại lợi ích cho",
    color: "#06b6d4", // Xanh ngọc
    lineStyle: "dotted",
  },
  parasitism: {
    label: "Ký sinh",
    verb: "ký sinh trên",
    reverseVerb: "bị ký sinh bởi",
    color: "#a855f7", // Tím
    lineStyle: "dashed",
  },
  competitor: {
    label: "Cạnh tranh sinh thái",
    verb: "cạnh tranh với",
    reverseVerb: "cạnh tranh với",
    color: "#f97316", // Cam
    lineStyle: "dashed",
  },
  habitat_provider: {
    label: "Kiến tạo sinh cảnh",
    verb: "tạo nơi cư trú cho",
    reverseVerb: "nương tựa vào",
    color: "#10b981", // Xanh lục ngọc
    lineStyle: "solid",
  },
};

// Bảng màu cho từng nhóm loài
export const GROUP_COLORS = {
  1: "#38bdf8", // Cá biển - Xanh biển
  2: "#818cf8", // Thú biển - Tím lavender
  3: "#f59e0b", // Bò sát biển - Vàng hổ phách
  4: "#ec4899", // Thân mềm & Giáp xác - Hồng san hô
  5: "#10b981", // San hô & Thực vật - Xanh ngọc lục
  6: "#6366f1", // Biển sâu - Tím đậm
};

// Hàm loại bỏ dấu tiếng Việt để tìm kiếm ngữ nghĩa linh hoạt
const removeDiacritics = (str = "") => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
};

class EcosystemService {
  /**
   * Lấy toàn bộ hoặc một phần Đồ thị Tri thức (Knowledge Graph) phục vụ ECharts / D3.js
   */
  async getKnowledgeGraph(filters = {}) {
    const { zone, groupId, redList, limit = 100 } = filters;

    // Điều kiện lọc liên kết
    const whereRel = {};
    if (filters.type) {
      whereRel.relationship_type = filters.type;
    }

    // 1. Lấy danh sách liên kết
    const relationships = await prisma.species_relationships.findMany({
      where: whereRel,
      take: parseInt(limit, 10),
      include: {
        source_species: {
          select: {
            id: true,
            code: true,
            common_name: true,
            scientificName: true,
            slug: true,
            group_id: true,
            vietnam_red_list_status: true,
            east_sea_zone: true,
            depth_min_m: true,
            depth_max_m: true,
            species_media: {
              where: { is_primary: true },
              select: { url: true },
              take: 1,
            },
          },
        },
        target_species: {
          select: {
            id: true,
            code: true,
            common_name: true,
            scientificName: true,
            slug: true,
            group_id: true,
            vietnam_red_list_status: true,
            east_sea_zone: true,
            depth_min_m: true,
            depth_max_m: true,
            species_media: {
              where: { is_primary: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    });

    // 2. Thu thập danh sách các Nodes độc nhất
    const nodesMap = new Map();

    const addNode = (species) => {
      if (!species || nodesMap.has(species.id.toString())) return;

      // Áp dụng bộ lọc tùy chọn nếu có
      if (
        zone &&
        species.east_sea_zone &&
        !species.east_sea_zone.toLowerCase().includes(zone.toLowerCase())
      ) {
        return;
      }
      if (groupId && species.group_id?.toString() !== groupId.toString()) {
        return;
      }
      if (redList && species.vietnam_red_list_status !== redList) {
        return;
      }

      const gId = Number(species.group_id || 1);
      nodesMap.set(species.id.toString(), {
        id: species.id.toString(),
        name: species.common_name,
        scientificName: species.scientificName,
        code: species.code,
        slug: species.slug,
        groupId: gId,
        redList: species.vietnam_red_list_status || "Chưa đánh giá",
        eastSeaZone: species.east_sea_zone || "Biển Đông",
        depthMin: species.depth_min_m,
        depthMax: species.depth_max_m,
        image: species.species_media?.[0]?.url || "",
        color: GROUP_COLORS[gId] || "#94a3b8",
        symbolSize: 38,
      });
    };

    // Nạp tất cả species liên quan
    for (const rel of relationships) {
      addNode(rel.source_species);
      addNode(rel.target_species);
    }

    // 3. Chuẩn hóa danh sách Links
    const links = [];
    for (const rel of relationships) {
      const srcId = rel.source_species_id.toString();
      const tgtId = rel.target_species_id.toString();

      // Chỉ tạo link nếu cả 2 node đều thỏa mãn bộ lọc
      if (nodesMap.has(srcId) && nodesMap.has(tgtId)) {
        const meta = RELATIONSHIP_META[rel.relationship_type] || {};
        links.push({
          id: rel.id.toString(),
          source: srcId,
          target: tgtId,
          type: rel.relationship_type,
          label: meta.label || rel.relationship_type,
          description: rel.description,
          strength: Number(rel.strength || 1.0),
          ecologicalImpact: rel.ecological_impact,
          lineColor: meta.color || "#64748b",
          lineStyle: meta.lineStyle || "solid",
        });
      }
    }

    return {
      success: true,
      data: {
        nodes: Array.from(nodesMap.values()),
        links,
        totalNodes: nodesMap.size,
        totalLinks: links.length,
        meta: RELATIONSHIP_META,
      },
    };
  }

  /**
   * Lấy hệ sinh thái & quan hệ mạng lưới của một loài cụ thể (Ego Network)
   */
  async getSpeciesEcosystem(idOrSlug) {
    // 1. Tìm thông tin loài (hỗ trợ alias từ mockup / tiếng Anh)
    const SLUG_ALIASES = {
      "giant-octopus-3": "bach-tuoc-khong-lo",
      octopus: "bach-tuoc-khong-lo",
      "whale-shark": "ca-map-voi-nham-voi",
      "whale-shark-2": "ca-map-voi-nham-voi",
      "bluefin-tuna-1": "ca-ngu-vay-vang-dai-duong",
      "great-white-shark-1": "great-white-shark-1",
    };
    const targetSlug = SLUG_ALIASES[idOrSlug] || idOrSlug;

    let species = null;
    const isNum = /^\d+$/.test(targetSlug);

    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        include: {
          species_groups: true,
          conservation_statuses: true,
          species_media: true,
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
          species_media: true,
        },
      });
    }

    if (!species) {
      return { success: false, message: "Không tìm thấy loài sinh vật" };
    }

    // 2. Tìm tất cả quan hệ xuất phát (outgoing) và hướng đến (incoming)
    const [outgoing, incoming] = await Promise.all([
      prisma.species_relationships.findMany({
        where: { source_species_id: species.id },
        include: {
          target_species: {
            include: {
              species_groups: true,
              species_media: { where: { is_primary: true }, take: 1 },
            },
          },
        },
      }),
      prisma.species_relationships.findMany({
        where: { target_species_id: species.id },
        include: {
          source_species: {
            include: {
              species_groups: true,
              species_media: { where: { is_primary: true }, take: 1 },
            },
          },
        },
      }),
    ]);

    // 3. Phân loại theo vai trò sinh thái bằng ROLE_MAP nhất quán
    const roles = {
      prey: [],
      predators: [],
      symbionts: [],
      habitats: [],
      competitors: [],
      parasites: [],
      hosts: [],
      dwellers: [],
    };

    const ROLE_MAP = {
      predator_prey: { outgoing: "prey", incoming: "predators" },
      herbivory: { outgoing: "prey", incoming: "predators" },
      parasitism: { outgoing: "hosts", incoming: "parasites" },
      symbiosis: { outgoing: "symbionts", incoming: "symbionts" },
      commensalism: { outgoing: "symbionts", incoming: "symbionts" },
      habitat_provider: { outgoing: "dwellers", incoming: "habitats" },
      competitor: { outgoing: "competitors", incoming: "competitors" },
    };

    const toRoleItem = (r, other, dir) => ({
      relationshipId: r.id.toString(),
      speciesId: other.id.toString(),
      name: other.common_name,
      scientificName: other.scientificName,
      slug: other.slug,
      groupName: other.species_groups?.name || "Khác",
      redList: other.vietnam_red_list_status ?? "NE",
      image: other.species_media?.[0]?.url || "",
      relationshipType: r.relationship_type,
      relationshipLabel:
        RELATIONSHIP_META[r.relationship_type]?.label || r.relationship_type,
      description: r.description,
      ecologicalImpact: r.ecological_impact,
      strength: r.strength ? parseFloat(r.strength) : 1,
      direction: dir,
    });

    const pushRole = (rel, other, dir) => {
      const bucket = ROLE_MAP[rel.relationship_type]?.[dir];
      if (bucket && roles[bucket]) {
        roles[bucket].push(toRoleItem(rel, other, dir));
      }
    };

    outgoing.forEach((r) => pushRole(r, r.target_species, "outgoing"));
    incoming.forEach((r) => pushRole(r, r.source_species, "incoming"));

    // 4. Tạo Ego Graph nhỏ sẵn sàng cho Frontend vẽ đồ thị
    const egoNodes = [
      {
        id: species.id.toString(),
        name: species.common_name,
        scientificName: species.scientificName,
        code: species.code,
        slug: species.slug,
        isCenter: true,
        groupId: Number(species.group_id || 1),
        redList: species.vietnam_red_list_status ?? "NE",
        image: species.species_media?.[0]?.url || "",
        color: "#3b82f6",
        symbolSize: 52,
      },
    ];

    const egoLinks = [];
    const addedNodeIds = new Set([species.id.toString()]);

    const addEgoRelation = (rel, otherSpecies, isOutgoing) => {
      const otherId = otherSpecies.id.toString();
      if (!addedNodeIds.has(otherId)) {
        addedNodeIds.add(otherId);
        const gId = Number(otherSpecies.group_id || 1);
        egoNodes.push({
          id: otherId,
          name: otherSpecies.common_name,
          scientificName: otherSpecies.scientificName,
          code: otherSpecies.code,
          slug: otherSpecies.slug,
          isCenter: false,
          groupId: gId,
          redList: otherSpecies.vietnam_red_list_status ?? "NE",
          image: otherSpecies.species_media?.[0]?.url || "",
          color: GROUP_COLORS[gId] || "#94a3b8",
          symbolSize: 36,
        });
      }

      const meta = RELATIONSHIP_META[rel.relationship_type] || {};
      egoLinks.push({
        id: rel.id.toString(),
        source: isOutgoing ? species.id.toString() : otherId,
        target: isOutgoing ? otherId : species.id.toString(),
        type: rel.relationship_type,
        label: meta.label || rel.relationship_type,
        description: rel.description,
        ecologicalImpact: rel.ecological_impact,
        strength: rel.strength ? parseFloat(rel.strength) : 1,
        lineColor: meta.color || "#64748b",
        lineStyle: meta.lineStyle || "solid",
      });
    };

    for (const r of outgoing) addEgoRelation(r, r.target_species, true);
    for (const r of incoming) addEgoRelation(r, r.source_species, false);

    return {
      success: true,
      data: {
        species: {
          id: species.id.toString(),
          code: species.code,
          commonName: species.common_name,
          scientificName: species.scientificName,
          slug: species.slug,
          vietnamRedListStatus: species.vietnam_red_list_status ?? "NE",
          vietnamProtectionGroup: species.vietnam_protection_group,
          citesAppendix: species.cites_appendix,
          eastSeaZone: species.east_sea_zone,
          localDistribution: species.local_distribution,
          diet: species.diet,
        },
        centerSpecies: {
          id: species.id.toString(),
          name: species.common_name,
          scientificName: species.scientificName,
          slug: species.slug,
          code: species.code,
          redList: species.vietnam_red_list_status ?? "NE",
          image: species.species_media?.[0]?.url || "",
          eastSeaZone: species.east_sea_zone || "Biển Đông",
        },
        ecologicalRoles: roles,
        graph: {
          nodes: egoNodes,
          links: egoLinks,
        },
      },
    };
  }

  /**
   * Thống kê tổng hợp đa dạng sinh học Biển Đông
   */
  async getEastSeaStats() {
    const [totalSpecies, redListGroups, zones, totalRelationships] =
      await Promise.all([
        prisma.species.count({
          where: { east_sea_zone: { not: null }, deleted_at: null },
        }),
        prisma.species.groupBy({
          by: ["vietnam_red_list_status"],
          where: { east_sea_zone: { not: null }, deleted_at: null },
          _count: { id: true },
        }),
        prisma.species.groupBy({
          by: ["east_sea_zone"],
          where: { east_sea_zone: { not: null }, deleted_at: null },
          _count: { id: true },
        }),
        prisma.species_relationships.count(),
      ]);

    return {
      success: true,
      data: {
        totalSpecies,
        totalRelationships,
        redListDistribution: redListGroups.map((r) => ({
          status: r.vietnam_red_list_status || "NE",
          count: r._count.id,
        })),
        zoneDistribution: zones.map((z) => ({
          zone: z.east_sea_zone,
          count: z._count.id,
        })),
      },
    };
  }

  /**
   * ─── 4. BỘ MÁY TÌM KIẾM NGỮ NGHĨA (SEMANTIC SEARCH ENGINE) ─────────────
   * Nhận diện ngôn ngữ tự nhiên về chuỗi thức ăn, quan hệ sinh học và phân vùng Biển Đông
   */
  async searchSemantic(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
      return {
        success: true,
        query: "",
        detectedIntent: null,
        data: [],
        suggestions: [
          "Thiên địch của sao biển gai",
          "Cộng sinh với hải quỳ",
          "Sinh vật cực kỳ nguy cấp ở Côn Đảo",
          "Loài ăn san hô ở Biển Đông",
          "Loài ăn cỏ biển ở Phú Quốc",
          "Sinh vật tạo nơi cư trú",
          "Cá mập săn mồi đại dương",
        ],
      };
    }

    const q = rawQuery.trim().toLowerCase();
    const qClean = removeDiacritics(q);

    // 1. Phân tích ngữ nghĩa (Intent Detection)
    let relType = null;
    let isLookingForPredator = false;
    let isLookingForPrey = false;

    if (qClean.includes("thien dich") || qClean.includes("khac tinh")) {
      relType = "predator_prey";
      isLookingForPredator = true;
    } else if (
      qClean.includes("ke san moi") ||
      qClean.includes("san moi") ||
      qClean.includes("san bat") ||
      qClean.includes("an thit")
    ) {
      relType = "predator_prey";
      isLookingForPredator = true;
    } else if (
      qClean.includes("con moi") ||
      qClean.includes("thuc an cua") ||
      qClean.includes("an con gi") ||
      qClean.includes("bi an")
    ) {
      relType = "predator_prey";
      isLookingForPrey = true;
    } else if (
      qClean.includes("cong sinh") ||
      qClean.includes("tuong ho") ||
      qClean.includes("symbiosis")
    ) {
      relType = "symbiosis";
    } else if (
      qClean.includes("co bien") ||
      qClean.includes("an co") ||
      qClean.includes("thuc vat") ||
      qClean.includes("gam co")
    ) {
      relType = "herbivory";
    } else if (
      qClean.includes("noi o") ||
      qClean.includes("cu tru") ||
      qClean.includes("sinh canh") ||
      qClean.includes("nuong tua")
    ) {
      relType = "habitat_provider";
    } else if (qClean.includes("ky sinh")) {
      relType = "parasitism";
    }

    // Nhận diện Sách Đỏ với regex từ nguyên vẹn (ưu tiên kiểm tra cụm dài trước)
    let redListStatus = null;
    const isRedListExplicit =
      qClean.includes("sach do") ||
      qClean.includes("red list") ||
      qClean.includes("bao ton") ||
      qClean.includes("nguy cap");
    const hasWord = (p) => new RegExp(`(^|\\s)${p}(\\s|$)`, "i").test(qClean);

    if (hasWord("tuyet chung trong tu nhien") || (isRedListExplicit && hasWord("ew")) || qClean === "ew")
      redListStatus = "EW";
    else if (hasWord("tuyet chung") || (isRedListExplicit && hasWord("ex")) || qClean === "ex")
      redListStatus = "EX";
    else if (hasWord("cuc ky nguy cap") || (isRedListExplicit && hasWord("cr")) || qClean === "cr")
      redListStatus = "CR";
    else if (hasWord("sap nguy cap") || (isRedListExplicit && hasWord("vu")) || qClean === "vu")
      redListStatus = "VU";
    else if (hasWord("nguy cap") || (isRedListExplicit && hasWord("en")) || qClean === "en")
      redListStatus = "EN";
    else if (
      hasWord("gan de doa") ||
      hasWord("gan bi de doa") ||
      (isRedListExplicit && hasWord("nt")) ||
      qClean === "nt"
    )
      redListStatus = "NT";
    else if (hasWord("it quan tam") || (isRedListExplicit && hasWord("lc")) || qClean === "lc")
      redListStatus = "LC";
    else if (hasWord("thieu du lieu") || (isRedListExplicit && hasWord("dd")) || qClean === "dd")
      redListStatus = "DD";
    else if (hasWord("chua danh gia") || (isRedListExplicit && hasWord("ne")) || qClean === "ne")
      redListStatus = "NE";

    // Nhận diện Phân vùng Biển Đông
    let detectedZone = null;
    const zonesList = [
      { name: "Côn Đảo", clean: "con dao" },
      { name: "Trường Sa", clean: "truong sa" },
      { name: "Hoàng Sa", clean: "hoang sa" },
      { name: "Nha Trang", clean: "nha trang" },
      { name: "Cù Lao Chàm", clean: "cu lao cham" },
      { name: "Phú Quốc", clean: "phu quoc" },
      { name: "Cần Giờ", clean: "can gio" },
      { name: "Bạch Long Vĩ", clean: "bach long vi" },
    ];
    for (const z of zonesList) {
      if (qClean.includes(z.clean)) {
        detectedZone = z.name;
        break;
      }
    }

    // Nhận diện đặc điểm hình thái & tập tính (Morphology & Behavior Traits)
    let traitQuery = null;
    let traitLabel = null;
    if (
      qClean.includes("hinh tron") ||
      qClean.includes("tron") ||
      qClean.includes("dia tron") ||
      qClean.includes("hinh dia") ||
      qClean.includes("dia")
    ) {
      traitQuery = "round_shape";
      traitLabel = "Thân hình tròn / Dạng đĩa";
    } else if (
      qClean.includes("co gai") ||
      qClean.includes("nhieu gai") ||
      qClean.includes("gai goc")
    ) {
      traitQuery = "spines";
      traitLabel = "Thân có gai nhọn";
    } else if (
      qClean.includes("phat quang") ||
      qClean.includes("phat sang") ||
      qClean.includes("chieu sang")
    ) {
      traitQuery = "bioluminescent";
      traitLabel = "Phát quang sinh học";
    } else if (
      qClean.includes("noc doc") ||
      qClean.includes("co doc") ||
      qClean.includes("nguy hiem nhat")
    ) {
      traitQuery = "venomous";
      traitLabel = "Có nọc độc / Nguy hiểm";
    } else if (
      qClean.includes("nguy trang") ||
      qClean.includes("bien mau") ||
      qClean.includes("doi mau")
    ) {
      traitQuery = "camouflage";
      traitLabel = "Ngụy trang ẩn mình";
    } else if (
      qClean.includes("to nhat") ||
      qClean.includes("lon nhat") ||
      qClean.includes("khong lo")
    ) {
      traitQuery = "giant";
      traitLabel = "Kích thước khổng lồ";
    } else if (
      qClean.includes("hinh bua") ||
      qClean.includes("dau bua")
    ) {
      traitQuery = "hammer_head";
      traitLabel = "Đầu hình búa";
    }

    // 2. Lấy toàn bộ sinh vật để đối chiếu tên & thực thể
    const allSpecies = await prisma.species.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        code: true,
        common_name: true,
        scientificName: true,
        slug: true,
        group_id: true,
        vietnam_red_list_status: true,
        vietnam_protection_group: true,
        east_sea_zone: true,
        local_distribution: true,
        diet: true,
        description: true,
        depth_min_m: true,
        depth_max_m: true,
        species_groups: {
          select: { name: true },
        },
        species_media: {
          where: { is_primary: true },
          select: { url: true },
          take: 1,
        },
      },
    });

    // Nhận diện loài ưu tiên tên dài nhất (tránh "cá mập trắng lớn" bị khớp nhầm "cá mập")
    let targetFocusSpecies = null;
    let bestLen = 0;
    for (const sp of allSpecies) {
      const nameVi = (sp.common_name || "").toLowerCase();
      const nameClean = removeDiacritics(sp.common_name || "");
      const sciName = (sp.scientificName || "").toLowerCase();

      for (const candidate of [nameClean, nameVi, sciName]) {
        if (
          candidate.length >= 3 &&
          (qClean.includes(candidate) || q.toLowerCase().includes(candidate))
        ) {
          if (candidate.length > bestLen) {
            targetFocusSpecies = sp;
            bestLen = candidate.length;
          }
        }
      }
    }

    // Nhận diện theo từ khóa đặc trưng nếu chưa tìm thấy loài
    if (!targetFocusSpecies) {
      const keywords = [
        { kw: "sao bien", name: "sao bien gai" },
        { kw: "hai quy", name: "hai quy" },
        { kw: "san ho", name: "san ho" },
        { kw: "ca he", name: "ca he" },
        { kw: "bo bien", name: "bo bien" },
        { kw: "ca map", name: "ca map" },
        { kw: "doi moi", name: "doi moi" },
        { kw: "rua bien", name: "rua" },
        { kw: "oc tu va", name: "oc tu va" },
        { kw: "tom hum", name: "tom hum" },
      ];
      for (const k of keywords) {
        if (qClean.includes(k.kw)) {
          targetFocusSpecies = allSpecies.find((sp) =>
            removeDiacritics(sp.common_name || "").includes(k.name),
          );
          if (targetFocusSpecies) break;
        }
      }
    }

    const results = [];
    const addedSpeciesIds = new Set();

    // 3. Nếu người dùng hỏi về quan hệ của 1 loài cụ thể (e.g. "thiên địch của sao biển gai", "cộng sinh với hải quỳ")
    if (targetFocusSpecies) {
      const directionCondition =
        relType === "predator_prey" && isLookingForPredator
          ? { target_species_id: targetFocusSpecies.id }
          : relType === "predator_prey" && isLookingForPrey
            ? { source_species_id: targetFocusSpecies.id }
            : {
                OR: [
                  { source_species_id: targetFocusSpecies.id },
                  { target_species_id: targetFocusSpecies.id },
                ],
              };

      const rels = await prisma.species_relationships.findMany({
        where: {
          ...directionCondition,
          ...(relType ? { relationship_type: relType } : {}),
        },
        include: {
          source_species: {
            include: {
              species_media: { where: { is_primary: true }, take: 1 },
              species_groups: { select: { name: true } },
            },
          },
          target_species: {
            include: {
              species_media: { where: { is_primary: true }, take: 1 },
              species_groups: { select: { name: true } },
            },
          },
        },
      });

      for (const r of rels) {
        const isSource = r.source_species_id === targetFocusSpecies.id;
        const matched = isSource ? r.target_species : r.source_species;

        if (!addedSpeciesIds.has(matched.id.toString())) {
          addedSpeciesIds.add(matched.id.toString());

          let roleLabel = "Quan hệ sinh thái";
          let semanticReason = r.description || r.ecological_impact;

          if (r.relationship_type === "predator_prey") {
            if (isSource) {
              roleLabel = "Con mồi";
              semanticReason = `Là con mồi bị ${targetFocusSpecies.common_name} săn bắt.`;
            } else {
              roleLabel = "Thiên địch";
              semanticReason = `Là thiên địch săn bắt ${targetFocusSpecies.common_name}, giúp kiểm soát số lượng loài này.`;
            }
          } else if (r.relationship_type === "symbiosis") {
            roleLabel = "Cộng sinh";
            semanticReason = `Cộng sinh tương hỗ chặt chẽ với ${targetFocusSpecies.common_name}.`;
          } else if (r.relationship_type === "habitat_provider") {
            if (isSource) {
              roleLabel = "Tạo sinh cảnh";
              semanticReason = `Tạo rạn hoặc nơi cư trú cho ${matched.common_name}.`;
            } else {
              roleLabel = "Cư trú";
              semanticReason = `Nương tựa vào ${targetFocusSpecies.common_name} làm nơi ở.`;
            }
          }

          results.push({
            id: matched.id.toString(),
            code: matched.code,
            commonName: matched.common_name,
            scientificName: matched.scientificName,
            slug: matched.slug,
            image: matched.species_media?.[0]?.url || "",
            groupName: matched.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
            redList: matched.vietnam_red_list_status || "LC",
            zone: matched.east_sea_zone || "Biển Đông",
            depth: `${matched.depth_min_m ?? 0} - ${matched.depth_max_m ?? 200}m`,
            description: matched.description || "",
            diet: matched.diet || "",
            localDistribution: matched.local_distribution || "",
            role: roleLabel,
            semanticReason: (semanticReason || "").trim(),
            relationshipType: r.relationship_type,
            strength: Number(r.strength || 1.0),
          });
        }
      }
    }

    // 4. Nếu hỏi theo loại quan hệ tổng quát VÀ chưa có loài cụ thể (ví dụ: "loài ăn cỏ biển", "sinh vật tạo nơi ở")
    if (relType && !targetFocusSpecies) {
      const typeRels = await prisma.species_relationships.findMany({
        where: { relationship_type: relType },
        take: 12,
        include: {
          source_species: {
            include: {
              species_media: { where: { is_primary: true }, take: 1 },
              species_groups: { select: { name: true } },
            },
          },
          target_species: {
            include: {
              species_media: { where: { is_primary: true }, take: 1 },
              species_groups: { select: { name: true } },
            },
          },
        },
      });

      for (const r of typeRels) {
        const candidate = isLookingForPrey
          ? r.target_species
          : r.source_species;
        const other = isLookingForPrey ? r.source_species : r.target_species;

        if (!addedSpeciesIds.has(candidate.id.toString())) {
          addedSpeciesIds.add(candidate.id.toString());

          let roleTitle =
            RELATIONSHIP_META[r.relationship_type]?.label || "Quan hệ sinh học";
          let explanation = r.description || r.ecological_impact;
          if (!explanation) {
            explanation = `${candidate.common_name} có quan hệ ${RELATIONSHIP_META[r.relationship_type]?.verb || "liên kết"} với ${other.common_name}.`;
          }

          results.push({
            id: candidate.id.toString(),
            code: candidate.code,
            commonName: candidate.common_name,
            scientificName: candidate.scientificName,
            slug: candidate.slug,
            image: candidate.species_media?.[0]?.url || "",
            groupName: candidate.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
            redList: candidate.vietnam_red_list_status || "LC",
            zone: candidate.east_sea_zone || "Biển Đông",
            depth: `${candidate.depth_min_m ?? 0} - ${candidate.depth_max_m ?? 200}m`,
            description: candidate.description || "",
            diet: candidate.diet || "",
            localDistribution: candidate.local_distribution || "",
            role: roleTitle,
            semanticReason: explanation,
            relationshipType: r.relationship_type,
            strength: Number(r.strength || 1.0),
          });
        }
      }
    }

    // 5. Nếu có tiêu chí Khu vực bảo tồn hoặc Sách Đỏ
    if (detectedZone || redListStatus) {
      for (const sp of allSpecies) {
        if (addedSpeciesIds.has(sp.id.toString())) continue;

        const matchZone = detectedZone
          ? (sp.east_sea_zone || "")
              .toLowerCase()
              .includes(detectedZone.toLowerCase())
          : true;
        const matchRedList = redListStatus
          ? (sp.vietnam_red_list_status || "").toUpperCase() === redListStatus
          : true;

        if (matchZone && matchRedList) {
          addedSpeciesIds.add(sp.id.toString());
          results.push({
            id: sp.id.toString(),
            code: sp.code,
            commonName: sp.common_name,
            scientificName: sp.scientificName,
            slug: sp.slug,
            image: sp.species_media?.[0]?.url || "",
            groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
            redList: sp.vietnam_red_list_status || "LC",
            zone: sp.east_sea_zone || "Biển Đông",
            depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
            description: sp.description || "",
            diet: sp.diet || "",
            localDistribution: sp.local_distribution || "",
            role: redListStatus
              ? `Sách Đỏ VN: ${sp.vietnam_red_list_status}`
              : `Khu bảo tồn: ${detectedZone}`,
            semanticReason: `Phân bố tại vùng biển ${sp.east_sea_zone || "Biển Đông"}. ${sp.local_distribution ? `Địa phương: ${sp.local_distribution}.` : ""}`,
            relationshipType: "habitat_provider",
            strength: 0.9,
          });
        }
      }
    }

    // 5.1 Khớp theo đặc điểm hình thái & tập tính (Morphology & Behavior Traits)
    if (traitQuery) {
      for (const sp of allSpecies) {
        if (addedSpeciesIds.has(sp.id.toString())) continue;
        const nameClean = removeDiacritics(sp.common_name || "");
        const sciClean = removeDiacritics(sp.scientificName || "");

        let roleLabel = traitLabel || "Đặc điểm sinh thái";
        let reason = "";

        let matchStrength = 0.85;

        if (traitQuery === "round_shape") {
          if (nameClean.includes("mat trang") || sciClean.includes("mola")) {
            roleLabel = "Thân tròn dẹt";
            matchStrength = 1.0; // Ưu tiên số 1 cho cá hình tròn
            reason =
              "Thân hình tròn dẹt đặc trưng như chiếc đĩa khổng lồ, thường bơi phơi mình dưới ánh nắng tầng mặt.";
          } else if (
            nameClean.includes("san ho nao") ||
            sciClean.includes("platygyra")
          ) {
            roleLabel = "Khối bán cầu tròn";
            matchStrength = 0.9;
            reason =
              "Cấu trúc tạo rạn hình khối bán cầu tròn gồ ghề các rãnh cuộn như bộ não.";
          } else if (
            nameClean.includes("ca he ") ||
            sciClean.includes("amphiprion")
          ) {
            roleLabel = "Thân bầu dục tròn";
            matchStrength = 0.8;
            reason =
              "Thân hình bầu dục tròn dẹt hai bên, bơi luồn lách uyển chuyển quanh hải quỳ.";
          }
        } else if (traitQuery === "spines") {
          if (nameClean.includes("sao bien gai")) {
            roleLabel = "Gai nhọn độc";
            matchStrength = 1.0;
            reason = "Thân bao phủ hàng trăm gai nhọn chứa độc tố saponin.";
          } else if (nameClean.includes("ngua gai")) {
            roleLabel = "Gai xương ngụy trang";
            matchStrength = 0.95;
            reason =
              "Thân phủ các gai xương nhọn giúp ngụy trang hoàn hảo giữa nhánh san hô.";
          }
        } else if (traitQuery === "bioluminescent") {
          if (nameClean.includes("phu du")) {
            roleLabel = "Phát quang sinh học";
            matchStrength = 1.0;
            reason =
              "Chứa tảo phát quang Dinoflagellates phát ra ánh sáng dạ quang xanh biếc ban đêm.";
          }
        } else if (traitQuery === "venomous") {
          if (nameClean.includes("ran bien")) {
            roleLabel = "Nọc độc thần kinh";
            matchStrength = 1.0;
            reason =
              "Nọc độc Myotoxin & Neurotoxin cực mạnh, độc hại gấp nhiều lần rắn hổ đất.";
          } else if (nameClean.includes("sao bien gai")) {
            roleLabel = "Gai độc";
            matchStrength = 0.9;
            reason =
              "Gai nhọn chứa độc tố saponin gây viêm tấy nặng khi đâm phải.";
          }
        } else if (traitQuery === "camouflage") {
          if (nameClean.includes("bach tuoc")) {
            roleLabel = "Bậc thầy ngụy trang";
            matchStrength = 1.0;
            reason =
              "Thay đổi sắc tố màu và vân da tức thời để hòa lẫn vào san hô và đá biển.";
          } else if (nameClean.includes("ngua gai")) {
            roleLabel = "Ngụy trang san hô";
            matchStrength = 0.9;
            reason =
              "Gai nhọn và màu sắc tiệp với cành san hô để trốn kẻ thù.";
          } else if (nameClean.includes("cua huynh de")) {
            roleLabel = "Vùi cát ẩn mình";
            matchStrength = 0.85;
            reason =
              "Ẩn nấp hoàn toàn dưới lớp cát mịn đáy biển để rình bắt mồi.";
          }
        } else if (traitQuery === "giant") {
          if (nameClean.includes("voi") || nameClean.includes("khong lo")) {
            roleLabel = "Kích thước khổng lồ";
            matchStrength = 0.95;
            reason =
              "Loài sinh vật đạt kích thước và trọng lượng kỷ lục trong hệ sinh thái Biển Đông.";
          }
        } else if (traitQuery === "hammer_head") {
          if (nameClean.includes("nham bua")) {
            roleLabel = "Đầu hình búa";
            matchStrength = 1.0;
            reason =
              "Đầu búa dẹt chứa hệ thống cảm biến thụ thể điện từ siêu nhạy để dò tìm con mồi.";
          }
        }

        if (reason) {
          addedSpeciesIds.add(sp.id.toString());
          results.push({
            id: sp.id.toString(),
            code: sp.code,
            commonName: sp.common_name,
            scientificName: sp.scientificName,
            slug: sp.slug,
            image: sp.species_media?.[0]?.url || "",
            groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
            redList: sp.vietnam_red_list_status || "LC",
            zone: sp.east_sea_zone || "Biển Đông",
            depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
            description: sp.description || "",
            diet: sp.diet || "",
            localDistribution: sp.local_distribution || "",
            role: roleLabel,
            semanticReason: reason,
            relationshipType: "morphology",
            strength: matchStrength,
          });
        }
      }

      // Sắp xếp theo độ liên quan giảm dần
      results.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    }

    // 6. Tầng Vector Semantic Search Engine (Gemini 768-dim Embeddings + In-Memory Cosine Similarity)
    // Hoạt động ngầm, siêu nhanh (< 1ms với bộ nhớ đệm), hiểu sâu sắc mọi mô tả ngữ nghĩa sinh học.
    if (results.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const vectorMatches = await vectorSearchService.search(rawQuery, 0.48, 12);

        if (vectorMatches && vectorMatches.length > 0) {
          for (const match of vectorMatches) {
            const sp = allSpecies.find(
              (s) => s.id.toString() === match.speciesId.toString()
            );
            if (!sp || addedSpeciesIds.has(sp.id.toString())) continue;
            addedSpeciesIds.add(sp.id.toString());
            results.push({
              id: sp.id.toString(),
              code: sp.code,
              commonName: sp.common_name,
              scientificName: sp.scientificName,
              slug: sp.slug,
              image: sp.species_media?.[0]?.url || "",
              groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
              redList: sp.vietnam_red_list_status || "LC",
              zone: sp.east_sea_zone || "Biển Đông",
              depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
              description: sp.description || "",
              diet: sp.diet || "",
              localDistribution: sp.local_distribution || "",
              role: null,
              semanticReason: null,
              relationshipType: "vector_semantic",
              strength: match.score,
            });
          }
        }
      } catch (vecErr) {
        console.warn("[Semantic] Vector search error, trying fallback:", vecErr.message);
      }
    }

    // 6.1. Tầng dự phòng Generative AI (chỉ khi vector search chưa có kết quả)
    if (results.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const aiMatches = await callGeminiSemanticMatch(rawQuery, allSpecies);

        for (const match of aiMatches) {
          const sp = allSpecies.find(
            (s) => s.id.toString() === match.speciesId.toString()
          );
          if (!sp || addedSpeciesIds.has(sp.id.toString())) continue;
          addedSpeciesIds.add(sp.id.toString());
          results.push({
            id: sp.id.toString(),
            code: sp.code,
            commonName: sp.common_name,
            scientificName: sp.scientificName,
            slug: sp.slug,
            image: sp.species_media?.[0]?.url || "",
            groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
            redList: sp.vietnam_red_list_status || "LC",
            zone: sp.east_sea_zone || "Biển Đông",
            depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
            description: sp.description || "",
            diet: sp.diet || "",
            localDistribution: sp.local_distribution || "",
            role: null,
            semanticReason: null,
            relationshipType: "ai_semantic",
            strength: 0.95,
            aiGenerated: true,
          });
        }
      } catch (aiErr) {
        console.warn("[Semantic] Gemini AI execution failed, falling back to local tokens:", aiErr.message);
      }
    }

    // 7. Tầng dự phòng cuối: Phân tích & Tách từ khóa cục bộ (Local Token Matching Fallback)
    // Dành cho trường hợp offline, truy vấn từ khóa vắn tắt, hoặc Gemini không trả kết quả.
    if (results.length === 0) {
      const stopWords = new Set([
        "con", "cai", "loai", "nhung", "cac", "nhom", "trong", "hinh", "dang",
        "nhu", "o", "tai", "la", "cua", "va", "co", "biet", "duoc", "tim", "kiem",
        "nao", "gi", "day", "do", "ma", "hay", "hoac", "khi", "voi", "thi", "rat",
        "qua", "kha", "chiec", "mot", "nhat", "ben", "tren", "duoi", "mat", "nuoc",
        "san", "vat", "dong", "sinh"
      ]);

      const tokens = qClean
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !stopWords.has(w));

      const generalKeywords = [
        "sinh vat", "sinh vat bien", "dong vat", "dong vat bien",
        "thuc vat", "thuc vat bien", "bien", "bien dong", "dai duong"
      ];
      const isStrictlyGeneral = generalKeywords.includes(qClean);

      const scoredSpecies = [];

      for (const sp of allSpecies) {
        if (addedSpeciesIds.has(sp.id.toString())) continue;
        const nameClean = removeDiacritics(sp.common_name || "");
        const sciClean = removeDiacritics(sp.scientificName || "");
        const zoneClean = removeDiacritics(sp.east_sea_zone || "");
        const dietClean = removeDiacritics(sp.diet || "");
        const descClean = removeDiacritics(sp.description || "");

        let score = 0;
        let matchedReason = "";

        // Khớp nguyên chuỗi trong tên hoặc mô tả
        if (nameClean.includes(qClean) || sciClean.includes(qClean)) {
          score += 10;
          matchedReason = `Tên loài khớp với từ khóa "${rawQuery}".`;
        } else if (descClean.includes(qClean) || dietClean.includes(qClean)) {
          score += 8;
          matchedReason = `Đặc điểm sinh thái phù hợp với truy vấn.`;
        }

        // Khớp từng token riêng lẻ
        for (const token of tokens) {
          if (nameClean.includes(token)) {
            score += 4;
            if (!matchedReason)
              matchedReason = `Tên loài khớp từ khóa "${token}".`;
          }
          if (descClean.includes(token)) {
            score += 2;
            if (!matchedReason)
              matchedReason = `Đặc điểm hình thái liên quan đến "${token}".`;
          }
          if (dietClean.includes(token) || zoneClean.includes(token)) {
            score += 1;
          }
        }

        // Ưu tiên nhóm loài (ví dụ: truy vấn có "cá")
        if (tokens.includes("ca") && (nameClean.startsWith("ca ") || nameClean.includes(" ca "))) {
          score += 3;
        }

        if (score >= 4 || isStrictlyGeneral) {
          scoredSpecies.push({
            sp,
            score: isStrictlyGeneral ? 1 : score,
            matchedReason:
              matchedReason ||
              `Phân bố tại ${sp.east_sea_zone || "Biển Đông"}. ${sp.diet || ""}`.trim(),
          });
        }
      }

      scoredSpecies.sort((a, b) => b.score - a.score);

      for (const { sp } of scoredSpecies.slice(0, 12)) {
        addedSpeciesIds.add(sp.id.toString());
        results.push({
          id: sp.id.toString(),
          code: sp.code,
          commonName: sp.common_name,
          scientificName: sp.scientificName,
          slug: sp.slug,
          image: sp.species_media?.[0]?.url || "",
          groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
          redList: sp.vietnam_red_list_status || "LC",
          zone: sp.east_sea_zone || "Biển Đông",
          depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
          description: sp.description || "",
          diet: sp.diet || "",
          localDistribution: sp.local_distribution || "",
          role: null,
          semanticReason: null,
          relationshipType: null,
          strength: 0.85,
        });
      }
    }

    return {
      success: true,
      query: rawQuery,
      detectedIntent: {
        relationshipType: relType,
        targetSpecies: targetFocusSpecies
          ? targetFocusSpecies.common_name
          : null,
        zone: detectedZone,
        redList: redListStatus,
      },
      count: results.length,
      data: results,
      suggestions: [
        "Thiên địch của sao biển gai",
        "Cộng sinh với hải quỳ",
        "Sinh vật cực kỳ nguy cấp ở Côn Đảo",
        "Loài ăn san hô ở Biển Đông",
        "Loài ăn cỏ biển ở Phú Quốc",
        "Sinh vật tạo nơi cư trú",
      ],
    };
  }

  /**
   * ─── 5. QUẢN TRỊ MỐI QUAN HỆ SINH THÁI (ADMIN RELATIONSHIP CMS) ───────────
   */
  async getAdminRelationships(params = {}) {
    const { page = 1, limit = 15, search = "", type = "" } = params;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};
    if (type && type.trim() !== "") {
      where.relationship_type = type.trim();
    }

    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        {
          source_species: {
            common_name: { contains: term, mode: "insensitive" },
          },
        },
        {
          target_species: {
            common_name: { contains: term, mode: "insensitive" },
          },
        },
        { description: { contains: term, mode: "insensitive" } },
        { ecological_impact: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.species_relationships.count({ where }),
      prisma.species_relationships.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          source_species: {
            select: {
              id: true,
              code: true,
              common_name: true,
              scientificName: true,
              slug: true,
              species_media: {
                where: { is_primary: true },
                select: { url: true },
                take: 1,
              },
            },
          },
          target_species: {
            select: {
              id: true,
              code: true,
              common_name: true,
              scientificName: true,
              slug: true,
              species_media: {
                where: { is_primary: true },
                select: { url: true },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const formatted = items.map((r) => ({
      id: r.id.toString(),
      sourceSpeciesId: r.source_species_id.toString(),
      sourceSpecies: {
        id: r.source_species.id.toString(),
        code: r.source_species.code,
        commonName: r.source_species.common_name,
        scientificName: r.source_species.scientificName,
        image: r.source_species.species_media?.[0]?.url || "",
      },
      targetSpeciesId: r.target_species_id.toString(),
      targetSpecies: {
        id: r.target_species.id.toString(),
        code: r.target_species.code,
        commonName: r.target_species.common_name,
        scientificName: r.target_species.scientificName,
        image: r.target_species.species_media?.[0]?.url || "",
      },
      relationshipType: r.relationship_type,
      relationshipMeta: RELATIONSHIP_META[r.relationship_type] || {},
      strength: Number(r.strength || 1.0),
      description: r.description,
      ecologicalImpact: r.ecological_impact,
      createdAt: r.created_at,
    }));

    return {
      success: true,
      data: formatted,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async createRelationship(data) {
    const {
      sourceSpeciesId,
      targetSpeciesId,
      relationshipType,
      strength,
      description,
      ecologicalImpact,
    } = data;

    if (!sourceSpeciesId || !targetSpeciesId || !relationshipType) {
      throw new Error(
        "Thiếu thông tin bắt buộc: Loài nguồn, loài đích hoặc kiểu quan hệ.",
      );
    }

    if (sourceSpeciesId.toString() === targetSpeciesId.toString()) {
      throw new Error("Loài nguồn và loài đích không thể trùng nhau.");
    }

    const created = await prisma.species_relationships.create({
      data: {
        source_species_id: BigInt(sourceSpeciesId),
        target_species_id: BigInt(targetSpeciesId),
        relationship_type: relationshipType,
        strength: strength ? parseFloat(strength) : 1.0,
        description: description || null,
        ecological_impact: ecologicalImpact || null,
      },
      include: {
        source_species: { select: { common_name: true } },
        target_species: { select: { common_name: true } },
      },
    });

    return {
      success: true,
      message: `Đã thiết lập quan hệ thành công giữa ${created.source_species.common_name} và ${created.target_species.common_name}`,
      data: {
        id: created.id.toString(),
      },
    };
  }

  async updateRelationship(id, data) {
    const { relationshipType, strength, description, ecologicalImpact } = data;

    const updated = await prisma.species_relationships.update({
      where: { id: BigInt(id) },
      data: {
        ...(relationshipType ? { relationship_type: relationshipType } : {}),
        ...(strength !== undefined ? { strength: parseFloat(strength) } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(ecologicalImpact !== undefined
          ? { ecological_impact: ecologicalImpact }
          : {}),
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: "Cập nhật quan hệ sinh thái thành công",
      data: { id: updated.id.toString() },
    };
  }

  async deleteRelationship(id) {
    await prisma.species_relationships.delete({
      where: { id: BigInt(id) },
    });

    return {
      success: true,
      message: "Đã xóa mối quan hệ sinh thái",
    };
  }
}

export default new EcosystemService();
