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
    // 1. Tìm thông tin loài
    let species = null;
    const isNum = /^\d+$/.test(idOrSlug);

    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(idOrSlug) },
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
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
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
}

export default new EcosystemService();
