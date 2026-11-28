import prisma from "../lib/prisma.js";
import vectorSearchService from "./vectorSearchService.js";

// ─── GEMINI AI QUERY ANALYZER & TOP-K RERANKER ──────────────────────────────
const GEMINI_FAST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
];

// Cache phân tích câu hỏi đời thường / ẩn dụ trong RAM (tối đa 200 truy vấn)
const queryAnalysisCache = new Map();
const MAX_ANALYSIS_CACHE = 200;

/**
 * Phân tích nhanh truy vấn đời thường / ẩn dụ / ngoài chủ đề bằng Gemini Flash-Lite.
 * - Phát hiện truy vấn ngoài lĩnh vực biển (isMarineRelated: false) để tránh trả kết quả rác.
 * - Mở rộng câu hỏi văn hóa đại chúng / đố vui ("đi tìm nemo", "8 cái tua biết đổi màu")
 *   sang thuật ngữ sinh học chuẩn và gợi ý tên loài mục tiêu để Vector + Lexical tìm chính xác.
 */
async function callGeminiQueryAnalyzer(rawQuery) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !rawQuery) return null;

  const cacheKey = rawQuery.trim().toLowerCase();
  if (queryAnalysisCache.has(cacheKey)) {
    return queryAnalysisCache.get(cacheKey);
  }

  const prompt = `Bạn là bộ phân tích truy vấn cho hệ thống tìm kiếm sinh vật biển Biển Đông (Việt Nam).
Truy vấn người dùng: "${rawQuery}"

Nhiệm vụ:
1. Xác định truy vấn có liên quan đến sinh vật biển, đại dương, thủy sinh, rạn san hô, du lịch lặn biển hay sinh thái biển không (isMarineRelated: true/false).
   - Các câu về nấu ăn món trên cạn ("phở bò"), thời tiết đất liền, bóng đá, chứng khoán, chuỗi ký tự vô nghĩa ("asdfghjkl") => isMarineRelated = false.
   - Các câu hỏi đố vui, mô tả hình dáng, nhân vật phim về sinh vật biển ("đi tìm nemo", "8 cái tua biết đổi màu", "bám vào cá mập") => isMarineRelated = true.
2. Nếu isMarineRelated = true:
   - rewrittenQuery: viết lại ngắn gọn (8-20 từ tiếng Việt) chứa tên loài/nhóm loài sinh học và đặc điểm sinh thái tương ứng để tìm vector chính xác.
   - speciesHints: mảng 1-4 tên loài tiếng Việt tiêu biểu nhất khớp với mô tả (VD: ["Cá Hề Ocellaris", "Cá Đuôi Gai Xanh"] hoặc ["Bạch Tuộc Biến Hình", "Bạch Tuộc Đốm Xanh"]).
   - intentNote: 1 cụm từ tiếng Việt tự nhiên, trực tiếp, thân thiện với người đọc (<= 12 từ, KHÔNG viết ngôi thứ ba như "Người dùng muốn tìm...", VD: "Các loài sinh vật biển trong phim Đi tìm Nemo" hoặc "Các loài bạch tuộc có khả năng đổi màu ngụy trang").

Trả về duy nhất 1 JSON object:
{"isMarineRelated": true, "rewrittenQuery": "...", "speciesHints": ["..."], "intentNote": "..."}`;

  for (const model of GEMINI_FAST_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    try {
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

      if (!response.ok) {
        console.warn(`[Gemini Analyzer] Model ${model} returned status ${response.status}`);
        continue;
      }

      const resData = await response.json();
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (typeof parsed?.isMarineRelated === "boolean") {
        if (queryAnalysisCache.size >= MAX_ANALYSIS_CACHE) {
          const firstKey = queryAnalysisCache.keys().next().value;
          queryAnalysisCache.delete(firstKey);
        }
        queryAnalysisCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini Analyzer] Model ${model} error:`, err.message);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Rerank chỉ Top-K (tối đa 15) ứng viên rút ra từ Vector/Lexical khi độ tin cậy thấp.
 * Prompt gọn (~2-3KB thay vì 100KB của toàn bộ 320 loài) giúp phản hồi <2 giây và không timeout.
 */
async function callGeminiRerankCandidates(rawQuery, candidates) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !candidates || candidates.length === 0) return [];

  const shortlist = candidates.slice(0, 15);
  const speciesList = shortlist
    .map((sp) => {
      const descSnippet = (sp.description || "").replace(/\s+/g, " ").slice(0, 180);
      const diet = sp.diet ? ` | Ăn: ${sp.diet.slice(0, 80)}` : "";
      const zone = sp.east_sea_zone ? ` | Vùng: ${sp.east_sea_zone}` : "";
      const depth = ` | Độ sâu: ${sp.depth_min_m ?? 0}-${sp.depth_max_m ?? 200}m`;
      const red = sp.vietnam_red_list_status ? ` | Sách Đỏ: ${sp.vietnam_red_list_status}` : "";
      return `ID:${sp.id} | ${sp.common_name} (${sp.scientificName})${zone}${depth}${red}${diet} | ${descSnippet}`;
    })
    .join("\n");

  const prompt = `Bạn là chuyên gia sinh học biển Biển Đông (Việt Nam).
Truy vấn người dùng: "${rawQuery}"

Dưới đây là ${shortlist.length} loài ứng viên tiềm năng nhất:
${speciesList}

YÊU CẦU:
1. Chọn tối đa 5 loài thực sự phù hợp nhất với truy vấn (theo hình thái, tập tính, thức ăn, độ sâu, độc tính hoặc sinh thái), sắp xếp giảm dần theo mức độ phù hợp.
2. CHỈ chọn ID có trong danh sách trên. Nếu truy vấn không liên quan đến bất kỳ loài nào, trả về [].
3. Viết ngắn gọn role (2-4 từ) và reason (1 câu tiếng Việt tự nhiên giải thích lý do khớp).

Trả về JSON array:
[{"speciesId": 6, "role": "Biển sâu phát quang", "reason": "Loài này có cơ quan phát sáng sinh học để dụ mồi ở tầng nước sâu."}]`;

  for (const model of GEMINI_FAST_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    try {
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

      if (!response.ok) {
        console.warn(`[Gemini Rerank] Model ${model} returned status ${response.status}`);
        continue;
      }
      const resData = await response.json();
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item.speciesId && item.reason);
      }
    } catch (err) {
      console.warn(`[Gemini Rerank] Model ${model} error:`, err.message);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return [];
}

/**
 * Kiểm tra nhanh chuỗi gõ bừa / vô nghĩa (gibberish) trước khi gọi API để tiết kiệm thời gian & quota
 */
function isLikelyGibberish(qClean) {
  if (!qClean || qClean.length < 2) return true;
  if (/^[\d\W_]+$/.test(qClean)) return true;
  const words = qClean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const alphaWords = words.filter((w) => /[a-z]/.test(w));
  if (alphaWords.length === 0) return true;
  // Chuỗi dài chứa toàn phụ âm liên tiếp (>= 5 phụ âm liền kề) hoặc từ gõ bừa tỷ lệ nguyên âm cực thấp
  const hasKeySmash = alphaWords.every((w) => {
    if (w.length >= 6 && /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w)) return true;
    if (w.length >= 9) {
      const vowels = (w.match(/[aeiouy]/gi) || []).length;
      if (vowels / w.length < 0.22) return true;
    }
    return false;
  });
  return hasKeySmash;
}

// ─── CATALOG METADATA CACHE (RAM TTL 5 PHÚT) ────────────────────────────────
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
let speciesCatalogCache = {
  items: null,
  tokenDocFreq: null,
  loadedAt: 0,
};

const LEXICAL_STOP_WORDS = new Set([
  "con", "cai", "loai", "nhung", "cac", "nhom", "trong", "hinh", "dang",
  "nhu", "o", "tai", "la", "cua", "va", "co", "biet", "duoc", "tim", "kiem",
  "nao", "gi", "day", "do", "ma", "hay", "hoac", "khi", "voi", "thi", "rat",
  "qua", "kha", "chiec", "mot", "nhat", "ben", "tren", "duoi", "mat", "nuoc",
  "sinh", "vat", "dong", "song", "the", "hon", "tu", "den", "ve", "cho",
  "the", "and", "for", "with", "that", "this", "from", "are", "what", "which",
]);

const GENERIC_GROUP_TERMS = [
  { kw: "ca map", label: "Cá mập" },
  { kw: "rua bien", label: "Rùa biển" },
  { kw: "san ho", label: "San hô" },
  { kw: "ca voi", label: "Cá voi" },
  { kw: "ca heo", label: "Cá heo" },
  { kw: "ca duoi", label: "Cá đuối" },
  { kw: "bach tuoc", label: "Bạch tuộc" },
  { kw: "muc", label: "Mực" },
  { kw: "tom hum", label: "Tôm hùm" },
  { kw: "sao bien", label: "Sao biển" },
  { kw: "hai quy", label: "Hải quỳ" },
  { kw: "ca he", label: "Cá hề" },
];

const ZONES_LIST = [
  { name: "Côn Đảo", clean: "con dao" },
  { name: "Trường Sa", clean: "truong sa" },
  { name: "Hoàng Sa", clean: "hoang sa" },
  { name: "Nha Trang", clean: "nha trang" },
  { name: "Cù Lao Chàm", clean: "cu lao cham" },
  { name: "Phú Quốc", clean: "phu quoc" },
  { name: "Cần Giờ", clean: "can gio" },
  { name: "Bạch Long Vĩ", clean: "bach long vi" },
  { name: "Vịnh Hạ Long", clean: "ha long" },
  { name: "Lý Sơn", clean: "ly son" },
  { name: "Bình Định", clean: "binh dinh" },
  { name: "Vịnh Bắc Bộ", clean: "vinh bac bo" },
  { name: "Vịnh Thái Lan", clean: "vinh thai lan" },
];

const DEFAULT_SEMANTIC_SUGGESTIONS = [
  "Sinh vật phát sáng ở biển sâu",
  "Thiên địch của sao biển gai",
  "Động vật có vú biết hát dưới nước",
  "Loài ăn cỏ biển ở Côn Đảo",
  "Cộng sinh với hải quỳ",
  "Loài có nọc độc chết người",
];
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ecosystemService.js
 * Dịch vụ đồ thị sinh thái Biển Đông
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
   * Lấy dữ liệu đồ thị sinh thái
   */
  async getKnowledgeGraph(filters = {}) {
    const { zone, groupId, redList, limit = 5000 } = filters;

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

    // Nạp toàn bộ danh mục loài trong CSDL thỏa mãn bộ lọc để luôn hiển thị đầy đủ
    const speciesWhere = {};
    if (groupId) speciesWhere.group_id = BigInt(groupId);
    if (redList) speciesWhere.vietnam_red_list_status = redList;
    if (zone) speciesWhere.east_sea_zone = { contains: zone, mode: "insensitive" };

    const allMatchingSpecies = await prisma.species.findMany({
      where: speciesWhere,
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
    });

    for (const sp of allMatchingSpecies) {
      addNode(sp);
    }

    // Nạp thêm các species từ relationships nếu có
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
   * Lấy hệ sinh thái và mạng lưới quan hệ của loài
   */
  async getSpeciesEcosystem(idOrSlug) {
    // Tìm thông tin loài
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

    // Tìm tất cả quan hệ hai chiều của loài
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
   * Xóa cache danh mục loài trong RAM khi Admin tạo/sửa/xóa/ẩn loài
   */
  invalidateSpeciesCache() {
    speciesCatalogCache = { items: null, tokenDocFreq: null, loadedAt: 0 };
  }

  /**
   * Tải và cache toàn bộ metadata các loài đang hiển thị trong RAM (TTL 5 phút)
   * Kèm chỉ mục token đã chuẩn hóa để chấm điểm lexical kiểu BM25 trong <1ms
   */
  async getSpeciesCatalog() {
    const now = Date.now();
    if (
      speciesCatalogCache.items &&
      now - speciesCatalogCache.loadedAt < CATALOG_CACHE_TTL_MS
    ) {
      return speciesCatalogCache;
    }

    const rawSpecies = await prisma.species.findMany({
      where: { deleted_at: null, is_visible: true },
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
        size_min_cm: true,
        size_max_cm: true,
        weight_min_kg: true,
        weight_max_kg: true,
        lifespan_years: true,
        species_groups: {
          select: { name: true, slug: true },
        },
        ocean_zones: {
          select: { name: true },
        },
        species_media: {
          where: { is_primary: true },
          select: { url: true },
          take: 1,
        },
        species_translations: {
          where: { language_code: "en" },
          select: { common_name: true, description: true, diet: true },
          take: 1,
        },
      },
    });

    const tokenDocFreq = new Map();
    const items = rawSpecies.map((sp) => {
      const en = sp.species_translations?.[0];
      const nameClean = removeDiacritics(sp.common_name || "");
      const sciClean = removeDiacritics(sp.scientificName || "");
      const enNameClean = removeDiacritics(en?.common_name || "");
      const descClean = removeDiacritics(
        `${sp.description || ""} ${en?.description || ""}`
      );
      const dietClean = removeDiacritics(`${sp.diet || ""} ${en?.diet || ""}`);
      const zoneClean = removeDiacritics(
        `${sp.east_sea_zone || ""} ${sp.local_distribution || ""}`
      );
      const groupClean = removeDiacritics(sp.species_groups?.name || "");

      const toWordSet = (str) =>
        new Set(
          str
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length >= 2 && !LEXICAL_STOP_WORDS.has(w))
        );

      const nameWords = toWordSet(nameClean);
      const sciWords = toWordSet(sciClean);
      const enNameWords = toWordSet(enNameClean);
      const dietWords = toWordSet(dietClean);
      const descWords = toWordSet(descClean);
      const zoneWords = toWordSet(zoneClean);
      const groupWords = toWordSet(groupClean);

      const docTokens = new Set([
        ...nameWords,
        ...sciWords,
        ...enNameWords,
        ...dietWords,
        ...descWords,
        ...zoneWords,
        ...groupWords,
      ]);

      for (const tok of docTokens) {
        tokenDocFreq.set(tok, (tokenDocFreq.get(tok) || 0) + 1);
      }

      return {
        ...sp,
        _idStr: sp.id.toString(),
        _nameClean: nameClean,
        _sciClean: sciClean,
        _enNameClean: enNameClean,
        _descClean: descClean,
        _dietClean: dietClean,
        _zoneClean: zoneClean,
        _groupClean: groupClean,
        _nameWords: nameWords,
        _sciWords: sciWords,
        _enNameWords: enNameWords,
        _dietWords: dietWords,
        _descWords: descWords,
        _zoneWords: zoneWords,
        _groupWords: groupWords,
        _docTokens: docTokens,
      };
    });

    speciesCatalogCache = { items, tokenDocFreq, loadedAt: now };
    return speciesCatalogCache;
  }

  /**
   * Chuẩn hóa 1 loài thành định dạng kết quả thống nhất cho Frontend
   */
  formatSemanticResult(sp, extras = {}) {
    return {
      id: sp._idStr || sp.id.toString(),
      code: sp.code,
      commonName: sp.common_name,
      scientificName: sp.scientificName,
      slug: sp.slug,
      image: sp.species_media?.[0]?.url || "",
      groupName: sp.species_groups?.name?.split("(")[0]?.trim() || "Cá biển",
      groupSlug: sp.species_groups?.slug || "",
      redList: sp.vietnam_red_list_status || "LC",
      zone: sp.east_sea_zone || "Biển Đông",
      depth: `${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 200}m`,
      depthMin: sp.depth_min_m ?? 0,
      depthMax: sp.depth_max_m ?? 200,
      description: sp.description || "",
      diet: sp.diet || "",
      localDistribution: sp.local_distribution || "",
      role: extras.role ?? null,
      semanticReason: extras.semanticReason ?? null,
      relationshipType: extras.relationshipType ?? null,
      strength: extras.strength ?? 0.85,
      matchScore: extras.matchScore ?? null,
      aiGenerated: Boolean(extras.aiGenerated),
    };
  }

  /**
   * Chấm điểm lexical kiểu BM25 (có trọng số IDF & trường dữ liệu) trên RAM trong <1ms
   */
  computeLexicalRanking(qClean, tokens, allSpecies, tokenDocFreq) {
    const N = allSpecies.length || 1;
    const ranked = [];

    for (const sp of allSpecies) {
      let score = 0;
      const matchedFields = new Set();
      let exactNameHit = false;

      // Khớp nguyên cụm từ
      if (
        qClean.length >= 3 &&
        (sp._nameClean.includes(qClean) ||
          sp._sciClean.includes(qClean) ||
          (sp._enNameClean && sp._enNameClean.includes(qClean)))
      ) {
        score += 18;
        matchedFields.add("name");
        exactNameHit = true;
      } else if (qClean.length >= 4 && sp._dietClean.includes(qClean)) {
        score += 10;
        matchedFields.add("diet");
      } else if (qClean.length >= 4 && sp._descClean.includes(qClean)) {
        score += 8;
        matchedFields.add("description");
      }

      // Khớp từng token nguyên từ (tránh lỗi substring như "hat" khớp nhầm "phat")
      let matchedTokenCount = 0;
      let nameTokenHits = 0;
      for (const tok of tokens) {
        if (!sp._docTokens.has(tok)) continue;
        const df = tokenDocFreq.get(tok) || 1;
        const idf = Math.max(0.35, Math.log((N + 1) / (df + 0.5)));
        let tokScore = 0;

        if (sp._nameWords.has(tok)) {
          tokScore += 4.2 * idf;
          matchedFields.add("name");
          nameTokenHits++;
        }
        if (sp._sciWords.has(tok) || sp._enNameWords.has(tok)) {
          tokScore += 3.5 * idf;
          matchedFields.add("name");
          nameTokenHits++;
        }
        if (sp._dietWords.has(tok)) {
          tokScore += 3.2 * idf;
          matchedFields.add("diet");
        }
        if (sp._descWords.has(tok)) {
          tokScore += 2.0 * idf;
          matchedFields.add("description");
        }
        if (sp._zoneWords.has(tok)) {
          tokScore += 1.4 * idf;
          matchedFields.add("zone");
        }
        if (sp._groupWords.has(tok)) {
          tokScore += 1.2 * idf;
          matchedFields.add("group");
        }

        if (tokScore > 0) {
          score += tokScore;
          matchedTokenCount++;
        }
      }

      if (tokens.length > 0 && nameTokenHits / tokens.length >= 0.65) {
        exactNameHit = true;
      }

      // Thưởng thêm nếu khớp nhiều token đồng thời (coverage bonus)
      if (tokens.length >= 2 && matchedTokenCount >= 2) {
        score *= 1 + (matchedTokenCount / tokens.length) * 0.35;
      }

      if (score >= 3.0) {
        ranked.push({
          species: sp,
          score: Math.round(score * 100) / 100,
          matchedFields: Array.from(matchedFields),
          matchedTokenCount,
          exactNameHit,
        });
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, 30);
  }

  /**
   * Tạo câu giải thích ngữ nghĩa ngắn gọn, chính xác cho kết quả Hybrid/Vector
   */
  buildHybridReason(sp, { vecScore, matchedFields = [], detectedZone, redListStatuses, depthMin, depthMax }) {
    const bits = [];
    if (depthMin != null && (sp.depth_max_m ?? 0) >= depthMin) {
      bits.push(`Phân bố ở độ sâu ${sp.depth_min_m ?? 0}–${sp.depth_max_m ?? 0}m`);
    } else if (depthMax != null && (sp.depth_min_m ?? 0) <= depthMax) {
      bits.push(`Sống ở vùng nước nông ${sp.depth_min_m ?? 0}–${sp.depth_max_m ?? 0}m`);
    }
    if (redListStatuses?.includes((sp.vietnam_red_list_status || "").toUpperCase())) {
      bits.push(`Sách Đỏ VN: ${sp.vietnam_red_list_status}`);
    }
    if (detectedZone && sp._zoneClean.includes(removeDiacritics(detectedZone))) {
      bits.push(`Ghi nhận tại ${sp.east_sea_zone || detectedZone}`);
    }
    if (matchedFields.includes("diet") && sp.diet) {
      bits.push(`Thức ăn: ${sp.diet.slice(0, 95)}`);
    } else if (sp.description) {
      const firstSentence = sp.description.split(/(?<=[.!?])\s+/)[0] || sp.description;
      bits.push(firstSentence.slice(0, 130));
    } else if (sp.diet) {
      bits.push(`Thức ăn: ${sp.diet.slice(0, 95)}`);
    }
    if (bits.length === 0) {
      bits.push(`Phân bố tự nhiên tại ${sp.east_sea_zone || "Biển Đông"}.`);
    }
    return bits.slice(0, 2).join(" • ");
  }

  /**
   * Tìm kiếm ngữ nghĩa kết hợp (Hybrid Semantic Search v2)
   * Pipeline: Query Understanding -> Hard Pre-Filter (AND) -> Parallel Retrieval (Graph + Vector + BM25 Lexical)
   *           -> Reciprocal Rank Fusion (RRF, k=60) -> Top-15 LLM Rerank (chỉ khi độ tin cậy thấp)
   */
  async searchSemantic(rawQuery) {
    const tStart = Date.now();

    if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
      return {
        success: true,
        query: "",
        searchMode: "idle",
        summary: "",
        latencyMs: 0,
        detectedIntent: null,
        count: 0,
        data: [],
        suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
      };
    }

    const q = rawQuery.trim();
    const qClean = removeDiacritics(q);
    const hasWord = (p) => new RegExp(`(^|\\s|[^a-z0-9])${p}($|\\s|[^a-z0-9])`, "i").test(qClean);

    // Chặn ngay chuỗi gõ bừa / vô nghĩa (<1ms) để không trả về kết quả rác
    if (isLikelyGibberish(qClean)) {
      return {
        success: true,
        query: q,
        searchMode: "out_of_domain",
        outOfDomain: true,
        summary: "Không nhận diện được từ khóa sinh vật biển phù hợp",
        message:
          "Truy vấn chưa khớp với sinh vật biển hay hệ sinh thái Biển Đông. Hãy thử một trong các câu hỏi gợi ý bên dưới.",
        latencyMs: Date.now() - tStart,
        detectedIntent: null,
        count: 0,
        data: [],
        suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
      };
    }

    // ─── 1. QUERY UNDERSTANDING (Ý định sinh thái, Sách Đỏ, Vùng biển, Độ sâu) ───
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
      qClean.includes("an thit") ||
      hasWord("predator") ||
      hasWord("predators")
    ) {
      relType = "predator_prey";
      isLookingForPredator = true;
    } else if (
      qClean.includes("con moi") ||
      qClean.includes("thuc an cua") ||
      qClean.includes("an con gi") ||
      qClean.includes("an cai gi") ||
      hasWord("an gi") ||
      qClean.includes("bi an") ||
      qClean.includes("what does") ||
      qClean.includes("what do")
    ) {
      relType = "predator_prey";
      isLookingForPrey = true;
    } else if (
      qClean.includes("cong sinh") ||
      qClean.includes("tuong ho") ||
      qClean.includes("symbiosis") ||
      qClean.includes("symbiotic")
    ) {
      relType = "symbiosis";
    } else if (
      qClean.includes("an co") ||
      qClean.includes("an thuc vat") ||
      qClean.includes("gam co") ||
      qClean.includes("herbiv") ||
      (qClean.includes("co bien") &&
        (qClean.includes("an") || qClean.includes("loai") || qClean.includes("dong vat")))
    ) {
      relType = "herbivory";
    } else if (
      qClean.includes("tao noi o") ||
      qClean.includes("tao noi cu tru") ||
      qClean.includes("tao sinh canh") ||
      qClean.includes("kien tao sinh canh") ||
      qClean.includes("noi cu tru") ||
      qClean.includes("nuong tua")
    ) {
      relType = "habitat_provider";
    } else if (qClean.includes("ky sinh") || qClean.includes("parasit")) {
      relType = "parasitism";
    }

    // Tình trạng Sách Đỏ (hỗ trợ lọc nhiều mức khi người dùng hỏi chung)
    let redListStatuses = null;
    let redListLabel = null;
    const isRedListExplicit =
      qClean.includes("sach do") ||
      qClean.includes("red list") ||
      qClean.includes("bao ton") ||
      qClean.includes("nguy cap") ||
      qClean.includes("quy hiem") ||
      qClean.includes("endangered");

    if (hasWord("tuyet chung trong tu nhien") || (isRedListExplicit && hasWord("ew")) || qClean === "ew") {
      redListStatuses = ["EW"];
      redListLabel = "EW";
    } else if (hasWord("tuyet chung") || (isRedListExplicit && hasWord("ex")) || qClean === "ex") {
      redListStatuses = ["EX"];
      redListLabel = "EX";
    } else if (
      qClean.includes("cuc ky nguy cap") ||
      qClean.includes("critically endangered") ||
      (isRedListExplicit && hasWord("cr")) ||
      qClean === "cr"
    ) {
      redListStatuses = ["CR"];
      redListLabel = "CR";
    } else if (
      qClean.includes("sap nguy cap") ||
      hasWord("vulnerable") ||
      (isRedListExplicit && hasWord("vu")) ||
      qClean === "vu"
    ) {
      redListStatuses = ["VU"];
      redListLabel = "VU";
    } else if ((isRedListExplicit && hasWord("en")) || qClean === "en") {
      redListStatuses = ["EN"];
      redListLabel = "EN";
    } else if (qClean.includes("nguy cap") || hasWord("endangered")) {
      redListStatuses = ["CR", "EN"];
      redListLabel = "CR / EN";
    } else if (
      qClean.includes("gan de doa") ||
      qClean.includes("gan bi de doa") ||
      (isRedListExplicit && hasWord("nt")) ||
      qClean === "nt"
    ) {
      redListStatuses = ["NT"];
      redListLabel = "NT";
    } else if (
      qClean.includes("sach do") ||
      qClean.includes("quy hiem") ||
      qClean.includes("red list")
    ) {
      redListStatuses = ["CR", "EN", "VU"];
      redListLabel = "Sách Đỏ (CR/EN/VU)";
    }

    // Phân vùng Biển Đông
    let detectedZone = null;
    for (const z of ZONES_LIST) {
      if (qClean.includes(z.clean)) {
        detectedZone = z.name;
        break;
      }
    }

    // Ràng buộc độ sâu (VD: "sâu hơn 1000m", "trên 500m", "dưới 50m")
    let depthMin = null;
    let depthMax = null;
    const minDepthMatch = qClean.match(
      /(?:sau hon|sau tren|tren|tu|>=|>|over|deeper than|below)\s*(\d{2,5})\s*m\b/i
    );
    if (minDepthMatch) {
      depthMin = parseInt(minDepthMatch[1], 10);
    }
    const maxDepthMatch = qClean.match(
      /(?:duoi|nong hon|it hon|<=|<|under|shallower than)\s*(\d{1,4})\s*m\b/i
    );
    if (maxDepthMatch) {
      depthMax = parseInt(maxDepthMatch[1], 10);
    }

    // Nhận diện câu hỏi kỷ lục / so sánh số liệu thật trong DB (to nhất, nặng nhất, sống lâu nhất, sâu nhất, nhỏ nhất)
    let superlativeType = null;
    if (
      qClean.includes("to nhat") ||
      qClean.includes("lon nhat") ||
      qClean.includes("khong lo nhat") ||
      qClean.includes("dai nhat") ||
      hasWord("biggest") ||
      hasWord("largest") ||
      hasWord("longest")
    ) {
      superlativeType = "largest";
    } else if (qClean.includes("nang nhat") || hasWord("heaviest")) {
      superlativeType = "heaviest";
    } else if (
      qClean.includes("nho nhat") ||
      qClean.includes("be nhat") ||
      qClean.includes("ti hon nhat") ||
      hasWord("smallest") ||
      hasWord("tiniest")
    ) {
      superlativeType = "smallest";
    } else if (
      qClean.includes("song lau nhat") ||
      qClean.includes("tuoi tho cao nhat") ||
      qClean.includes("tho nhat") ||
      qClean.includes("gia nhat") ||
      hasWord("oldest") ||
      qClean.includes("longest living") ||
      qClean.includes("longest lifespan")
    ) {
      superlativeType = "longest_lived";
    } else if (
      qClean.includes("sau nhat") ||
      qClean.includes("song sau nhat") ||
      hasWord("deepest")
    ) {
      superlativeType = "deepest";
    }

    // ─── 2. LẤY DANH MỤC LOÀI TỪ RAM CACHE (<1ms) ───────────────────────────────
    const { items: allSpecies, tokenDocFreq } = await this.getSpeciesCatalog();
    const speciesById = new Map(allSpecies.map((sp) => [sp._idStr, sp]));

    // ─── 2B. NHÁNH KỶ LỤC SỐ LIỆU SINH HỌC (TRUY VẤN TRỰC TIẾP CỘT SỐ TRONG DB) ───
    if (superlativeType && !relType) {
      let groupFilterFn = null;
      let groupScopeLabel = "sinh vật biển";

      const mentionsWhaleOrDolphin =
        qClean.includes("ca voi") || qClean.includes("ca heo");
      if (
        !mentionsWhaleOrDolphin &&
        (hasWord("ca") || qClean.includes("con ca") || qClean.includes("loai ca") || hasWord("fish"))
      ) {
        // Phân biệt khoa học: "Cá" loại trừ thú biển (group 2: cá voi, cá heo) và thực vật
        groupFilterFn = (sp) =>
          Number(sp.group_id) === 1 ||
          (sp._nameClean.startsWith("ca ") && Number(sp.group_id) !== 2);
        groupScopeLabel = "loài cá";
      } else if (
        qClean.includes("thu bien") ||
        qClean.includes("co vu") ||
        hasWord("mammal") ||
        hasWord("mammals")
      ) {
        groupFilterFn = (sp) => Number(sp.group_id) === 2;
        groupScopeLabel = "thú biển";
      } else if (
        qClean.includes("bo sat") ||
        hasWord("rua") ||
        qClean.includes("ran bien") ||
        hasWord("reptile")
      ) {
        groupFilterFn = (sp) => Number(sp.group_id) === 3;
        groupScopeLabel = "bò sát biển";
      } else if (
        qClean.includes("than mem") ||
        qClean.includes("giap xac") ||
        qClean.includes("bach tuoc") ||
        hasWord("muc") ||
        hasWord("tom") ||
        hasWord("cua")
      ) {
        groupFilterFn = (sp) => Number(sp.group_id) === 4;
        groupScopeLabel = "thân mềm & giáp xác";
      } else if (
        qClean.includes("san ho") ||
        qClean.includes("thuc vat") ||
        qClean.includes("cay") ||
        hasWord("coral")
      ) {
        groupFilterFn = (sp) => Number(sp.group_id) === 5;
        groupScopeLabel = "san hô & thực vật biển";
      } else if (superlativeType === "largest" || superlativeType === "heaviest") {
        // Mặc định khi hỏi "con gì to nhất / nặng nhất đại dương" loại thực vật ngập mặn
        groupFilterFn = (sp) => Number(sp.group_id) !== 5;
      }

      let pool = allSpecies.filter((sp) => {
        if (groupFilterFn && !groupFilterFn(sp)) return false;
        if (detectedZone && !sp._zoneClean.includes(removeDiacritics(detectedZone))) return false;
        if (
          redListStatuses &&
          !redListStatuses.includes((sp.vietnam_red_list_status || "").toUpperCase())
        ) {
          return false;
        }
        return true;
      });

      const fmtSize = (cm) =>
        cm >= 100 ? `${Number((cm / 100).toFixed(1))} m` : `${Number(cm)} cm`;
      const fmtWeight = (kg) =>
        kg >= 1000 ? `${Number((kg / 1000).toFixed(1))} tấn` : `${Number(kg)} kg`;

      let metricLabel = "";
      let sorted = [];

      if (superlativeType === "largest") {
        metricLabel = "kích thước lớn nhất";
        sorted = pool
          .filter((sp) => Number(sp.size_max_cm || 0) > 0)
          .sort((a, b) => Number(b.size_max_cm) - Number(a.size_max_cm));
      } else if (superlativeType === "heaviest") {
        metricLabel = "trọng lượng nặng nhất";
        sorted = pool
          .filter((sp) => Number(sp.weight_max_kg || 0) > 0)
          .sort((a, b) => Number(b.weight_max_kg) - Number(a.weight_max_kg));
      } else if (superlativeType === "smallest") {
        metricLabel = "kích thước nhỏ nhất";
        sorted = pool
          .filter((sp) => Number(sp.size_max_cm || 0) > 0)
          .sort((a, b) => Number(a.size_max_cm) - Number(b.size_max_cm));
      } else if (superlativeType === "longest_lived") {
        metricLabel = "tuổi thọ cao nhất";
        sorted = pool
          .filter((sp) => Number(sp.lifespan_years || 0) > 0)
          .sort((a, b) => Number(b.lifespan_years) - Number(a.lifespan_years));
      } else if (superlativeType === "deepest") {
        metricLabel = "độ sâu sinh sống lớn nhất";
        sorted = pool
          .filter((sp) => Number(sp.depth_max_m || 0) > 0)
          .sort((a, b) => Number(b.depth_max_m) - Number(a.depth_max_m));
      }

      if (sorted.length > 0) {
        const superlativeResults = sorted.slice(0, 10).map((sp, idx) => {
          const cm = Number(sp.size_max_cm || 0);
          const kg = Number(sp.weight_max_kg || 0);
          const years = Number(sp.lifespan_years || 0);
          const depthM = Number(sp.depth_max_m || 0);

          let role = `#${idx + 1}`;
          let reason = "";
          if (superlativeType === "largest" || superlativeType === "smallest") {
            role = `#${idx + 1} · ${fmtSize(cm)}`;
            reason = `Chiều dài tối đa ${fmtSize(cm)}${kg > 0 ? `, cân nặng tới ${fmtWeight(kg)}` : ""}.`;
          } else if (superlativeType === "heaviest") {
            role = `#${idx + 1} · ${fmtWeight(kg)}`;
            reason = `Trọng lượng tối đa ${fmtWeight(kg)}${cm > 0 ? `, chiều dài tới ${fmtSize(cm)}` : ""}.`;
          } else if (superlativeType === "longest_lived") {
            role = `#${idx + 1} · ${years} năm`;
            reason = `Tuổi thọ ước tính lên tới ${years} năm — thuộc nhóm ${groupScopeLabel} sống lâu nhất.`;
          } else if (superlativeType === "deepest") {
            role = `#${idx + 1} · ${depthM.toLocaleString("vi-VN")} m`;
            reason = `Phân bố xuống tới độ sâu ${depthM.toLocaleString("vi-VN")} m dưới mực nước biển.`;
          }

          return this.formatSemanticResult(sp, {
            role,
            semanticReason: reason,
            relationshipType: "superlative_metric",
            strength: Math.max(0.8, 0.99 - idx * 0.02),
            matchScore: Math.max(85, 99 - idx * 2),
          });
        });

        const summaryParts = [`Xếp hạng ${groupScopeLabel} có ${metricLabel}`];
        if (detectedZone) summaryParts.push(`Khu vực: ${detectedZone}`);
        if (redListLabel) summaryParts.push(`Sách Đỏ: ${redListLabel}`);

        return {
          success: true,
          query: q,
          searchMode: "superlative_metric",
          summary: summaryParts.join(" · "),
          latencyMs: Date.now() - tStart,
          detectedIntent: {
            superlative: superlativeType,
            groupScope: groupScopeLabel,
            zone: detectedZone,
            redList: redListLabel,
          },
          count: superlativeResults.length,
          data: superlativeResults,
          suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
        };
      }
    }

    // Nhận diện chính xác 1 loài cụ thể (chỉ khớp cụm tên đầy đủ, không ép từ khóa chung!)
    let targetFocusSpecies = null;
    let bestLen = 0;
    for (const sp of allSpecies) {
      for (const candidate of [sp._nameClean, sp._sciClean, sp._enNameClean]) {
        if (!candidate || candidate.length < 4) continue;
        if (hasWord(candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) {
          if (candidate.length > bestLen) {
            targetFocusSpecies = sp;
            bestLen = candidate.length;
          }
        }
      }
    }

    // Nếu không có 1 loài cụ thể nhưng có ý định quan hệ sinh thái (VD: "cá mập ăn gì", "cộng sinh với hải quỳ")
    // tìm nhóm các loài khớp cụm danh mục để truy vấn đồ thị nhiều loài thay vì khóa cứng vào 1 loài ngẫu nhiên
    let matchedGroupTerm = null;
    let matchedGroupSpecies = [];
    if (!targetFocusSpecies && relType) {
      for (const g of GENERIC_GROUP_TERMS) {
        if (hasWord(g.kw)) {
          const groupMatches = allSpecies.filter((sp) => sp._nameClean.includes(g.kw));
          if (groupMatches.length === 1) {
            targetFocusSpecies = groupMatches[0];
          } else if (groupMatches.length > 1) {
            matchedGroupTerm = g.label;
            matchedGroupSpecies = groupMatches;
          }
          break;
        }
      }
    }

    // Hàm kiểm tra bộ lọc cấu trúc (AND logic)
    const matchesStructuredFilters = (sp) => {
      if (detectedZone && !sp._zoneClean.includes(removeDiacritics(detectedZone))) {
        return false;
      }
      if (
        redListStatuses &&
        !redListStatuses.includes((sp.vietnam_red_list_status || "").toUpperCase())
      ) {
        return false;
      }
      if (depthMin != null && (sp.depth_max_m ?? 0) < depthMin) {
        return false;
      }
      if (depthMax != null && (sp.depth_min_m ?? 0) > depthMax) {
        return false;
      }
      return true;
    };

    const queryTokens = qClean
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2 && !LEXICAL_STOP_WORDS.has(w));

    const results = [];
    const addedSpeciesIds = new Set();
    let searchMode = "hybrid_semantic";
    let summaryPartsOverride = null;

    // ─── 3. NHÁNH A: ĐỒ THỊ QUAN HỆ SINH THÁI CỦA 1 LOÀI CỤ THỂ ──────────────────
    if (targetFocusSpecies && relType) {
      searchMode = "ecological_graph";
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
          relationship_type: relType,
        },
        orderBy: [{ strength: "desc" }, { id: "asc" }],
        take: 25,
      });

      for (const r of rels) {
        const isSource = r.source_species_id === targetFocusSpecies.id;
        const matchedId = (isSource ? r.target_species_id : r.source_species_id).toString();
        const matched = speciesById.get(matchedId);
        if (!matched || addedSpeciesIds.has(matchedId)) continue;
        if ((detectedZone || redListStatuses || depthMin != null || depthMax != null) && !matchesStructuredFilters(matched)) {
          continue;
        }

        addedSpeciesIds.add(matchedId);

        let roleLabel = RELATIONSHIP_META[r.relationship_type]?.label || "Quan hệ sinh thái";
        let semanticReason = r.description || r.ecological_impact;

        if (r.relationship_type === "predator_prey") {
          if (isSource) {
            roleLabel = "Con mồi";
            semanticReason = `Là con mồi bị ${targetFocusSpecies.common_name} săn bắt.`;
          } else {
            roleLabel = "Thiên địch";
            semanticReason = `Là thiên địch săn bắt ${targetFocusSpecies.common_name}, giúp kiểm soát quần thể loài này.`;
          }
        } else if (r.relationship_type === "symbiosis") {
          roleLabel = "Cộng sinh";
          semanticReason =
            semanticReason || `Cộng sinh tương hỗ chặt chẽ với ${targetFocusSpecies.common_name}.`;
        } else if (r.relationship_type === "habitat_provider") {
          roleLabel = isSource ? "Tạo sinh cảnh" : "Cư trú";
          semanticReason =
            semanticReason ||
            (isSource
              ? `Tạo nơi cư trú cho ${matched.common_name}.`
              : `Nương tựa vào ${targetFocusSpecies.common_name} làm nơi ở.`);
        }

        const strengthNum = Number(r.strength || 0.95);
        results.push(
          this.formatSemanticResult(matched, {
            role: roleLabel,
            semanticReason: (semanticReason || "").trim(),
            relationshipType: r.relationship_type,
            strength: strengthNum,
            matchScore: Math.min(99, Math.round(strengthNum * 100)),
          })
        );
        if (results.length >= 12) break;
      }

      // Bổ trợ bằng Vector Search ngưỡng cao (0.68) nếu đồ thị có ít liên kết (VD: thiếu cạnh Cá Hề Cà Chua - Hải Quỳ)
      if (results.length < 5 && process.env.GEMINI_API_KEY) {
        const vecSupp = await vectorSearchService.search(q, 0.68, 8);
        for (const m of vecSupp) {
          if (
            m.speciesId === targetFocusSpecies._idStr ||
            addedSpeciesIds.has(m.speciesId)
          ) {
            continue;
          }
          const sp = speciesById.get(m.speciesId);
          if (!sp) continue;
          if ((detectedZone || redListStatuses || depthMin != null || depthMax != null) && !matchesStructuredFilters(sp)) {
            continue;
          }
          addedSpeciesIds.add(m.speciesId);
          results.push(
            this.formatSemanticResult(sp, {
              role: "Liên quan",
              semanticReason: this.buildHybridReason(sp, { vecScore: m.score }),
              relationshipType: "vector_semantic",
              strength: m.score,
              matchScore: Math.round(m.score * 100),
            })
          );
          if (results.length >= 10) break;
        }
      }
    }

    // ─── 4. NHÁNH B: QUAN HỆ SINH THÁI CỦA NHÓM NHIỀU LOÀI (VD: "cá mập ăn gì", "cộng sinh với hải quỳ") ───
    if (results.length === 0 && relType && matchedGroupSpecies.length > 0) {
      searchMode = "ecological_graph";
      const groupIds = matchedGroupSpecies.map((s) => s.id);
      const groupIdSet = new Set(matchedGroupSpecies.map((s) => s._idStr));

      const directionCondition =
        relType === "predator_prey" && isLookingForPredator
          ? { target_species_id: { in: groupIds } }
          : relType === "predator_prey" && isLookingForPrey
            ? { source_species_id: { in: groupIds } }
            : {
                OR: [
                  { source_species_id: { in: groupIds } },
                  { target_species_id: { in: groupIds } },
                ],
              };

      const rels = await prisma.species_relationships.findMany({
        where: { ...directionCondition, relationship_type: relType },
        orderBy: [{ strength: "desc" }],
        take: 80,
      });

      // Gom nhóm theo loài kết quả để ưu tiên loài xuất hiện ở nhiều đại diện trong nhóm nhất
      const aggMap = new Map();
      for (const r of rels) {
        const srcId = r.source_species_id.toString();
        const tgtId = r.target_species_id.toString();
        const isGroupSource = groupIdSet.has(srcId);
        const candidateId = isGroupSource ? tgtId : srcId;
        const partnerId = isGroupSource ? srcId : tgtId;

        if (groupIdSet.has(candidateId)) continue;
        const candidate = speciesById.get(candidateId);
        const partner = speciesById.get(partnerId);
        if (!candidate || !partner) continue;
        if ((detectedZone || redListStatuses || depthMin != null || depthMax != null) && !matchesStructuredFilters(candidate)) {
          continue;
        }

        const existing = aggMap.get(candidateId) || {
          species: candidate,
          partners: [],
          maxStrength: 0,
          isSourceOfPartner: isGroupSource,
          relType: r.relationship_type,
        };
        if (!existing.partners.includes(partner.common_name)) {
          existing.partners.push(partner.common_name);
        }
        existing.maxStrength = Math.max(existing.maxStrength, Number(r.strength || 0.9));
        aggMap.set(candidateId, existing);
      }

      const sortedAgg = Array.from(aggMap.values())
        .sort((a, b) => b.partners.length - a.partners.length || b.maxStrength - a.maxStrength)
        .slice(0, 12);

      for (const entry of sortedAgg) {
        addedSpeciesIds.add(entry.species._idStr);
        const partnerText = entry.partners.slice(0, 3).join(", ");
        let roleLabel = RELATIONSHIP_META[entry.relType]?.label || "Quan hệ sinh thái";
        let reason = `Có quan hệ sinh thái với ${partnerText}.`;

        if (entry.relType === "predator_prey" && isLookingForPrey) {
          roleLabel = `Thức ăn của ${matchedGroupTerm}`;
          reason = `Là nguồn con mồi của ${partnerText}${entry.partners.length > 3 ? ` và ${entry.partners.length - 3} loài khác` : ""}.`;
        } else if (entry.relType === "predator_prey" && isLookingForPredator) {
          roleLabel = `Thiên địch của ${matchedGroupTerm}`;
          reason = `Săn bắt ${partnerText}.`;
        } else if (entry.relType === "symbiosis") {
          roleLabel = "Cộng sinh";
          reason = `Cộng sinh chặt chẽ cùng ${partnerText}.`;
        }

        results.push(
          this.formatSemanticResult(entry.species, {
            role: roleLabel,
            semanticReason: reason,
            relationshipType: entry.relType,
            strength: entry.maxStrength,
            matchScore: Math.min(98, Math.round(entry.maxStrength * 100)),
          })
        );
      }

      // Bổ trợ bằng vector nếu nhóm như "hải quỳ" chỉ có ít cạnh trong đồ thị
      if (results.length < 4 && process.env.GEMINI_API_KEY) {
        const vecSupp = await vectorSearchService.search(q, 0.68, 6);
        for (const m of vecSupp) {
          if (groupIdSet.has(m.speciesId) || addedSpeciesIds.has(m.speciesId)) continue;
          const sp = speciesById.get(m.speciesId);
          if (!sp) continue;
          addedSpeciesIds.add(m.speciesId);
          results.push(
            this.formatSemanticResult(sp, {
              role: relType === "symbiosis" ? "Cộng sinh" : "Liên quan",
              semanticReason: this.buildHybridReason(sp, { vecScore: m.score }),
              relationshipType: "vector_semantic",
              strength: m.score,
              matchScore: Math.round(m.score * 100),
            })
          );
          if (results.length >= 8) break;
        }
      }
    }

    // ─── 5. NHÁNH C: LOẠI QUAN HỆ TỔNG QUÁT + LỌC GIAO (AND) THEO VÙNG / SÁCH ĐỎ ───
    if (results.length === 0 && relType && !targetFocusSpecies) {
      searchMode = "ecological_graph";
      const typeRels = await prisma.species_relationships.findMany({
        where: { relationship_type: relType },
        orderBy: [{ strength: "desc" }],
        take: 100,
      });

      const candidates = [];
      const seenCand = new Set();

      for (const r of typeRels) {
        const candidateId = (
          isLookingForPrey ? r.target_species_id : r.source_species_id
        ).toString();
        const otherId = (
          isLookingForPrey ? r.source_species_id : r.target_species_id
        ).toString();

        if (seenCand.has(candidateId)) continue;
        const candidate = speciesById.get(candidateId);
        const other = speciesById.get(otherId);
        if (!candidate || !other) continue;
        seenCand.add(candidateId);

        const explanation =
          r.description ||
          r.ecological_impact ||
          `${candidate.common_name} ${RELATIONSHIP_META[r.relationship_type]?.verb || "liên kết với"} ${other.common_name}.`;

        candidates.push({
          sp: candidate,
          strength: Number(r.strength || 0.9),
          role: RELATIONSHIP_META[r.relationship_type]?.label || "Quan hệ sinh thái",
          reason: explanation,
          relType: r.relationship_type,
        });
      }

      // Với herbivory, bổ sung thêm các loài có chế độ ăn chứa "cỏ biển" / "tảo" / "thực vật"
      if (relType === "herbivory") {
        for (const sp of allSpecies) {
          if (seenCand.has(sp._idStr)) continue;
          if (
            sp._dietClean.includes("co bien") ||
            sp._dietClean.includes("thuc vat") ||
            sp._dietClean.includes("rong bien")
          ) {
            seenCand.add(sp._idStr);
            candidates.push({
              sp,
              strength: 0.88,
              role: "Ăn thực vật",
              reason: `Chế độ ăn: ${sp.diet}.`,
              relType: "herbivory",
            });
          }
        }
      }

      // Áp dụng lọc GIAO (AND) thay vì cộng dồn (OR)
      const hasHardFilter = Boolean(
        detectedZone || redListStatuses || depthMin != null || depthMax != null
      );
      const strictFiltered = hasHardFilter
        ? candidates.filter((c) => matchesStructuredFilters(c.sp))
        : candidates;

      const finalRelList = (strictFiltered.length > 0 ? strictFiltered : candidates).slice(0, 12);
      const relaxedNotice = hasHardFilter && strictFiltered.length === 0;

      for (const item of finalRelList) {
        addedSpeciesIds.add(item.sp._idStr);
        const zoneNote =
          detectedZone && !relaxedNotice
            ? ` Phân bố tại ${item.sp.east_sea_zone || detectedZone}.`
            : "";
        results.push(
          this.formatSemanticResult(item.sp, {
            role: item.role,
            semanticReason: `${item.reason}${zoneNote}`.trim(),
            relationshipType: item.relType,
            strength: item.strength,
            matchScore: Math.min(98, Math.round(item.strength * 100)),
          })
        );
      }
    }

    // ─── 6. NHÁNH D & E: HYBRID RETRIEVAL (PARALLEL DENSE VECTOR + BM25 LEXICAL -> RRF) ───
    if (results.length === 0) {
      const hasHardFilter = Boolean(
        detectedZone || redListStatuses || depthMin != null || depthMax != null
      );

      // Lọc trước tập ứng viên nếu có bộ lọc cấu trúc rõ ràng (AND logic)
      const filteredPool = hasHardFilter
        ? allSpecies.filter(matchesStructuredFilters)
        : allSpecies;
      const effectivePool = filteredPool.length > 0 ? filteredPool : allSpecies;
      const effectivePoolSet = new Set(effectivePool.map((sp) => sp._idStr));

      // Kiểm tra xem câu truy vấn có phải thuần bộ lọc cấu trúc (VD: "loài cực kỳ nguy cấp ở Biển Đông")
      const filterOnlyTokens = new Set([
        "cuc", "ky", "nguy", "cap", "sap", "sach", "do", "bien", "dong", "bao", "ton",
        "con", "dao", "phu", "quoc", "nha", "trang", "hoang", "truong", "sa", "cu", "lao",
        "cham", "can", "gio", "bach", "long", "vi", "cr", "en", "vu", "nt", "lc",
      ]);
      const nonFilterTokens = queryTokens.filter((t) => !filterOnlyTokens.has(t));
      const isPureStructuredFilter =
        hasHardFilter &&
        filteredPool.length > 0 &&
        nonFilterTokens.length === 0 &&
        depthMin == null &&
        depthMax == null;

      if (isPureStructuredFilter) {
        searchMode = "structured_filter";
        for (const sp of filteredPool.slice(0, 24)) {
          addedSpeciesIds.add(sp._idStr);
          results.push(
            this.formatSemanticResult(sp, {
              role: redListStatuses
                ? `Sách Đỏ VN: ${sp.vietnam_red_list_status}`
                : `Khu vực: ${detectedZone}`,
              semanticReason: `Phân bố tại ${sp.east_sea_zone || "Biển Đông"}${sp.local_distribution ? ` (${sp.local_distribution})` : ""}.`,
              relationshipType: "structured_filter",
              strength: 0.95,
              matchScore: 95,
            })
          );
        }
      } else {
        // Chạy song song: Dense Vector Search (RETRIEVAL_QUERY) + BM25 Lexical Ranking
        const [vectorMatches, lexicalMatches] = await Promise.all([
          process.env.GEMINI_API_KEY
            ? vectorSearchService.search(q, 0.5, 40).catch((err) => {
                console.warn("[Semantic] Vector search error:", err.message);
                return [];
              })
            : Promise.resolve([]),
          Promise.resolve(
            this.computeLexicalRanking(qClean, queryTokens, effectivePool, tokenDocFreq)
          ),
        ]);

        // Lọc kết quả vector theo effectivePool nếu có hard filter (AND logic)
        const scopedVectorMatches = hasHardFilter
          ? vectorMatches.filter((m) => effectivePoolSet.has(m.speciesId))
          : vectorMatches;

        // Reciprocal Rank Fusion (RRF, k = 60) thích ứng theo độ dài truy vấn:
        // Câu mô tả dài (>=4 từ) ưu tiên Dense Vector; từ khóa ngắn (1-3 từ) cân bằng Vector + Lexical
        const RRF_K = 60;
        const isConceptualQuery = queryTokens.length >= 4;
        const W_VECTOR = isConceptualQuery ? 1.85 : 1.25;
        const W_LEXICAL = isConceptualQuery ? 0.8 : 1.15;
        const fusedMap = new Map();

        scopedVectorMatches.forEach((m, idx) => {
          const sp = speciesById.get(m.speciesId);
          if (!sp) return;
          fusedMap.set(m.speciesId, {
            sp,
            rrf: W_VECTOR / (RRF_K + idx + 1),
            vecScore: m.score,
            vecRank: idx + 1,
            lexScore: 0,
            lexRank: null,
            matchedFields: [],
            exactNameHit: false,
          });
        });

        lexicalMatches.forEach((m, idx) => {
          const id = m.species._idStr;
          const existing = fusedMap.get(id) || {
            sp: m.species,
            rrf: 0,
            vecScore: 0,
            vecRank: null,
            lexScore: 0,
            lexRank: null,
            matchedFields: [],
            exactNameHit: false,
          };
          existing.rrf += W_LEXICAL / (RRF_K + idx + 1);
          existing.lexScore = m.score;
          existing.lexRank = idx + 1;
          existing.matchedFields = m.matchedFields;
          existing.exactNameHit = Boolean(m.exactNameHit);
          // Chỉ cộng thưởng tên loài khi khớp nguyên tên hoặc >=65% từ truy vấn nằm trong tên
          if (m.exactNameHit) {
            existing.rrf += 0.014;
          }
          fusedMap.set(id, existing);
        });

        const fusedList = Array.from(fusedMap.values()).sort((a, b) => b.rrf - a.rrf);

        const topVecScore = scopedVectorMatches[0]?.score || 0;
        const topLexScore = lexicalMatches[0]?.score || 0;
        const hasExactNameMatch = fusedList.some((item) => item.exactNameHit);
        let aiIntentNote = null;

        // ─── TẦNG AI QUERY EXPANSION & OUT-OF-DOMAIN GUARDRAIL ───────────────────
        // Kích hoạt khi Vector chưa đủ tự tin (<0.67) và không khớp nguyên tên loài
        // (Không để 1 từ ngẫu nhiên như "bò" hay "hôm/hòm" chặn bộ lọc ngoài chủ đề!)
        const shouldInvokeAiAnalyzer =
          process.env.GEMINI_API_KEY &&
          !hasHardFilter &&
          !hasExactNameMatch &&
          topVecScore < 0.67;

        if (shouldInvokeAiAnalyzer) {
          const analysis = await callGeminiQueryAnalyzer(q);

          // 1) Nếu AI xác định truy vấn KHÔNG thuộc lĩnh vực sinh vật biển -> trả 0 kết quả sạch
          if (analysis && analysis.isMarineRelated === false) {
            return {
              success: true,
              query: q,
              searchMode: "out_of_domain",
              outOfDomain: true,
              summary: "Truy vấn nằm ngoài phạm vi sinh vật biển Biển Đông",
              message:
                "Hệ thống chuyên tra cứu sinh vật biển và hệ sinh thái Biển Đông. Hãy thử hỏi về tên loài, tập tính, chuỗi thức ăn, độ sâu hoặc khu bảo tồn biển.",
              latencyMs: Date.now() - tStart,
              detectedIntent: { outOfDomain: true },
              count: 0,
              data: [],
              suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
            };
          }

          // 2) Nếu AI xác định đúng chủ đề biển và có câu mở rộng / gợi ý loài -> tái truy vấn Hybrid
          if (analysis && analysis.isMarineRelated === true) {
            aiIntentNote = analysis.intentNote || null;
            const expandedText = analysis.rewrittenQuery || q;
            const expandedClean = removeDiacritics(expandedText);
            const expandedTokens = expandedClean
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length >= 2 && !LEXICAL_STOP_WORDS.has(w));

            const [expVecMatches, expLexMatches] = await Promise.all([
              vectorSearchService.search(expandedText, 0.55, 25).catch(() => []),
              Promise.resolve(
                this.computeLexicalRanking(expandedClean, expandedTokens, effectivePool, tokenDocFreq)
              ),
            ]);

            const expFused = new Map();
            const hintCleanList = (analysis.speciesHints || [])
              .map((h) => removeDiacritics(String(h || "")))
              .filter((h) => h.length >= 3);

            // Ưu tiên mạnh các loài khớp trực tiếp với speciesHints từ AI
            for (const sp of effectivePool) {
              const matchedHint = hintCleanList.find(
                (h) =>
                  sp._nameClean === h ||
                  sp._nameClean.includes(h) ||
                  (h.length >= 5 && h.includes(sp._nameClean))
              );
              if (matchedHint) {
                expFused.set(sp._idStr, {
                  sp,
                  rrf: 0.045,
                  vecScore: 0.82,
                  lexScore: 12,
                  matchedFields: ["ai_hint"],
                  exactNameHit: false,
                  isAiHint: true,
                });
              }
            }

            expVecMatches.forEach((m, idx) => {
              const sp = speciesById.get(m.speciesId);
              if (!sp) return;
              const prev = expFused.get(m.speciesId) || {
                sp,
                rrf: 0,
                vecScore: 0,
                lexScore: 0,
                matchedFields: [],
                exactNameHit: false,
                isAiHint: false,
              };
              prev.rrf += 1.6 / (RRF_K + idx + 1);
              prev.vecScore = Math.max(prev.vecScore, m.score);
              expFused.set(m.speciesId, prev);
            });

            expLexMatches.forEach((m, idx) => {
              const id = m.species._idStr;
              const prev = expFused.get(id) || {
                sp: m.species,
                rrf: 0,
                vecScore: 0,
                lexScore: 0,
                matchedFields: [],
                exactNameHit: false,
                isAiHint: false,
              };
              prev.rrf += 0.9 / (RRF_K + idx + 1);
              prev.lexScore = Math.max(prev.lexScore, m.score);
              prev.matchedFields = Array.from(new Set([...prev.matchedFields, ...m.matchedFields]));
              expFused.set(id, prev);
            });

            const expSorted = Array.from(expFused.values())
              .filter((item) => item.isAiHint || item.vecScore >= 0.62)
              .sort((a, b) => b.rrf - a.rrf)
              .slice(0, 10);

            if (expSorted.length > 0) {
              searchMode = "ai_expanded_semantic";
              for (const item of expSorted) {
                if (addedSpeciesIds.has(item.sp._idStr)) continue;
                addedSpeciesIds.add(item.sp._idStr);
                const scorePct = item.isAiHint
                  ? Math.min(96, Math.max(82, Math.round(item.vecScore * 100)))
                  : Math.round(item.vecScore * 100);
                const baseReason = this.buildHybridReason(item.sp, {
                  vecScore: item.vecScore,
                  matchedFields: item.matchedFields,
                });
                results.push(
                  this.formatSemanticResult(item.sp, {
                    role: null,
                    semanticReason: baseReason,
                    relationshipType: "ai_semantic",
                    strength: scorePct / 100,
                    matchScore: scorePct,
                    aiGenerated: true,
                  })
                );
              }
            }
          }
        }

        // Ngưỡng động (Adaptive Relative Cutoff) giữ các loài thực sự liên quan và chặn nhiễu < 0.60
        const minVecFloor = hasHardFilter ? 0.52 : 0.60;
        const dynamicVecFloor = Math.max(minVecFloor, topVecScore - 0.08);
        const confidentMatches = fusedList.filter((item) => {
          if (hasHardFilter && filteredPool.length > 0 && item.vecScore >= 0.5) return true;
          if (item.exactNameHit) return true;
          if (item.vecScore >= dynamicVecFloor && item.vecScore >= minVecFloor) return true;
          if (item.lexScore >= 10.0) return true;
          if (item.vecScore >= 0.58 && item.lexScore >= 5.5) return true;
          return false;
        });

        // Dự phòng Top-15 Rerank nếu chưa chạy AI Analyzer mà kết quả vẫn rỗng
        if (results.length === 0 && confidentMatches.length === 0 && process.env.GEMINI_API_KEY && fusedList.length > 0 && !shouldInvokeAiAnalyzer) {
          const rerankPool = fusedList.slice(0, 15).map((item) => item.sp);
          const aiMatches = await callGeminiRerankCandidates(q, rerankPool);

          if (aiMatches.length > 0) {
            searchMode = "ai_reranked";
            for (const match of aiMatches) {
              const sp = speciesById.get(match.speciesId.toString());
              if (!sp || addedSpeciesIds.has(sp._idStr)) continue;
              addedSpeciesIds.add(sp._idStr);
              const fusedRef = fusedMap.get(sp._idStr);
              const scorePct = fusedRef?.vecScore
                ? Math.min(98, Math.max(75, Math.round(fusedRef.vecScore * 100)))
                : 90;
              results.push(
                this.formatSemanticResult(sp, {
                  role: match.role || null,
                  semanticReason: match.reason,
                  relationshipType: "ai_semantic",
                  strength: scorePct / 100,
                  matchScore: scorePct,
                  aiGenerated: true,
                })
              );
            }
          }
        }

        // Nếu không dùng nhánh AI mở rộng / rerank -> xuất kết quả RRF đạt ngưỡng tin cậy
        // TUYỆT ĐỐI không đẩy kết quả rác khi confidentMatches rỗng và không có hardFilter
        if (results.length === 0) {
          const finalCandidates =
            confidentMatches.length > 0
              ? confidentMatches.slice(0, 12)
              : hasHardFilter && filteredPool.length > 0
                ? filteredPool.slice(0, 12).map((sp) => ({
                    sp,
                    vecScore: 0,
                    lexScore: 0,
                    matchedFields: [],
                  }))
                : [];

          if (finalCandidates.length === 0) {
            return {
              success: true,
              query: q,
              searchMode: "out_of_domain",
              outOfDomain: true,
              summary: "Không tìm thấy loài sinh vật biển khớp với mô tả",
              message:
                "Chưa tìm thấy sinh vật biển phù hợp với truy vấn này trong dữ liệu Biển Đông. Bạn có thể thử các gợi ý bên dưới.",
              latencyMs: Date.now() - tStart,
              detectedIntent: { outOfDomain: true },
              count: 0,
              data: [],
              suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
            };
          }

          searchMode =
            scopedVectorMatches.length > 0
              ? "hybrid_semantic"
              : lexicalMatches.length > 0
                ? "lexical_fallback"
                : "structured_filter";

          for (const item of finalCandidates) {
            if (addedSpeciesIds.has(item.sp._idStr)) continue;
            addedSpeciesIds.add(item.sp._idStr);

            let role = null;
            if (depthMin != null) {
              role = `Độ sâu ≥ ${depthMin}m`;
            } else if (redListStatuses) {
              role = `Sách Đỏ VN: ${item.sp.vietnam_red_list_status}`;
            } else if (detectedZone) {
              role = detectedZone;
            }

            const matchScore = item.vecScore
              ? Math.round(item.vecScore * 100)
              : item.lexScore
                ? Math.min(95, Math.round(55 + item.lexScore * 2))
                : 85;

            results.push(
              this.formatSemanticResult(item.sp, {
                role,
                semanticReason: this.buildHybridReason(item.sp, {
                  vecScore: item.vecScore,
                  matchedFields: item.matchedFields,
                  detectedZone,
                  redListStatuses,
                  depthMin,
                  depthMax,
                }),
                relationshipType:
                  item.vecScore > 0 ? "vector_semantic" : "lexical_semantic",
                strength: item.vecScore || Math.min(0.95, matchScore / 100),
                matchScore,
              })
            );
          }
        }

        if (aiIntentNote) {
          summaryPartsOverride = aiIntentNote;
        }
      }
    }

    // Tạo câu tóm tắt ngắn gọn cách hệ thống hiểu truy vấn
    const summaryParts = [];
    if (relType) {
      const relMeta = RELATIONSHIP_META[relType];
      if (relType === "predator_prey" && isLookingForPredator) summaryParts.push("Tìm thiên địch");
      else if (relType === "predator_prey" && isLookingForPrey) summaryParts.push("Tìm con mồi / thức ăn");
      else if (relMeta) summaryParts.push(`Quan hệ: ${relMeta.label}`);
    }
    if (targetFocusSpecies) summaryParts.push(`Loài trọng tâm: ${targetFocusSpecies.common_name}`);
    else if (matchedGroupTerm) summaryParts.push(`Nhóm loài: ${matchedGroupTerm}`);
    if (detectedZone) summaryParts.push(`Khu vực: ${detectedZone}`);
    if (redListLabel) summaryParts.push(`Sách Đỏ: ${redListLabel}`);
    if (depthMin != null) summaryParts.push(`Độ sâu ≥ ${depthMin}m`);
    if (depthMax != null) summaryParts.push(`Độ sâu ≤ ${depthMax}m`);

    const summary =
      summaryPartsOverride
        ? summaryPartsOverride
        : summaryParts.length > 0
          ? summaryParts.join(" · ")
          : null;

    return {
      success: true,
      query: q,
      searchMode,
      summary,
      latencyMs: Date.now() - tStart,
      detectedIntent: {
        relationshipType: relType,
        direction: isLookingForPredator
          ? "predator"
          : isLookingForPrey
            ? "prey"
            : null,
        targetSpecies: targetFocusSpecies
          ? targetFocusSpecies.common_name
          : matchedGroupTerm,
        zone: detectedZone,
        redList: redListLabel,
        depthMin,
        depthMax,
      },
      count: results.length,
      data: results,
      suggestions: DEFAULT_SEMANTIC_SUGGESTIONS,
    };
  }

  /**
   * Quản lý mối quan hệ sinh thái
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
