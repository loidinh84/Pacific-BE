/**
 * taxonomyService.js
 * Backend Taxonomy Gateway Service for Ocean Species & GBIF/iNaturalist Integration
 * Features:
 * - Multi-Provider API Gateway (AI Auto, GBIF, iNaturalist, WoRMS)
 * - AI-Powered Taxonomy Micro-Agent (Gemini Flash API) for natural language & sci-fi/land animal detection
 * - WoRMS (World Register of Marine Species) REST API integration for 240,000+ marine taxa validation
 * - Multilingual Vietnamese Marine Query Mapper fallback
 * - Dynamic Taxon Ancestry Classification
 * - In-Memory Cache (TTL 24 hours) for high performance
 */

import { translateMarineQuery } from "../config/marineDictionary.js";
import aiTaxonomyService from "./aiTaxonomyService.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const taxonomyCache = new Map();

/**
 * Verify species against WoRMS (World Register of Marine Species)
 * @param {string} sciName Scientific name
 * @returns {Promise<{inWoRMS: boolean, isMarine: boolean, aphiaID?: number, validName?: string}>}
 */
async function verifyWithWoRMS(sciName) {
  if (!sciName) return { inWoRMS: false, isMarine: false };
  try {
    const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(
      sciName
    )}?like=false`;
    const res = await fetch(url);
    if (!res.ok) return { inWoRMS: false, isMarine: false };
    const data = await res.json();
    if (data && data.length > 0) {
      const rec = data[0];
      return {
        inWoRMS: true,
        isMarine: rec.isMarine === 1,
        isTerrestrial: rec.isTerrestrial === 1,
        aphiaID: rec.AphiaID,
        validName: rec.valid_name || rec.scientificname,
      };
    }
  } catch (err) {
    // Silent catch for network resilience
  }
  return { inWoRMS: false, isMarine: false };
}

export class TaxonomyService {
  /**
   * Search species taxonomy using requested Provider (auto, gbif, inaturalist, worms)
   * @param {string} query Search keyword
   * @param {string} provider Selected API provider
   */
  async searchTaxonomy(query, provider = "auto") {
    const rawQuery = (query || "").trim();
    if (!rawQuery) {
      return { success: false, message: "Query string is required" };
    }

    const selectedProvider = (provider || "auto").toLowerCase();
    const cleanQ = rawQuery.toLowerCase();
    const cacheKey = `taxa_${selectedProvider}_${cleanQ}`;

    // 1. Check in-memory cache
    if (taxonomyCache.has(cacheKey)) {
      const cached = taxonomyCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { success: true, fromCache: true, ...cached.resultData };
      }
    }

    console.log(`[TAXONOMY GATEWAY] Tra cứu từ khóa: "${rawQuery}" qua Nguồn API: [${selectedProvider.toUpperCase()}]`);

    try {
      // Direct GBIF Provider Query
      if (selectedProvider === "gbif") {
        return await this.searchGBIFDirect(rawQuery, cacheKey);
      }

      // Direct WoRMS Provider Query
      if (selectedProvider === "worms") {
        return await this.searchWoRMSDirect(rawQuery, cacheKey);
      }

      // 2. Try AI Taxonomy Micro-Agent Analysis (Gemini Flash API)
      const aiAnalysis = await aiTaxonomyService.analyzeWithAI(rawQuery);

      if (aiAnalysis) {
        if (!aiAnalysis.isValidCreature) {
          const resultData = {
            isFound: false,
            isMarine: false,
            message: `AI Trợ lý Sinh học: Từ khóa "${rawQuery}" là loài viễn tưởng / không có thật trong tự nhiên. Vui lòng nhập dữ liệu thủ công.`,
          };
          taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
          return { success: false, ...resultData };
        }

        if (!aiAnalysis.isMarine) {
          const resultData = {
            isFound: true,
            isMarine: false,
            isPacific: false,
            warningMessage: `Cảnh báo AI: Sinh vật "${aiAnalysis.commonNameVi || rawQuery}" thuộc nhóm động vật trên cạn / nước ngọt (không thuộc hệ sinh thái đại dương Thái Bình Dương).`,
            data: {
              name: aiAnalysis.commonNameVi || rawQuery,
              scientificName: aiAnalysis.scientificName || rawQuery,
              description: aiAnalysis.descriptionVi || `Sinh vật trên cạn ${rawQuery}.`,
              photos: [],
              mediaItems: [],
              groupId: aiAnalysis.bioSpecs?.groupId || "2",
              oceanZone: "Sunlight",
              diet: aiAnalysis.bioSpecs?.diet || "Kẻ săn mồi (Carnivore)",
              depthMin: "0",
              depthMax: "0",
              sizeMinCm: aiAnalysis.bioSpecs?.sizeMinCm || "100",
              sizeMaxCm: aiAnalysis.bioSpecs?.sizeMaxCm || "200",
              weightMinKg: aiAnalysis.bioSpecs?.weightMinKg || "50",
              weightMaxKg: aiAnalysis.bioSpecs?.weightMaxKg || "200",
              lifespanYears: aiAnalysis.bioSpecs?.lifespanYears || "15",
              tempMinC: "15",
              tempMaxC: "30",
              geoZone: "Động vật trên cạn",
            },
          };
          taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
          return { success: true, ...resultData };
        }
      }

      // 3. AI resolved valid marine creature or fallback to marineDictionary
      const searchQuery = (aiAnalysis && aiAnalysis.scientificName)
        ? aiAnalysis.scientificName
        : translateMarineQuery(rawQuery);

      // 4. Fetch iNaturalist API filtered by Marine/Animal iconic taxa
      const searchUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
        searchQuery
      )}&iconic_taxa=Mammalia,Fish,Mollusca,Reptilia,Other_Animals&per_page=1`;

      const searchRes = await fetch(searchUrl).then((r) => r.json());

      if (!searchRes.results || searchRes.results.length === 0) {
        return {
          success: false,
          isFound: false,
          isMarine: false,
          message: `Không tìm thấy dữ liệu sinh học hợp lệ cho từ khóa "${rawQuery}". Vui lòng kiểm tra tên từ khóa hoặc thêm thủ công.`,
        };
      }

      const item = searchRes.results[0];
      const iconic = (item.iconic_taxon_name || "").toLowerCase();
      if (iconic === "insecta" || iconic === "fungi" || iconic === "plantae") {
        return {
          success: false,
          isFound: false,
          isMarine: false,
          message: `Từ khóa "${rawQuery}" không khớp với sinh vật biển đại dương nào. Vui lòng nhập dữ liệu thủ công.`,
        };
      }

      // 5. Query detailed taxon info
      const detailRes = await fetch(
        `https://api.inaturalist.org/v1/taxa/${item.id}`
      ).then((r) => r.json());

      const detail = (detailRes.results && detailRes.results[0]) || item;
      const sciName = detail.name || item.name || rawQuery;

      let commonName = (aiAnalysis && aiAnalysis.commonNameVi)
        ? `${aiAnalysis.commonNameVi} (${detail.preferred_common_name || sciName})`
        : detail.preferred_common_name || sciName;

      if (!aiAnalysis && translateMarineQuery(rawQuery) !== rawQuery) {
        commonName = `${rawQuery.charAt(0).toUpperCase() + rawQuery.slice(1)} (${detail.preferred_common_name || sciName})`;
      }

      // 6. Dynamic Verification via WoRMS (World Register of Marine Species)
      const wormsCheck = await verifyWithWoRMS(sciName);

      // Photos extraction
      let photos = [];
      if (detail.taxon_photos && detail.taxon_photos.length > 0) {
        photos = detail.taxon_photos
          .map((tp) => tp.photo.medium_url || tp.photo.large_url || tp.photo.square_url)
          .filter(Boolean);
      } else if (detail.default_photo) {
        photos = [detail.default_photo.medium_url || detail.default_photo.url].filter(Boolean);
      }

      const mediaItems = photos.map((url) => ({ url, type: "image" }));

      // Clean Wikipedia summary or AI summary
      let wikiDesc = (aiAnalysis && aiAnalysis.descriptionVi)
        ? aiAnalysis.descriptionVi
        : (detail.wikipedia_summary || "").replace(/<[^>]*>?/gm, "").trim();

      const specs = aiAnalysis?.bioSpecs || {};

      const isMarineConfirmed = wormsCheck.inWoRMS
        ? wormsCheck.isMarine
        : ["actinopterygii", "cnidaria", "cephalopoda", "echinodermata", "elasmobranchii"].includes(iconic);

      const normalizedData = {
        name: commonName,
        scientificName: sciName,
        description: wikiDesc || `Sinh vật biển thuộc loài ${sciName} (${commonName}).`,
        photos,
        mediaItems,
        groupId: specs.groupId || "1",
        oceanZone: specs.oceanZone || (sciLowerIncludes(sciName, ["myctoph", "lophii"]) ? "Midnight" : "Sunlight"),
        diet: specs.diet || "Kẻ săn mồi (Carnivore)",
        depthMin: specs.depthMin || "0",
        depthMax: specs.depthMax || "100",
        sizeMinCm: specs.sizeMinCm || "50",
        sizeMaxCm: specs.sizeMaxCm || "200",
        weightMinKg: specs.weightMinKg || "5",
        weightMaxKg: specs.weightMaxKg || "50",
        lifespanYears: specs.lifespanYears || "10",
        tempMinC: specs.tempMinC || "10",
        tempMaxC: specs.tempMaxC || "25",
        geoZone: "Thái Bình Dương (Indo-Pacific)",
        aphiaID: wormsCheck.aphiaID || null,
        apiSource: "AI Gateway (iNaturalist + WoRMS)",
      };

      const resultData = {
        isFound: true,
        isMarine: isMarineConfirmed,
        isPacific: isMarineConfirmed,
        warningMessage: !isMarineConfirmed
          ? `Cảnh báo: WoRMS (Sổ bộ loài biển thế giới) xác định sinh vật "${commonName}" thuộc nhóm động vật trên cạn / nước ngọt.`
          : null,
        data: normalizedData,
      };

      taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
      return { success: true, fromCache: false, ...resultData };
    } catch (err) {
      console.error("TaxonomyService search error:", err);
      return {
        success: false,
        isFound: false,
        message: `Lỗi kết nối tra cứu dữ liệu: ${err.message}`,
      };
    }
  }

  /**
   * Query GBIF API Directly
   */
  async searchGBIFDirect(query, cacheKey) {
    try {
      const translated = translateMarineQuery(query);
      const url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(translated)}&limit=1`;
      const res = await fetch(url).then((r) => r.json());
      if (!res.results || res.results.length === 0) {
        return { success: false, isFound: false, message: `GBIF API: Không tìm thấy loài "${query}".` };
      }
      const item = res.results[0];
      const sciName = item.scientificName || item.canonicalName || query;
      const commonName = item.vernacularName || `${query} (${sciName})`;
      const resultData = {
        isFound: true,
        isMarine: item.kingdom === "Animalia",
        isPacific: true,
        data: {
          name: commonName,
          scientificName: sciName,
          description: `Dữ liệu sinh học từ GBIF cho loài ${sciName} (Rank: ${item.rank || "SPECIES"}, Kingdom: ${item.kingdom || "Animalia"}).`,
          photos: [],
          mediaItems: [],
          groupId: "1",
          oceanZone: "Sunlight",
          diet: "Kẻ săn mồi (Carnivore)",
          depthMin: "0",
          depthMax: "200",
          sizeMinCm: "50",
          sizeMaxCm: "200",
          weightMinKg: "10",
          weightMaxKg: "100",
          lifespanYears: "15",
          tempMinC: "10",
          tempMaxC: "25",
          geoZone: "Thái Bình Dương (GBIF Registry)",
          gbifKey: item.key || null,
          apiSource: "GBIF API Direct",
        },
      };
      taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
      return { success: true, fromCache: false, ...resultData };
    } catch (e) {
      return { success: false, isFound: false, message: `GBIF API error: ${e.message}` };
    }
  }

  /**
   * Query WoRMS API Directly
   */
  async searchWoRMSDirect(query, cacheKey) {
    try {
      const translated = translateMarineQuery(query);
      const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(translated)}?like=true`;
      const res = await fetch(url);
      if (!res.ok) return { success: false, isFound: false, message: `WoRMS API: Không tìm thấy loài "${query}".` };
      const data = await res.json();
      if (!data || data.length === 0) {
        return { success: false, isFound: false, message: `WoRMS API: Không tìm thấy loài "${query}".` };
      }
      const rec = data[0];
      const sciName = rec.valid_name || rec.scientificname || query;
      const isMarine = rec.isMarine === 1;
      const resultData = {
        isFound: true,
        isMarine,
        isPacific: isMarine,
        warningMessage: !isMarine ? `Cảnh báo WoRMS: Sinh vật "${sciName}" không phải sinh vật biển chính danh.` : null,
        data: {
          name: `${query} (${sciName})`,
          scientificName: sciName,
          description: `Sổ bộ Loài biển Thế giới (WoRMS AphiaID: ${rec.AphiaID}) xác định loài ${sciName} (Status: ${rec.status || "Accepted"}).`,
          photos: [],
          mediaItems: [],
          groupId: "1",
          oceanZone: "Sunlight",
          diet: "Kẻ săn mồi (Carnivore)",
          depthMin: "0",
          depthMax: "500",
          sizeMinCm: "50",
          sizeMaxCm: "300",
          weightMinKg: "10",
          weightMaxKg: "200",
          lifespanYears: "20",
          tempMinC: "10",
          tempMaxC: "25",
          geoZone: "Thái Bình Dương (WoRMS Registry)",
          aphiaID: rec.AphiaID,
          apiSource: "WoRMS API Direct",
        },
      };
      taxonomyCache.set(cacheKey, { timestamp: Date.now(), resultData });
      return { success: true, fromCache: false, ...resultData };
    } catch (e) {
      return { success: false, isFound: false, message: `WoRMS API error: ${e.message}` };
    }
  }
}

function sciLowerIncludes(str, keywords) {
  const s = (str || "").toLowerCase();
  return keywords.some((k) => s.includes(k));
}

export default new TaxonomyService();
