/**
 * taxonomyService.js
 * Scientific Marine Taxonomy & Biodiversity Data Gateway (Zero-Fabrication Architecture)
 *
 * Nguồn dữ liệu chính thống có thể truy xuất nguồn gốc (Provenance):
 * - WoRMS (World Register of Marine Species): Xác thực sinh vật biển, AphiaID, phân bố địa lý, attributes (FishBase/FAO)
 * - UNESCO OBIS (Ocean Biodiversity Information System): Độ sâu thực nghiệm (depth), nhiệt độ nước (sst), phân bố Biển Đông (Polygon check), IUCN category
 * - GBIF (Global Biodiversity Information Facility): Match danh pháp, tên địa phương, Danh lục Đỏ IUCN, Catalog of Fishes
 * - iNaturalist (California Academy of Sciences & NatGeo): Ảnh chụp cộng đồng có định danh & trạng thái bảo tồn
 * - Wikipedia & Wikidata (Wikimedia Foundation): Mô tả tiếng Việt, cân nặng (P2067), kích thước (P2043), tuổi thọ (P2250), ID liên kết
 */

import { translateMarineQuery } from "../config/marineDictionary.js";
import aiTaxonomyService from "./aiTaxonomyService.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const taxonomyCache = new Map();

const WIKI_HEADERS = {
  "User-Agent": "PacificOceanApp/1.0 (https://pacific.org; educational marine database)",
  Accept: "application/json",
};

const SOUTH_CHINA_SEA_WKT = "POLYGON((99 1,122 1,122 24,99 24,99 1))";

const IUCN_CATEGORY_MAP = {
  LEAST_CONCERN: "LC",
  NEAR_THREATENED: "NT",
  VULNERABLE: "VU",
  ENDANGERED: "EN",
  CRITICALLY_ENDANGERED: "CR",
  EXTINCT_IN_THE_WILD: "EW",
  EXTINCT: "EX",
  DATA_DEFICIENT: "DD",
  NOT_EVALUATED: "NE",
  LC: "LC",
  NT: "NT",
  VU: "VU",
  EN: "EN",
  CR: "CR",
  EW: "EW",
  EX: "EX",
  DD: "DD",
  NE: "NE",
};

const WIKIDATA_IUCN_MAP = {
  Q211005: "LC",
  Q719675: "NT",
  Q278113: "VU",
  Q11394: "EN",
  Q219127: "CR",
  Q239509: "EW",
  Q237350: "EX",
  Q3245245: "DD",
  Q3344755: "NE",
};

function normalizeIucnCode(raw) {
  if (!raw) return null;
  const upper = String(raw).trim().toUpperCase();
  return IUCN_CATEGORY_MAP[upper] || null;
}

function deriveOceanZone(depthMin, depthMax) {
  const maxD = depthMax !== null && depthMax !== undefined ? Number(depthMax) : null;
  const minD = depthMin !== null && depthMin !== undefined ? Number(depthMin) : null;
  const ref = maxD ?? minD;
  if (ref === null || Number.isNaN(ref)) return null;
  if (ref >= 6000 || (minD !== null && minD >= 4000)) return "Hadal";
  if (ref >= 4000 || (minD !== null && minD >= 2000)) return "Abyssal";
  if (ref >= 1000 || (minD !== null && minD >= 600)) return "Midnight";
  if (ref >= 200) return "Twilight";
  return "Sunlight";
}

function inferGroupIdFromTaxonomy(tax = {}) {
  const cls = (tax.class || "").toLowerCase();
  const order = (tax.order || "").toLowerCase();
  const phylum = (tax.phylum || "").toLowerCase();

  if (cls.includes("mammalia")) return "2"; // Động vật có vú biển
  if (cls.includes("cephalopoda") || phylum.includes("mollusca") || phylum.includes("cnidaria") || phylum.includes("arthropoda") || phylum.includes("echinodermata")) {
    return "3"; // Thân mềm / Không xương sống / San hô
  }
  if (cls.includes("elasmobranchii") || cls.includes("chondrichthyes") || order.includes("lamniformes") || order.includes("carcharhiniformes")) {
    return "1"; // Cá mập & Cá đuối
  }
  if (cls.includes("actinopteri") || cls.includes("actinopterygii") || cls.includes("teleostei")) {
    return "4"; // Cá xương / Cá rạn san hô
  }
  return "1";
}

/**
 * Lấy danh sách ảnh đầy đủ theo Taxon ID từ iNaturalist /v1/taxa/{id}
 * (Endpoint tìm kiếm /v1/taxa?q=... trả taxon_photos rỗng, cần gọi chi tiết theo ID)
 */
async function fetchINaturalistPhotosById(taxonId, limit = 6) {
  if (!taxonId) return [];
  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const taxon = data?.results?.[0];
    if (!taxon) return [];

    const set = new Set();
    if (Array.isArray(taxon.taxon_photos)) {
      for (const tp of taxon.taxon_photos) {
        const u = tp?.photo?.large_url || tp?.photo?.medium_url || tp?.photo?.url;
        if (u && typeof u === "string" && u.startsWith("http")) {
          set.add(u);
          if (set.size >= limit) break;
        }
      }
    }
    if (set.size === 0 && taxon.default_photo) {
      const defUrl = taxon.default_photo.large_url || taxon.default_photo.medium_url || taxon.default_photo.url;
      if (defUrl) set.add(defUrl);
    }
    return [...set];
  } catch {
    return [];
  }
}

/**
 * Xác thực danh pháp loài biển chuẩn qua WoRMS (World Register of Marine Species)
 */
async function verifyWithWoRMS(sciName, like = false) {
  if (!sciName) return { inWoRMS: false, isMarine: false };
  try {
    const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(
      sciName
    )}?like=${like ? "true" : "false"}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { inWoRMS: false, isMarine: false };
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Ưu tiên bản ghi accepted và là sinh vật biển
      const rec =
        data.find((r) => r.status === "accepted" && r.isMarine === 1) ||
        data.find((r) => r.status === "accepted") ||
        data[0];

      return {
        inWoRMS: true,
        isMarine: rec.isMarine === 1,
        isBrackish: rec.isBrackish === 1,
        isFreshwater: rec.isFreshwater === 1,
        isTerrestrial: rec.isTerrestrial === 1,
        aphiaID: rec.valid_AphiaID || rec.AphiaID,
        validName: rec.valid_name || rec.scientificname,
        status: rec.status,
        kingdom: rec.kingdom,
        phylum: rec.phylum,
        class: rec.class,
        order: rec.order,
        family: rec.family,
        genus: rec.genus,
        url: rec.url || `https://www.marinespecies.org/aphia.php?p=taxdetails&id=${rec.valid_AphiaID || rec.AphiaID}`,
      };
    }
  } catch {
    // Silent fallback
  }
  return { inWoRMS: false, isMarine: false };
}

/**
 * Lấy phân bố địa lý thực tế từ WoRMS AphiaDistributionsByAphiaID
 */
async function fetchWoRMSDistributions(aphiaID) {
  if (!aphiaID) return { localities: [], isEastSea: null };
  try {
    const res = await fetch(
      `https://www.marinespecies.org/rest/AphiaDistributionsByAphiaID/${aphiaID}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { localities: [], isEastSea: null };
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { localities: [], isEastSea: null };

    const localities = [...new Set(data.map((d) => d.locality).filter(Boolean))];
    const text = localities.join(" | ").toLowerCase();
    const isEastSea = /south china sea|vietnam|viet nam|indo-west pacific|east china sea|indopacific|gulf of thailand|gulf of tonkin/i.test(text);

    return {
      localities: localities.slice(0, 6),
      isEastSea,
    };
  } catch {
    return { localities: [], isEastSea: null };
  }
}

/**
 * Lấy dữ liệu thực nghiệm đại dương (độ sâu, nhiệt độ nước sst, IUCN, phân bố Biển Đông) từ UNESCO OBIS
 */
async function fetchOBISMetrics(aphiaID, sciName) {
  const result = {
    taxonID: aphiaID || null,
    conservationStatus: null,
    isMarine: null,
    depthMin: null,
    depthMax: null,
    tempMinC: null,
    tempMaxC: null,
    isEastSea: null,
    eastSeaOccurrences: 0,
    taxonomy: {},
  };

  try {
    let targetId = aphiaID;
    const taxonQuery = targetId
      ? `https://api.obis.org/v3/taxon/${targetId}`
      : `https://api.obis.org/v3/taxon/complete/${encodeURIComponent(sciName)}`;

    const taxonRes = await fetch(taxonQuery, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (taxonRes.ok) {
      const tJson = await taxonRes.json();
      const tRec = Array.isArray(tJson) ? tJson[0] : tJson?.results?.[0];
      if (tRec) {
        targetId = tRec.taxonID || targetId;
        result.taxonID = targetId;
        result.conservationStatus = normalizeIucnCode(tRec.category);
        if (typeof tRec.is_marine === "boolean") result.isMarine = tRec.is_marine;
        result.taxonomy = {
          scientificName: tRec.scientificName,
          kingdom: tRec.kingdom,
          phylum: tRec.phylum,
          class: tRec.class,
          order: tRec.order,
          family: tRec.family,
          genus: tRec.genus,
        };
      }
    }

    if (!targetId) return result;

    // Song song gọi OBIS Environmental Statistics & South China Sea Polygon Occurrence
    const [envRes, scsRes] = await Promise.allSettled([
      fetch(`https://api.obis.org/v3/statistics/env?taxonid=${targetId}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://api.obis.org/v3/occurrence?taxonid=${targetId}&geometry=${encodeURIComponent(
          SOUTH_CHINA_SEA_WKT
        )}&size=1`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
      ).then((r) => (r.ok ? r.json() : null)),
    ]);

    if (envRes.status === "fulfilled" && envRes.value) {
      const env = envRes.value;
      // Lọc các mức nhiệt độ biển (sst) có ít nhất >= 2 bản ghi (hoặc > 0) để tránh nhiễu
      if (Array.isArray(env.sst) && env.sst.length > 0) {
        const validSst = env.sst.filter((b) => typeof b.sst === "number" && (b.records || 0) >= 2);
        const pool = validSst.length > 0 ? validSst : env.sst.filter((b) => typeof b.sst === "number" && (b.records || 0) > 0);
        if (pool.length > 0) {
          const vals = pool.map((b) => b.sst);
          result.tempMinC = String(Math.min(...vals));
          result.tempMaxC = String(Math.max(...vals));
        }
      }

      // Lọc độ sâu thực nghiệm (depth histogram: { from, records }) — bắt buộc records > 0
      if (Array.isArray(env.depth) && env.depth.length > 0) {
        const validDepth = env.depth.filter((b) => typeof b.from === "number" && b.from >= 0 && (b.records || 0) >= 2);
        const pool = validDepth.length > 0 ? validDepth : env.depth.filter((b) => typeof b.from === "number" && b.from >= 0 && (b.records || 0) > 0);
        if (pool.length > 0) {
          const mins = pool.map((b) => b.from);
          result.depthMin = String(Math.min(...mins));
          result.depthMax = String(Math.max(...mins));
        }
      }
    }

    if (scsRes.status === "fulfilled" && scsRes.value) {
      const total = Number(scsRes.value.total || 0);
      result.eastSeaOccurrences = total;
      result.isEastSea = total > 0;
    }
  } catch {
    // Silent fallback
  }

  return result;
}

/**
 * Trích xuất dữ liệu chuẩn từ Wikipedia + Wikidata (trọng lượng, chiều dài, tuổi thọ, IUCN, ảnh)
 */
async function fetchWikipediaAndWikidata(viTitle, sciName) {
  const out = {
    extract: null,
    lang: null,
    photos: [],
    wikibaseItem: null,
    weightKg: null,
    lengthCm: null,
    lifespanYears: null,
    conservationStatus: null,
    aphiaID: null,
    gbifKey: null,
    wikiUrl: null,
  };

  let wikiData = null;
  const candidates = [];
  if (viTitle) candidates.push({ domain: "vi", title: viTitle.replace(/ /g, "_") });
  if (sciName) {
    candidates.push({ domain: "vi", title: sciName.replace(/ /g, "_") });
    candidates.push({ domain: "en", title: sciName.replace(/ /g, "_") });
  }

  for (const c of candidates) {
    try {
      const res = await fetch(
        `https://${c.domain}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(c.title)}`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.extract) {
          if (!wikiData || (c.domain === "vi" && out.lang !== "vi")) {
            wikiData = json;
            out.extract = json.extract;
            out.lang = c.domain;
            out.wikibaseItem = json.wikibase_item || out.wikibaseItem;
            out.wikiUrl = json.content_urls?.desktop?.page || null;
          }
          if (json.originalimage?.source) out.photos.push(json.originalimage.source);
          else if (json.thumbnail?.source) out.photos.push(json.thumbnail.source);
          if (c.domain === "vi" && json.wikibase_item) break;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Nếu có QID Wikidata -> gọi Wikidata wbgetentities lấy thông số vật lý chính thống
  const qid = out.wikibaseItem;
  if (qid) {
    try {
      const wdRes = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&format=json&props=claims`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(5000) }
      );
      if (wdRes.ok) {
        const wdJson = await wdRes.json();
        const claims = wdJson?.entities?.[qid]?.claims || {};

        // P850 = WoRMS AphiaID, P846 = GBIF Taxon ID
        const p850 = claims.P850?.[0]?.mainsnak?.datavalue?.value;
        if (p850) out.aphiaID = Number(p850) || null;
        const p846 = claims.P846?.[0]?.mainsnak?.datavalue?.value;
        if (p846) out.gbifKey = Number(p846) || null;

        // P141 = IUCN Conservation Status
        const p141Id = claims.P141?.[0]?.mainsnak?.datavalue?.value?.id;
        if (p141Id && WIKIDATA_IUCN_MAP[p141Id]) {
          out.conservationStatus = WIKIDATA_IUCN_MAP[p141Id];
        }

        // P2067 = Mass (Cân nặng -> đổi ra kg)
        const p2067 = claims.P2067?.[0]?.mainsnak?.datavalue?.value;
        if (p2067?.amount) {
          const val = Math.abs(parseFloat(p2067.amount));
          const unit = p2067.unit || "";
          if (!Number.isNaN(val)) {
            if (unit.endsWith("Q11570")) out.weightKg = val; // kilogram
            else if (unit.endsWith("Q100995")) out.weightKg = Number((val * 0.45359237).toFixed(1)); // pound -> kg
            else if (unit.endsWith("Q41803")) out.weightKg = Number((val / 1000).toFixed(3)); // gram -> kg
            else if (unit.endsWith("Q191118")) out.weightKg = val * 1000; // tonne -> kg
          }
        }

        // P2043 = Length (Chiều dài -> đổi ra cm)
        const p2043 = claims.P2043?.[0]?.mainsnak?.datavalue?.value;
        if (p2043?.amount) {
          const val = Math.abs(parseFloat(p2043.amount));
          const unit = p2043.unit || "";
          if (!Number.isNaN(val)) {
            if (unit.endsWith("Q11573")) out.lengthCm = val * 100; // meter -> cm
            else if (unit.endsWith("Q174728")) out.lengthCm = val; // cm
            else if (unit.endsWith("Q174789")) out.lengthCm = Number((val / 10).toFixed(2)); // mm -> cm
            else if (unit.endsWith("Q3710")) out.lengthCm = Number((val * 30.48).toFixed(1)); // foot -> cm
            else if (unit.endsWith("Q218593")) out.lengthCm = Number((val * 2.54).toFixed(1)); // inch -> cm
          }
        }

        // P2250 = Life expectancy (Tuổi thọ -> năm)
        const p2250 = claims.P2250?.[0]?.mainsnak?.datavalue?.value;
        if (p2250?.amount) {
          const val = Math.abs(parseFloat(p2250.amount));
          const unit = p2250.unit || "";
          if (!Number.isNaN(val) && unit.endsWith("Q577")) {
            out.lifespanYears = Math.round(val);
          }
        }
      }
    } catch {
      // Silent fallback
    }
  }

  out.photos = [...new Set(out.photos)];
  return out;
}

/**
 * Lấy dữ liệu GBIF đầy đủ (usageKey, IUCN Red List, Tên phổ thông, Mô tả, Ảnh)
 */
async function fetchGBIFDetails(sciName) {
  try {
    const matchRes = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sciName)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    );
    if (!matchRes.ok) return null;
    const match = await matchRes.json();
    if (!match || match.matchType === "NONE" || !match.usageKey) return null;

    const usageKey = match.usageKey;
    const [iucnRes, vernRes, descRes, mediaRes] = await Promise.allSettled([
      fetch(`https://api.gbif.org/v1/species/${usageKey}/iucnRedListCategory`, {
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=20`, {
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.gbif.org/v1/species/${usageKey}/descriptions?limit=5`, {
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.gbif.org/v1/species/${usageKey}/media?limit=5`, {
        signal: AbortSignal.timeout(4500),
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const iucnCode =
      iucnRes.status === "fulfilled" ? normalizeIucnCode(iucnRes.value?.category) : null;

    let viName = null;
    let enName = null;
    if (vernRes.status === "fulfilled" && Array.isArray(vernRes.value?.results)) {
      const viObj = vernRes.value.results.find((v) => v.language === "vie" || v.language === "vi");
      const enObj = vernRes.value.results.find((v) => v.language === "eng" || v.language === "en");
      viName = viObj?.vernacularName || null;
      enName = enObj?.vernacularName || null;
    }

    let description = null;
    if (descRes.status === "fulfilled" && Array.isArray(descRes.value?.results) && descRes.value.results.length > 0) {
      description = descRes.value.results[0].description.replace(/<[^>]*>?/gm, "").trim();
    }

    const photos = [];
    if (mediaRes.status === "fulfilled" && Array.isArray(mediaRes.value?.results)) {
      for (const m of mediaRes.value.results) {
        if (m.type === "StillImage" && m.identifier) photos.push(m.identifier);
      }
    }

    return {
      usageKey,
      canonicalName: match.canonicalName || match.scientificName,
      scientificName: match.scientificName,
      kingdom: match.kingdom,
      phylum: match.phylum,
      class: match.class,
      order: match.order,
      family: match.family,
      genus: match.genus,
      iucnCode,
      viName,
      enName,
      description,
      photos,
      url: `https://www.gbif.org/species/${usageKey}`,
    };
  } catch {
    return null;
  }
}

export class TaxonomyService {
  /**
   * Tra cứu phân loại học sinh vật theo nguồn chỉ định (Zero-Fabrication)
   */
  async searchTaxonomy(query, provider = "auto") {
    const rawQuery = (query || "").trim();
    if (!rawQuery) {
      return { success: false, message: "Từ khóa tra cứu không được để trống" };
    }

    const selectedProvider = (provider || "auto").toLowerCase();
    const cleanQ = rawQuery.toLowerCase();
    const cacheKey = `taxa_v2_${selectedProvider}_${cleanQ}`;

    if (taxonomyCache.has(cacheKey)) {
      const cached = taxonomyCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { success: true, fromCache: true, ...cached.resultData };
      }
    }

    console.log(`[TAXONOMY GATEWAY] Tra cứu: "${rawQuery}" | Nguồn: [${selectedProvider.toUpperCase()}]`);

    try {
      if (selectedProvider === "wikipedia") {
        return await this.searchWikipediaDirect(rawQuery, cacheKey);
      }
      if (selectedProvider === "fishbase") {
        return await this.searchFishBaseDirect(rawQuery, cacheKey);
      }
      if (selectedProvider === "inaturalist") {
        return await this.searchINaturalistDirect(rawQuery, cacheKey);
      }
      if (selectedProvider === "gbif") {
        return await this.searchGBIFDirect(rawQuery, cacheKey);
      }
      if (selectedProvider === "worms") {
        return await this.searchWoRMSDirect(rawQuery, cacheKey);
      }
      if (selectedProvider === "obis") {
        return await this.searchOBISDirect(rawQuery, cacheKey);
      }
      return await this.searchAutoGateway(rawQuery, cacheKey);
    } catch (err) {
      console.error(`[TAXONOMY GATEWAY] Lỗi tra cứu ${selectedProvider}:`, err);
      return {
        success: false,
        isFound: false,
        message: `Lỗi kết nối tra cứu từ ${selectedProvider.toUpperCase()}: ${err.message}`,
      };
    }
  }

  /**
   * Gateway Hợp nhất Đa nguồn Chính thống (Gemini + WoRMS + OBIS + GBIF + iNaturalist + Wikipedia/Wikidata)
   * Chỉ sử dụng số liệu đo đạc & định danh có thật từ nguồn khoa học.
   */
  async searchAutoGateway(rawQuery, cacheKey) {
    // 1. Phân tích ngữ nghĩa & dịch từ khóa chuẩn tên khoa học qua Gemini AI
    const aiAnalysis = await aiTaxonomyService.analyzeWithAI(rawQuery);

    if (aiAnalysis) {
      if (!aiAnalysis.isValidCreature) {
        const resultData = {
          isFound: false,
          isMarine: false,
          message: `Từ khóa "${rawQuery}" không phải sinh vật có thật trong tự nhiên. Không hỗ trợ nạp vào dữ liệu khoa học.`,
        };
        taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
        return { success: false, ...resultData };
      }

      if (aiAnalysis.isMarine === false) {
        const resultData = {
          isFound: true,
          isMarine: false,
          isPacific: false,
          warningMessage: `Cảnh báo xác thực: "${aiAnalysis.commonNameVi || rawQuery}" thuộc nhóm sinh vật trên cạn hoặc nước ngọt, không thuộc hệ sinh thái biển.`,
          data: {
            name: aiAnalysis.commonNameVi || rawQuery,
            scientificName: aiAnalysis.scientificName || rawQuery,
            description: aiAnalysis.descriptionVi || "",
            photos: [],
            mediaItems: [],
            groupId: aiAnalysis.bioSpecs?.groupId || "1",
            oceanZone: null,
            diet: aiAnalysis.bioSpecs?.diet || null,
            depthMin: null,
            depthMax: null,
            sizeMinCm: aiAnalysis.bioSpecs?.sizeMinCm || null,
            sizeMaxCm: aiAnalysis.bioSpecs?.sizeMaxCm || null,
            weightMinKg: aiAnalysis.bioSpecs?.weightMinKg || null,
            weightMaxKg: aiAnalysis.bioSpecs?.weightMaxKg || null,
            lifespanYears: aiAnalysis.bioSpecs?.lifespanYears || null,
            tempMinC: null,
            tempMaxC: null,
            geoZone: aiAnalysis.geoZone || "Ngoài hệ sinh thái biển",
            apiSource: "AI Taxonomy Verification",
          },
        };
        taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
        return { success: true, ...resultData };
      }
    }

    const searchQuery =
      aiAnalysis?.scientificName || translateMarineQuery(rawQuery);

    // 2. Truy vấn song song iNaturalist & GBIF & WoRMS để định danh chuẩn
    const [inatRes, gbifInfo, wormsPre] = await Promise.all([
      fetch(
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(searchQuery)}&per_page=3`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) }
      )
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] })),
      fetchGBIFDetails(searchQuery),
      verifyWithWoRMS(searchQuery, false),
    ]);

    const inatItem = inatRes.results?.[0] || null;
    const sciName =
      wormsPre.validName ||
      gbifInfo?.canonicalName ||
      inatItem?.name ||
      aiAnalysis?.scientificName ||
      searchQuery;

    // Nếu WoRMS chưa match ở bước đầu -> thử lại bằng sciName chuẩn
    const wormsCheck = wormsPre.inWoRMS
      ? wormsPre
      : await verifyWithWoRMS(sciName, false);

    if (!wormsCheck.inWoRMS && !gbifInfo && !inatItem) {
      return {
        success: false,
        isFound: false,
        message: `Không tìm thấy dữ liệu xác thực cho "${rawQuery}" trên WoRMS, GBIF và iNaturalist.`,
      };
    }

    // 3. Truy vấn song song: OBIS Environmental Stats, WoRMS Distributions, Wikipedia + Wikidata, iNaturalist Taxon Detail Photos
    const [obisMetrics, wormsDist, wikiInfo, inatDetailPhotos] = await Promise.all([
      fetchOBISMetrics(wormsCheck.aphiaID, sciName),
      fetchWoRMSDistributions(wormsCheck.aphiaID),
      fetchWikipediaAndWikidata(aiAnalysis?.commonNameVi || rawQuery, sciName),
      fetchINaturalistPhotosById(inatItem?.id, 6),
    ]);

    // Xác thực sinh vật biển chính thức (ưu tiên WoRMS & OBIS)
    const isMarineConfirmed = wormsCheck.inWoRMS
      ? wormsCheck.isMarine || Boolean(wormsCheck.isBrackish)
      : obisMetrics.isMarine !== null
      ? obisMetrics.isMarine
      : true;

    const warningMessage = !isMarineConfirmed
      ? `Cảnh báo WoRMS/OBIS: "${sciName}" không được ghi nhận là sinh vật biển chính danh.`
      : null;

    // Thu thập ảnh thực tế từ iNaturalist Detail (/v1/taxa/{id}) -> Wikipedia/Wikidata -> GBIF Media
    const photoSet = new Set(inatDetailPhotos);
    if (photoSet.size === 0 && inatItem?.taxon_photos?.length > 0) {
      inatItem.taxon_photos.forEach((tp) => {
        const u = tp.photo?.large_url || tp.photo?.medium_url;
        if (u) photoSet.add(u);
      });
    }
    if (photoSet.size === 0 && inatItem?.default_photo) {
      const defUrl = inatItem.default_photo.large_url || inatItem.default_photo.medium_url;
      if (defUrl) photoSet.add(defUrl);
    }
    wikiInfo.photos.forEach((u) => photoSet.add(u));
    (gbifInfo?.photos || []).forEach((u) => photoSet.add(u));

    const photos = [...photoSet].slice(0, 8);
    const mediaItems = photos.map((url) => ({ url, type: "image" }));

    // Kết hợp tên phổ thông chuẩn
    const viCommon = aiAnalysis?.commonNameVi || gbifInfo?.viName || null;
    const enCommon = inatItem?.preferred_common_name || gbifInfo?.enName || null;
    const commonName = viCommon
      ? `${viCommon}${enCommon ? ` (${enCommon})` : ""}`
      : enCommon || `${rawQuery} (${sciName})`;

    // Mô tả ưu tiên Wikipedia Tiếng Việt -> AI description -> GBIF / iNaturalist summary
    const rawInatDesc = (inatItem?.wikipedia_summary || "").replace(/<[^>]*>?/gm, "").trim();
    const description =
      (wikiInfo.lang === "vi" ? wikiInfo.extract : null) ||
      aiAnalysis?.descriptionVi ||
      wikiInfo.extract ||
      gbifInfo?.description ||
      rawInatDesc ||
      `Dữ liệu sinh học loài ${sciName} xác thực qua WoRMS / OBIS / GBIF.`;

    // Độ sâu thực nghiệm: Ưu tiên OBIS real occurrence stats -> AI specs
    const depthMin = obisMetrics.depthMin ?? aiAnalysis?.bioSpecs?.depthMin ?? null;
    const depthMax = obisMetrics.depthMax ?? aiAnalysis?.bioSpecs?.depthMax ?? null;
    const tempMinC = obisMetrics.tempMinC ?? aiAnalysis?.bioSpecs?.tempMinC ?? null;
    const tempMaxC = obisMetrics.tempMaxC ?? aiAnalysis?.bioSpecs?.tempMaxC ?? null;

    // Hình thái: Ưu tiên Wikidata Claims -> AI specs (Tuyệt đối KHÔNG hardcode default)
    const sizeMinCm = aiAnalysis?.bioSpecs?.sizeMinCm ?? (wikiInfo.lengthCm ? String(wikiInfo.lengthCm) : null);
    const sizeMaxCm = aiAnalysis?.bioSpecs?.sizeMaxCm ?? (wikiInfo.lengthCm ? String(wikiInfo.lengthCm) : null);
    const weightMinKg = aiAnalysis?.bioSpecs?.weightMinKg ?? (wikiInfo.weightKg ? String(wikiInfo.weightKg) : null);
    const weightMaxKg = aiAnalysis?.bioSpecs?.weightMaxKg ?? (wikiInfo.weightKg ? String(wikiInfo.weightKg) : null);
    const lifespanYears =
      aiAnalysis?.bioSpecs?.lifespanYears ??
      (wikiInfo.lifespanYears ? String(wikiInfo.lifespanYears) : null);

    const oceanZone =
      deriveOceanZone(depthMin, depthMax) ||
      aiAnalysis?.bioSpecs?.oceanZone ||
      null;

    // IUCN Conservation Status: Ưu tiên OBIS/WoRMS -> GBIF IUCN -> Wikidata -> AI
    const conservationStatus =
      obisMetrics.conservationStatus ||
      gbifInfo?.iucnCode ||
      wikiInfo.conservationStatus ||
      normalizeIucnCode(aiAnalysis?.conservationStatus) ||
      null;

    // Phân bố Biển Đông thực chứng (Kiểm tra bằng OBIS East Sea polygon hoặc WoRMS Distributions)
    const isEastSeaConfirmed =
      obisMetrics.isEastSea === true || wormsDist.isEastSea === true;

    let geoZone = null;
    if (isEastSeaConfirmed) {
      geoZone = `Biển Đông (${obisMetrics.eastSeaOccurrences} ghi nhận OBIS)`;
    } else if (wormsDist.localities.length > 0) {
      geoZone = wormsDist.localities.slice(0, 3).join(", ");
    } else if (aiAnalysis?.geoZone) {
      geoZone = aiAnalysis.geoZone;
    }

    const aphiaID = wormsCheck.aphiaID || wikiInfo.aphiaID || obisMetrics.taxonID || null;
    const sourceApiId = aphiaID
      ? `worms:${aphiaID}`
      : gbifInfo?.usageKey
      ? `gbif:${gbifInfo.usageKey}`
      : inatItem?.id
      ? `inat:${inatItem.id}`
      : null;

    const resultData = {
      isFound: true,
      isMarine: isMarineConfirmed,
      isPacific: isEastSeaConfirmed || isMarineConfirmed,
      isEastSea: isEastSeaConfirmed,
      warningMessage,
      data: {
        name: commonName,
        scientificName: sciName,
        description,
        photos,
        mediaItems,
        groupId:
          aiAnalysis?.bioSpecs?.groupId ||
          inferGroupIdFromTaxonomy(wormsCheck.inWoRMS ? wormsCheck : gbifInfo || obisMetrics.taxonomy),
        oceanZone,
        conservationStatus,
        diet: aiAnalysis?.bioSpecs?.diet || null,
        depthMin: depthMin !== null ? String(depthMin) : "",
        depthMax: depthMax !== null ? String(depthMax) : "",
        sizeMinCm: sizeMinCm !== null ? String(sizeMinCm) : "",
        sizeMaxCm: sizeMaxCm !== null ? String(sizeMaxCm) : "",
        weightMinKg: weightMinKg !== null ? String(weightMinKg) : "",
        weightMaxKg: weightMaxKg !== null ? String(weightMaxKg) : "",
        lifespanYears: lifespanYears !== null ? String(lifespanYears) : "",
        tempMinC: tempMinC !== null ? String(tempMinC) : "",
        tempMaxC: tempMaxC !== null ? String(tempMaxC) : "",
        geoZone,
        aphiaID,
        gbifKey: gbifInfo?.usageKey || wikiInfo.gbifKey || null,
        wikidataId: wikiInfo.wikibaseItem || null,
        source_api_id: sourceApiId,
        sourceUrl: wormsCheck.url || gbifInfo?.url || wikiInfo.wikiUrl || null,
        apiSource: "Multi-Source Scientific Gateway (WoRMS + OBIS + GBIF + iNaturalist + Wikidata)",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp từ Wikipedia REST + Wikidata (Không tự bịa thông số còn thiếu)
   */
  async searchWikipediaDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const wikiInfo = await fetchWikipediaAndWikidata(query, translated);

    if (!wikiInfo.extract) {
      return {
        success: false,
        isFound: false,
        message: `Wikipedia API: Không tìm thấy bài viết bách khoa cho từ khóa "${query}".`,
      };
    }

    const wormsCheck = await verifyWithWoRMS(translated, true);
    const sciName = wormsCheck.validName || translated;

    const resultData = {
      isFound: true,
      isMarine: wormsCheck.inWoRMS ? wormsCheck.isMarine : true,
      isPacific: wormsCheck.inWoRMS ? wormsCheck.isMarine : true,
      warningMessage:
        wormsCheck.inWoRMS && !wormsCheck.isMarine
          ? `Cảnh báo WoRMS: "${sciName}" không phải sinh vật biển.`
          : null,
      data: {
        name: query,
        scientificName: sciName,
        description: wikiInfo.extract,
        photos: wikiInfo.photos,
        mediaItems: wikiInfo.photos.map((url) => ({ url, type: "image" })),
        groupId: inferGroupIdFromTaxonomy(wormsCheck),
        oceanZone: null,
        conservationStatus: wikiInfo.conservationStatus || null,
        diet: null,
        depthMin: "",
        depthMax: "",
        sizeMinCm: wikiInfo.lengthCm ? String(wikiInfo.lengthCm) : "",
        sizeMaxCm: wikiInfo.lengthCm ? String(wikiInfo.lengthCm) : "",
        weightMinKg: wikiInfo.weightKg ? String(wikiInfo.weightKg) : "",
        weightMaxKg: wikiInfo.weightKg ? String(wikiInfo.weightKg) : "",
        lifespanYears: wikiInfo.lifespanYears ? String(wikiInfo.lifespanYears) : "",
        tempMinC: "",
        tempMaxC: "",
        geoZone: null,
        aphiaID: wormsCheck.aphiaID || wikiInfo.aphiaID || null,
        source_api_id: wormsCheck.aphiaID ? `worms:${wormsCheck.aphiaID}` : wikiInfo.wikibaseItem ? `wikidata:${wikiInfo.wikibaseItem}` : null,
        sourceUrl: wikiInfo.wikiUrl,
        apiSource: `Wikipedia (${wikiInfo.lang === "vi" ? "Tiếng Việt" : "English"})${wikiInfo.wikibaseItem ? " + Wikidata" : ""}`,
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp qua FishBase Dataset (GBIF) + WoRMS Attributes + OBIS Env Stats
   */
  async searchFishBaseDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const [gbifInfo, wormsCheck] = await Promise.all([
      fetchGBIFDetails(translated),
      verifyWithWoRMS(translated, true),
    ]);

    const sciName = wormsCheck.validName || gbifInfo?.canonicalName;
    if (!sciName) {
      return {
        success: false,
        isFound: false,
        message: `FishBase/WoRMS Gateway: Không tìm thấy định danh khoa học cho "${query}".`,
      };
    }

    const [obisMetrics, wormsDist, inatRes] = await Promise.all([
      fetchOBISMetrics(wormsCheck.aphiaID, sciName),
      fetchWoRMSDistributions(wormsCheck.aphiaID),
      fetch(
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sciName)}&per_page=1`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(4000) }
      )
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] })),
    ]);

    const photos = [];
    if (inatRes.results?.[0]?.default_photo?.medium_url) {
      photos.push(inatRes.results[0].default_photo.medium_url);
    }

    const family = wormsCheck.family || gbifInfo?.family || "Chưa rõ";
    const order = wormsCheck.order || gbifInfo?.order || "Chưa rõ";

    const resultData = {
      isFound: true,
      isMarine: wormsCheck.inWoRMS ? wormsCheck.isMarine : true,
      isPacific: true,
      isEastSea: obisMetrics.isEastSea === true || wormsDist.isEastSea === true,
      data: {
        name: `${gbifInfo?.viName || query} (${sciName})`,
        scientificName: sciName,
        description:
          gbifInfo?.description ||
          `Dữ liệu phân loại học & chỉ số môi trường đo đạc từ FishBase/WoRMS & OBIS cho loài ${sciName} (Họ: ${family}, Bộ: ${order}).`,
        photos,
        mediaItems: photos.map((url) => ({ url, type: "image" })),
        groupId: inferGroupIdFromTaxonomy(wormsCheck.inWoRMS ? wormsCheck : gbifInfo),
        oceanZone: deriveOceanZone(obisMetrics.depthMin, obisMetrics.depthMax),
        conservationStatus: obisMetrics.conservationStatus || gbifInfo?.iucnCode || null,
        diet: null,
        depthMin: obisMetrics.depthMin ?? "",
        depthMax: obisMetrics.depthMax ?? "",
        sizeMinCm: "",
        sizeMaxCm: "",
        weightMinKg: "",
        weightMaxKg: "",
        lifespanYears: "",
        tempMinC: obisMetrics.tempMinC ?? "",
        tempMaxC: obisMetrics.tempMaxC ?? "",
        geoZone: obisMetrics.isEastSea
          ? `Biển Đông (${obisMetrics.eastSeaOccurrences} ghi nhận OBIS)`
          : wormsDist.localities.slice(0, 3).join(", ") || null,
        aphiaID: wormsCheck.aphiaID || obisMetrics.taxonID || null,
        source_api_id: wormsCheck.aphiaID ? `worms:${wormsCheck.aphiaID}` : gbifInfo?.usageKey ? `gbif:${gbifInfo.usageKey}` : null,
        sourceUrl: wormsCheck.url || gbifInfo?.url || null,
        apiSource: "WoRMS + OBIS Env Stats + GBIF Catalog of Fishes",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp từ iNaturalist API (kèm xác thực sinh vật biển qua WoRMS)
   */
  async searchINaturalistDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(translated)}&per_page=1`;
    const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) }).then((r) => r.json());

    if (!res.results || res.results.length === 0) {
      return { success: false, isFound: false, message: `iNaturalist API: Không tìm thấy loài "${query}".` };
    }

    const item = res.results[0];
    const sciName = item.name || translated;
    const commonName = item.preferred_common_name ? `${item.preferred_common_name} (${sciName})` : `${query} (${sciName})`;

    const [wormsCheck, detailPhotos] = await Promise.all([
      verifyWithWoRMS(sciName, false),
      fetchINaturalistPhotosById(item.id, 6),
    ]);
    const isMarine = wormsCheck.inWoRMS ? wormsCheck.isMarine : true;

    let photos = detailPhotos;
    if (photos.length === 0 && item.taxon_photos?.length > 0) {
      photos = item.taxon_photos.map((p) => p.photo?.large_url || p.photo?.medium_url).filter(Boolean).slice(0, 6);
    } else if (photos.length === 0 && item.default_photo) {
      photos = [item.default_photo.large_url || item.default_photo.medium_url || item.default_photo.url].filter(Boolean);
    }

    const resultData = {
      isFound: true,
      isMarine,
      isPacific: isMarine,
      warningMessage: !isMarine ? `Cảnh báo WoRMS: "${sciName}" không phải là sinh vật biển.` : null,
      data: {
        name: commonName,
        scientificName: sciName,
        description:
          (item.wikipedia_summary || "").replace(/<[^>]*>?/gm, "").trim() ||
          `Ghi nhận thực địa từ cộng đồng iNaturalist cho loài ${sciName} (${item.observations_count || 0} quan sát).`,
        photos,
        mediaItems: photos.map((u) => ({ url: u, type: "image" })),
        groupId: inferGroupIdFromTaxonomy(wormsCheck),
        oceanZone: null,
        conservationStatus: normalizeIucnCode(item.conservation_status?.status) || null,
        diet: null,
        depthMin: "",
        depthMax: "",
        sizeMinCm: "",
        sizeMaxCm: "",
        weightMinKg: "",
        weightMaxKg: "",
        lifespanYears: "",
        tempMinC: "",
        tempMaxC: "",
        geoZone: null,
        aphiaID: wormsCheck.aphiaID || null,
        inaturalistId: item.id,
        source_api_id: wormsCheck.aphiaID ? `worms:${wormsCheck.aphiaID}` : `inat:${item.id}`,
        sourceUrl: `https://www.inaturalist.org/taxa/${item.id}`,
        apiSource: "iNaturalist Community API",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp từ GBIF API (kèm xác thực WoRMS & IUCN Red List thật)
   */
  async searchGBIFDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const gbifInfo = await fetchGBIFDetails(translated);
    if (!gbifInfo) {
      return { success: false, isFound: false, message: `GBIF API: Không tìm thấy loài "${query}".` };
    }

    const wormsCheck = await verifyWithWoRMS(gbifInfo.canonicalName, false);
    const isMarine = wormsCheck.inWoRMS ? wormsCheck.isMarine : false;

    const resultData = {
      isFound: true,
      isMarine,
      isPacific: isMarine,
      warningMessage: !isMarine
        ? `Cảnh báo xác thực WoRMS: "${gbifInfo.canonicalName}" không có xác nhận sinh vật biển trên WoRMS.`
        : null,
      data: {
        name: gbifInfo.viName || gbifInfo.enName || `${query} (${gbifInfo.canonicalName})`,
        scientificName: gbifInfo.canonicalName,
        description:
          gbifInfo.description ||
          `Dữ liệu phân loại từ GBIF (Họ: ${gbifInfo.family || "N/A"}, Bộ: ${gbifInfo.order || "N/A"}, Giới: ${gbifInfo.kingdom || "Animalia"}).`,
        photos: gbifInfo.photos,
        mediaItems: gbifInfo.photos.map((url) => ({ url, type: "image" })),
        groupId: inferGroupIdFromTaxonomy(gbifInfo),
        oceanZone: null,
        conservationStatus: gbifInfo.iucnCode || null,
        diet: null,
        depthMin: "",
        depthMax: "",
        sizeMinCm: "",
        sizeMaxCm: "",
        weightMinKg: "",
        weightMaxKg: "",
        lifespanYears: "",
        tempMinC: "",
        tempMaxC: "",
        geoZone: null,
        aphiaID: wormsCheck.aphiaID || null,
        gbifKey: gbifInfo.usageKey,
        source_api_id: `gbif:${gbifInfo.usageKey}`,
        sourceUrl: gbifInfo.url,
        apiSource: "GBIF Species API + IUCN Red List",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp từ WoRMS Registry (World Register of Marine Species)
   */
  async searchWoRMSDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const wormsCheck = await verifyWithWoRMS(translated, true);

    if (!wormsCheck.inWoRMS) {
      return { success: false, isFound: false, message: `WoRMS API: Không tìm thấy loài "${query}".` };
    }

    const wormsDist = await fetchWoRMSDistributions(wormsCheck.aphiaID);

    const resultData = {
      isFound: true,
      isMarine: wormsCheck.isMarine,
      isPacific: wormsCheck.isMarine,
      isEastSea: wormsDist.isEastSea === true,
      warningMessage: !wormsCheck.isMarine
        ? `Cảnh báo WoRMS: Sinh vật "${wormsCheck.validName}" không phải sinh vật biển chính danh.`
        : null,
      data: {
        name: `${query} (${wormsCheck.validName})`,
        scientificName: wormsCheck.validName,
        description: `Sổ bộ Loài biển Thế giới (WoRMS AphiaID: ${wormsCheck.aphiaID}, Trạng thái: ${wormsCheck.status || "accepted"}, Họ: ${wormsCheck.family || "N/A"}, Bộ: ${wormsCheck.order || "N/A"}).`,
        photos: [],
        mediaItems: [],
        groupId: inferGroupIdFromTaxonomy(wormsCheck),
        oceanZone: null,
        conservationStatus: null,
        diet: null,
        depthMin: "",
        depthMax: "",
        sizeMinCm: "",
        sizeMaxCm: "",
        weightMinKg: "",
        weightMaxKg: "",
        lifespanYears: "",
        tempMinC: "",
        tempMaxC: "",
        geoZone: wormsDist.localities.slice(0, 4).join(", ") || null,
        aphiaID: wormsCheck.aphiaID,
        source_api_id: `worms:${wormsCheck.aphiaID}`,
        sourceUrl: wormsCheck.url,
        apiSource: "WoRMS Marine Species Register",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu trực tiếp từ UNESCO OBIS (Không trả fake success nếu không có dữ liệu!)
   */
  async searchOBISDirect(query, cacheKey) {
    const translated = translateMarineQuery(query);
    const obisMetrics = await fetchOBISMetrics(null, translated);

    if (!obisMetrics.taxonID || !obisMetrics.taxonomy?.scientificName) {
      return {
        success: false,
        isFound: false,
        message: `OBIS API: Không tìm thấy đơn vị phân loại biển cho "${query}".`,
      };
    }

    const sciName = obisMetrics.taxonomy.scientificName;
    const isMarine = obisMetrics.isMarine !== false;

    const resultData = {
      isFound: true,
      isMarine,
      isPacific: isMarine,
      isEastSea: obisMetrics.isEastSea === true,
      data: {
        name: `${query} (${sciName})`,
        scientificName: sciName,
        description: `Hệ thống Đa dạng Sinh học Đại dương Quốc tế UNESCO OBIS (TaxonID: ${obisMetrics.taxonID}, Họ: ${obisMetrics.taxonomy.family || "N/A"}).${
          obisMetrics.eastSeaOccurrences > 0
            ? ` Có ${obisMetrics.eastSeaOccurrences} ghi nhận thực địa tại vùng Biển Đông.`
            : ""
        }`,
        photos: [],
        mediaItems: [],
        groupId: inferGroupIdFromTaxonomy(obisMetrics.taxonomy),
        oceanZone: deriveOceanZone(obisMetrics.depthMin, obisMetrics.depthMax),
        conservationStatus: obisMetrics.conservationStatus,
        diet: null,
        depthMin: obisMetrics.depthMin ?? "",
        depthMax: obisMetrics.depthMax ?? "",
        sizeMinCm: "",
        sizeMaxCm: "",
        weightMinKg: "",
        weightMaxKg: "",
        lifespanYears: "",
        tempMinC: obisMetrics.tempMinC ?? "",
        tempMaxC: obisMetrics.tempMaxC ?? "",
        geoZone:
          obisMetrics.isEastSea === true
            ? `Biển Đông (${obisMetrics.eastSeaOccurrences} ghi nhận OBIS)`
            : "Phân bố ngoài vùng Biển Đông",
        aphiaID: obisMetrics.taxonID,
        source_api_id: `obis:${obisMetrics.taxonID}`,
        sourceUrl: `https://obis.org/taxon/${obisMetrics.taxonID}`,
        apiSource: "UNESCO OBIS Ocean Biodiversity API v3",
      },
    };

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
    return { success: true, fromCache: false, ...resultData };
  }

  /**
   * Tra cứu 7 bậc phân loại học chính xác (Kingdom -> Species) từ WoRMS / GBIF / OBIS theo source_api_id hoặc scientificName
   * Dùng cho endpoint chi tiết loài, tránh tự chế họ kiểu `${genus}idae` ở frontend.
   */
  async getTaxonHierarchy(sourceApiId, scientificName) {
    const cleanSource = sourceApiId ? String(sourceApiId).trim() : "";
    const cleanName = scientificName ? String(scientificName).trim() : "";
    if (!cleanSource && !cleanName) return null;

    const cacheKey = `hierarchy:${cleanSource || cleanName.toLowerCase()}`;
    const cached = taxonomyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.resultData;
    }

    let hierarchy = null;

    try {
      if (cleanSource.startsWith("worms:")) {
        const aphiaId = cleanSource.slice(6);
        const res = await fetch(`https://www.marinespecies.org/rest/AphiaRecordByAphiaID/${encodeURIComponent(aphiaId)}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
          const rec = await res.json();
          if (rec && (rec.kingdom || rec.phylum || rec.family)) {
            hierarchy = {
              kingdom: rec.kingdom || null,
              phylum: rec.phylum || null,
              class: rec.class || null,
              order: rec.order || null,
              family: rec.family || null,
              genus: rec.genus || null,
              species: rec.valid_name || rec.scientificname || cleanName || null,
              source: `WoRMS (${aphiaId})`,
            };
          }
        }
      } else if (cleanSource.startsWith("gbif:")) {
        const key = cleanSource.slice(5);
        const res = await fetch(`https://api.gbif.org/v1/species/${encodeURIComponent(key)}`, {
          headers: WIKI_HEADERS,
          signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
          const rec = await res.json();
          if (rec && (rec.kingdom || rec.phylum || rec.family)) {
            hierarchy = {
              kingdom: rec.kingdom || null,
              phylum: rec.phylum || null,
              class: rec.class || null,
              order: rec.order || null,
              family: rec.family || null,
              genus: rec.genus || null,
              species: rec.canonicalName || rec.species || cleanName || null,
              source: `GBIF (${key})`,
            };
          }
        }
      } else if (cleanSource.startsWith("obis:")) {
        const taxonId = cleanSource.slice(5);
        const res = await fetch(`https://api.obis.org/v3/taxon/${encodeURIComponent(taxonId)}`, {
          headers: WIKI_HEADERS,
          signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
          const payload = await res.json();
          const rec = payload?.results?.[0];
          if (rec && (rec.kingdom || rec.phylum || rec.family)) {
            hierarchy = {
              kingdom: rec.kingdom || null,
              phylum: rec.phylum || null,
              class: rec.class || null,
              order: rec.order || null,
              family: rec.family || null,
              genus: rec.genus || null,
              species: rec.scientificName || cleanName || null,
              source: `OBIS (${taxonId})`,
            };
          }
        }
      }

      // Fallback theo tên khoa học nếu chưa có source_api_id hoặc ID lookup chưa trả dữ liệu
      if (!hierarchy && cleanName && !/ecosystem|habitat|community/i.test(cleanName)) {
        const wormsCheck = await verifyWithWoRMS(cleanName, false);
        if (wormsCheck.inWoRMS && (wormsCheck.kingdom || wormsCheck.phylum || wormsCheck.family)) {
          hierarchy = {
            kingdom: wormsCheck.kingdom || null,
            phylum: wormsCheck.phylum || null,
            class: wormsCheck.class || null,
            order: wormsCheck.order || null,
            family: wormsCheck.family || null,
            genus: wormsCheck.genus || null,
            species: wormsCheck.validName || cleanName,
            source: wormsCheck.aphiaID ? `WoRMS (${wormsCheck.aphiaID})` : "WoRMS",
          };
        } else {
          const gbifInfo = await fetchGBIFDetails(cleanName);
          if (gbifInfo && (gbifInfo.kingdom || gbifInfo.phylum || gbifInfo.family)) {
            hierarchy = {
              kingdom: gbifInfo.kingdom || null,
              phylum: gbifInfo.phylum || null,
              class: gbifInfo.class || null,
              order: gbifInfo.order || null,
              family: gbifInfo.family || null,
              genus: gbifInfo.genus || null,
              species: gbifInfo.canonicalName || cleanName,
              source: gbifInfo.key ? `GBIF (${gbifInfo.key})` : "GBIF",
            };
          }
        }
      }
    } catch {
      // Silent fallback -> return null rather than fabricating taxonomy
    }

    taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData: hierarchy });
    return hierarchy;
  }
}

export default new TaxonomyService();
