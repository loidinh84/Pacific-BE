import prisma from "../lib/prisma.js";

/**
 * ecosystemService.js
 * Dịch vụ xử lý Hệ tri thức & Đồ thị Sinh thái Biển Đông (Knowledge Graph & Trophic Network)
 */

// Định nghĩa nhãn & màu sắc trực quan cho các loại quan hệ sinh thái
export const RELATIONSHIP_META = {
  predator_prey: {
    label: "Ăn thịt / Con mồi",
    verb: "săn bắt / ăn",
    reverseVerb: "bị ăn bởi",
    color: "#ef4444", // Đỏ cảnh báo
    lineStyle: "solid",
  },
  herbivory: {
    label: "Ăn thực vật / Gặm cỏ",
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
    label: "Cung cấp nơi ở / Sinh cảnh",
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
      if (zone && species.east_sea_zone && !species.east_sea_zone.toLowerCase().includes(zone.toLowerCase())) {
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
      "octopus": "bach-tuoc-khong-lo",
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

    // 3. Phân loại theo vai trò sinh thái
    const prey = []; // Thức ăn / loài bị loài này ăn
    const predators = []; // Kẻ săn mồi ăn loài này
    const symbionts = []; // Cộng sinh / tương hỗ
    const habitats = []; // Môi trường / sinh cảnh
    const competitors = []; // Cạnh tranh

    // Xử lý outgoing: Species -> Target
    for (const r of outgoing) {
      const tgt = r.target_species;
      const item = {
        relationshipId: r.id.toString(),
        speciesId: tgt.id.toString(),
        name: tgt.common_name,
        scientificName: tgt.scientificName,
        slug: tgt.slug,
        groupName: tgt.species_groups?.name || "Khác",
        redList: tgt.vietnam_red_list_status || "LC",
        image: tgt.species_media?.[0]?.url || "",
        relationshipType: r.relationship_type,
        relationshipLabel: RELATIONSHIP_META[r.relationship_type]?.label || r.relationship_type,
        description: r.description,
        ecologicalImpact: r.ecological_impact,
        direction: "outgoing",
      };

      if (r.relationship_type === "predator_prey" || r.relationship_type === "herbivory") {
        prey.push(item);
      } else if (r.relationship_type === "symbiosis" || r.relationship_type === "commensalism") {
        symbionts.push(item);
      } else if (r.relationship_type === "habitat_provider") {
        habitats.push(item);
      } else if (r.relationship_type === "competitor") {
        competitors.push(item);
      }
    }

    // Xử lý incoming: Source -> Species
    for (const r of incoming) {
      const src = r.source_species;
      const item = {
        relationshipId: r.id.toString(),
        speciesId: src.id.toString(),
        name: src.common_name,
        scientificName: src.scientificName,
        slug: src.slug,
        groupName: src.species_groups?.name || "Khác",
        redList: src.vietnam_red_list_status || "LC",
        image: src.species_media?.[0]?.url || "",
        relationshipType: r.relationship_type,
        relationshipLabel: RELATIONSHIP_META[r.relationship_type]?.label || r.relationship_type,
        description: r.description,
        ecologicalImpact: r.ecological_impact,
        direction: "incoming",
      };

      if (r.relationship_type === "predator_prey") {
        predators.push(item);
      } else if (r.relationship_type === "symbiosis" || r.relationship_type === "commensalism") {
        symbionts.push(item);
      } else if (r.relationship_type === "habitat_provider") {
        habitats.push(item);
      } else if (r.relationship_type === "competitor") {
        competitors.push(item);
      }
    }

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
        redList: species.vietnam_red_list_status || "Chưa đánh giá",
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
          redList: otherSpecies.vietnam_red_list_status || "LC",
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
          vietnamRedListStatus: species.vietnam_red_list_status,
          vietnamProtectionGroup: species.vietnam_protection_group,
          citesAppendix: species.cites_appendix,
          eastSeaZone: species.east_sea_zone,
          localDistribution: species.local_distribution,
          diet: species.diet,
        },
        ecologicalRoles: {
          prey,
          predators,
          symbionts,
          habitats,
          competitors,
        },
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
    const [totalSpecies, redListGroups, zones, totalRelationships] = await Promise.all([
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
    } else if (qClean.includes("ke san moi") || qClean.includes("san moi") || qClean.includes("san bat") || qClean.includes("an thit")) {
      relType = "predator_prey";
      isLookingForPredator = true;
    } else if (qClean.includes("con moi") || qClean.includes("thuc an cua") || qClean.includes("an con gi") || qClean.includes("bi an")) {
      relType = "predator_prey";
      isLookingForPrey = true;
    } else if (qClean.includes("cong sinh") || qClean.includes("tuong ho") || qClean.includes("symbiosis")) {
      relType = "symbiosis";
    } else if (qClean.includes("co bien") || qClean.includes("an co") || qClean.includes("thuc vat") || qClean.includes("gam co")) {
      relType = "herbivory";
    } else if (qClean.includes("noi o") || qClean.includes("cu tru") || qClean.includes("sinh canh") || qClean.includes("nuong tua")) {
      relType = "habitat_provider";
    } else if (qClean.includes("ky sinh")) {
      relType = "parasitism";
    }

    // Nhận diện Sách Đỏ với regex từ nguyên vẹn
    let redListStatus = null;
    if (qClean.includes("cuc ky nguy cap") || /\bcr\b/i.test(qClean)) {
      redListStatus = "CR";
    } else if (qClean.includes("nguy cap") || /\ben\b/i.test(qClean)) {
      redListStatus = "EN";
    } else if (qClean.includes("sap nguy cap") || /\bvu\b/i.test(qClean)) {
      redListStatus = "VU";
    }

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
        species_media: {
          where: { is_primary: true },
          select: { url: true },
          take: 1,
        },
      },
    });

    let targetFocusSpecies = null;
    for (const sp of allSpecies) {
      const nameVi = (sp.common_name || "").toLowerCase();
      const nameClean = removeDiacritics(sp.common_name || "");
      const sciName = (sp.scientificName || "").toLowerCase();

      // Kiểm tra cả có dấu lẫn không dấu
      if (nameClean.length >= 4 && qClean.includes(nameClean)) {
        targetFocusSpecies = sp;
        break;
      }
      if (nameVi.length >= 3 && q.includes(nameVi)) {
        targetFocusSpecies = sp;
        break;
      }
      if (sciName.length >= 4 && q.includes(sciName)) {
        targetFocusSpecies = sp;
        break;
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
            removeDiacritics(sp.common_name || "").includes(k.name)
          );
          if (targetFocusSpecies) break;
        }
      }
    }

    const results = [];
    const addedSpeciesIds = new Set();

    // 3. Nếu người dùng hỏi về quan hệ của 1 loài cụ thể (e.g. "thiên địch của sao biển gai", "cộng sinh với hải quỳ")
    if (targetFocusSpecies) {
      const rels = await prisma.species_relationships.findMany({
        where: {
          OR: [
            { source_species_id: targetFocusSpecies.id },
            { target_species_id: targetFocusSpecies.id },
          ],
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
              roleLabel = "Con mồi / Thức ăn";
              semanticReason = `${targetFocusSpecies.common_name} săn bắt ${matched.common_name}. ${r.ecological_impact || ""}`;
            } else {
              roleLabel = "Thiên địch / Kẻ săn mồi";
              semanticReason = `${matched.common_name} là thiên địch săn bắt ${targetFocusSpecies.common_name}. ${r.ecological_impact || ""}`;
            }
          } else if (r.relationship_type === "symbiosis") {
            roleLabel = "Cộng sinh tương hỗ";
            semanticReason = `${matched.common_name} cộng sinh tương hỗ chặt chẽ với ${targetFocusSpecies.common_name}. ${r.description || ""}`;
          } else if (r.relationship_type === "habitat_provider") {
            if (isSource) {
              roleLabel = "Cung cấp nơi ở";
              semanticReason = `${targetFocusSpecies.common_name} tạo rạn/nơi ở cho ${matched.common_name}.`;
            } else {
              roleLabel = "Nơi cư trú";
              semanticReason = `${matched.common_name} tạo môi trường cư trú cho ${targetFocusSpecies.common_name}.`;
            }
          }

          results.push({
            id: matched.id.toString(),
            code: matched.code,
            commonName: matched.common_name,
            scientificName: matched.scientificName,
            slug: matched.slug,
            image: matched.species_media?.[0]?.url || "",
            groupName: matched.species_groups?.name || "Sinh vật biển",
            redList: matched.vietnam_red_list_status || "LC",
            zone: matched.east_sea_zone || "Biển Đông",
            role: roleLabel,
            semanticReason: (semanticReason || "").trim(),
            relationshipType: r.relationship_type,
            strength: Number(r.strength || 1.0),
          });
        }
      }
    }

    // 4. Nếu hỏi theo loại quan hệ tổng quát (ví dụ: "loài ăn cỏ biển", "sinh vật tạo nơi ở")
    if (relType && results.length < 10) {
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
        const candidate = isLookingForPrey ? r.target_species : r.source_species;
        const other = isLookingForPrey ? r.source_species : r.target_species;

        if (!addedSpeciesIds.has(candidate.id.toString())) {
          addedSpeciesIds.add(candidate.id.toString());

          let roleTitle = RELATIONSHIP_META[r.relationship_type]?.label || "Quan hệ sinh học";
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
            groupName: candidate.species_groups?.name || "Sinh vật biển",
            redList: candidate.vietnam_red_list_status || "LC",
            zone: candidate.east_sea_zone || "Biển Đông",
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
          ? (sp.east_sea_zone || "").toLowerCase().includes(detectedZone.toLowerCase())
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
            groupName: "Sinh vật Biển Đông",
            redList: sp.vietnam_red_list_status || "LC",
            zone: sp.east_sea_zone || "Biển Đông",
            role: redListStatus ? `Sách Đỏ VN: ${sp.vietnam_red_list_status}` : `Khu bảo tồn: ${detectedZone}`,
            semanticReason: `Phân bố tại vùng biển ${sp.east_sea_zone || "Biển Đông"}. ${sp.local_distribution ? `Địa phương: ${sp.local_distribution}.` : ""}`,
            relationshipType: "habitat_provider",
            strength: 0.9,
          });
        }
      }
    }

    // 6. Fallback từ khóa
    if (results.length === 0) {
      for (const sp of allSpecies) {
        if (addedSpeciesIds.has(sp.id.toString())) continue;
        const nameVi = (sp.common_name || "").toLowerCase();
        const sciName = (sp.scientificName || "").toLowerCase();
        const zone = (sp.east_sea_zone || "").toLowerCase();
        const diet = (sp.diet || "").toLowerCase();

        if (nameVi.includes(q) || sciName.includes(q) || zone.includes(q) || diet.includes(q)) {
          addedSpeciesIds.add(sp.id.toString());
          results.push({
            id: sp.id.toString(),
            code: sp.code,
            commonName: sp.common_name,
            scientificName: sp.scientificName,
            slug: sp.slug,
            image: sp.species_media?.[0]?.url || "",
            groupName: "Sinh vật Biển Đông",
            redList: sp.vietnam_red_list_status || "LC",
            zone: sp.east_sea_zone || "Biển Đông",
            role: "Trùng khớp dữ liệu",
            semanticReason: `Tập tính & Sinh cảnh: ${sp.diet || sp.local_distribution || "Phân bố tự nhiên tại vùng Biển Đông"}`,
            relationshipType: null,
            strength: 0.8,
          });
        }
      }
    }

    return {
      success: true,
      query: rawQuery,
      detectedIntent: {
        relationshipType: relType,
        targetSpecies: targetFocusSpecies ? targetFocusSpecies.common_name : null,
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
        { source_species: { common_name: { contains: term, mode: "insensitive" } } },
        { target_species: { common_name: { contains: term, mode: "insensitive" } } },
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
              species_media: { where: { is_primary: true }, select: { url: true }, take: 1 },
            },
          },
          target_species: {
            select: {
              id: true,
              code: true,
              common_name: true,
              scientificName: true,
              slug: true,
              species_media: { where: { is_primary: true }, select: { url: true }, take: 1 },
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
    const { sourceSpeciesId, targetSpeciesId, relationshipType, strength, description, ecologicalImpact } = data;

    if (!sourceSpeciesId || !targetSpeciesId || !relationshipType) {
      throw new Error("Thiếu thông tin bắt buộc: Loài nguồn, loài đích hoặc kiểu quan hệ.");
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
        ...(ecologicalImpact !== undefined ? { ecological_impact: ecologicalImpact } : {}),
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
