import crypto from "crypto";
import prisma from "../lib/prisma.js";

/**
 * vectorSearchService.js
 * Dịch vụ tìm kiếm ngữ nghĩa theo không gian vector (Gemini Embedding 768 chiều)
 * - Tách biệt taskType chuẩn Retrieval: RETRIEVAL_DOCUMENT (index) vs RETRIEVAL_QUERY (truy vấn)
 * - Hỗ trợ Batch Embedding (batchEmbedContents) giúp đồng bộ 320 loài trong vài giây
 * - Lưu trữ bền vững trong PostgreSQL (`species_embeddings`) & nạp sẵn RAM cho tìm kiếm <2ms
 */

const queryVectorCache = new Map();
const MAX_CACHE_SIZE = 500;
const EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIM = 768;
const SEMANTIC_SCHEMA_VERSION = "v2-asymmetric-bio";

const RED_LIST_LABELS = {
  CR: "Cực kỳ nguy cấp (Critically Endangered)",
  EN: "Nguy cấp (Endangered)",
  VU: "Sắp nguy cấp (Vulnerable)",
  NT: "Gần bị đe dọa (Near Threatened)",
  LC: "Ít quan tâm (Least Concern)",
  DD: "Thiếu dữ liệu (Data Deficient)",
  EW: "Tuyệt chủng trong tự nhiên (Extinct in the Wild)",
  EX: "Tuyệt chủng (Extinct)",
  NE: "Chưa đánh giá (Not Evaluated)",
};

const SPECIES_EMBED_INCLUDE = {
  species_groups: { select: { name: true } },
  ocean_zones: { select: { name: true } },
  species_facts: { select: { content: true }, orderBy: { sort_order: "asc" }, take: 3 },
  species_translations: {
    where: { language_code: "en" },
    select: { common_name: true, description: true, diet: true },
    take: 1,
  },
};

function describeDepthTier(minM, maxM) {
  const max = Number(maxM ?? 0);
  const min = Number(minM ?? 0);
  if (!max && !min) return "";
  const tiers = [];
  if (max <= 50) tiers.push("vùng nước nông ven bờ, rạn san hô (shallow reef)");
  else if (max <= 200) tiers.push("tầng mặt ánh sáng (epipelagic / sunlight zone)");
  if (max >= 200 && max < 1000) tiers.push("tầng chạng vạng (twilight / mesopelagic)");
  if (max >= 1000) tiers.push("biển sâu trên 1000m, tầng bóng tối (deep sea / bathypelagic)");
  if (max >= 3000) tiers.push("vùng biển thẳm cực sâu (abyssal / hadal trench)");
  return `Độ sâu phân bố: ${min}m đến ${max}m (${tiers.join(", ")})`;
}

class VectorSearchService {
  constructor() {
    this.speciesIndex = []; // { speciesId, commonName, scientificName, vector: Float32Array }
    this.isInitialized = false;
    this.isSyncing = false;
  }

  /**
   * L2-normalize vector để phép tích vô hướng tương đương Cosine Similarity chính xác
   */
  normalizeVector(values) {
    const vec = new Float32Array(values.length);
    let normSq = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      vec[i] = v;
      normSq += v * v;
    }
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }
    return vec;
  }

  /**
   * Tính Cosine Similarity giữa 2 vector Float32Array
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Sinh vector embedding cho một chuỗi văn bản bằng Gemini Embedding API
   * @param {string} text
   * @param {"RETRIEVAL_QUERY"|"RETRIEVAL_DOCUMENT"} taskType
   * @param {string} [title] Chỉ dùng khi taskType === "RETRIEVAL_DOCUMENT"
   */
  async embedText(text, taskType = "RETRIEVAL_QUERY", title = undefined) {
    if (!text || typeof text !== "string") return null;
    const cleanText = text.trim();
    if (!cleanText) return null;

    const cacheKey = `${taskType}::${cleanText}`;
    if (taskType === "RETRIEVAL_QUERY" && queryVectorCache.has(cacheKey)) {
      return queryVectorCache.get(cacheKey);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[VectorSearch] GEMINI_API_KEY is not configured.");
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
      const body = {
        model: EMBEDDING_MODEL,
        content: { parts: [{ text: cleanText }] },
        taskType,
        outputDimensionality: EMBEDDING_DIM,
      };
      if (taskType === "RETRIEVAL_DOCUMENT" && title) {
        body.title = title;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(`[VectorSearch] Embed error HTTP ${response.status}`);
        return null;
      }

      const resData = await response.json();
      const rawValues = resData?.embedding?.values;
      if (!rawValues || !Array.isArray(rawValues)) return null;

      const vector = this.normalizeVector(rawValues);

      if (taskType === "RETRIEVAL_QUERY") {
        if (queryVectorCache.size >= MAX_CACHE_SIZE) {
          const firstKey = queryVectorCache.keys().next().value;
          queryVectorCache.delete(firstKey);
        }
        queryVectorCache.set(cacheKey, vector);
      }

      return vector;
    } catch (err) {
      console.warn("[VectorSearch] embedText exception:", err.message);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sinh vector theo lô (Batch API) cho nhiều loài cùng lúc với taskType = RETRIEVAL_DOCUMENT
   * Trả về { vectors, rateLimited } để caller chủ động backoff khi chạm hạn mức free-tier (100 req/phút)
   */
  async embedDocumentBatch(items) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !items.length) return { vectors: [], rateLimited: false };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;
      const requests = items.map((item) => ({
        model: EMBEDDING_MODEL,
        content: { parts: [{ text: item.text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        title: item.title || undefined,
        outputDimensionality: EMBEDDING_DIM,
      }));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ requests }),
      });

      if (response.status === 429) {
        console.warn("[VectorSearch] Batch embed hit HTTP 429 rate limit.");
        return { vectors: [], rateLimited: true };
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.warn(`[VectorSearch] Batch embed error HTTP ${response.status}: ${errBody.slice(0, 200)}`);
        return { vectors: [], rateLimited: false };
      }

      const resData = await response.json();
      const embeddings = resData?.embeddings;
      if (!Array.isArray(embeddings)) return { vectors: [], rateLimited: false };

      return {
        vectors: embeddings.map((e) =>
          Array.isArray(e?.values) ? this.normalizeVector(e.values) : null
        ),
        rateLimited: false,
      };
    } catch (err) {
      console.warn("[VectorSearch] embedDocumentBatch exception:", err.message);
      return { vectors: [], rateLimited: false };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Tạo văn bản giàu ngữ nghĩa đại diện cho 1 loài sinh vật (song ngữ Việt-Anh + thuộc tính sinh thái)
   */
  buildSpeciesSemanticText(sp) {
    const enTrans = sp.species_translations?.[0];
    const redCode = (sp.vietnam_red_list_status || "").toUpperCase();
    const redLabel = RED_LIST_LABELS[redCode] || "";
    const depthText = describeDepthTier(sp.depth_min_m, sp.depth_max_m);
    const factsText = (sp.species_facts || [])
      .map((f) => (f.content || "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ");

    const parts = [
      sp.common_name,
      enTrans?.common_name ? `English name: ${enTrans.common_name}` : "",
      sp.scientificName ? `Tên khoa học: ${sp.scientificName}` : "",
      sp.species_groups?.name ? `Nhóm sinh vật: ${sp.species_groups.name}` : "",
      sp.ocean_zones?.name ? `Tầng đại dương: ${sp.ocean_zones.name}` : "",
      depthText,
      redLabel ? `Tình trạng bảo tồn Sách Đỏ: ${redCode} - ${redLabel}` : "",
      sp.vietnam_protection_group ? `Nhóm bảo vệ: ${sp.vietnam_protection_group}` : "",
      sp.description ? `Đặc điểm: ${sp.description}` : "",
      enTrans?.description ? `Overview: ${enTrans.description.slice(0, 280)}` : "",
      sp.diet ? `Thức ăn & chế độ dinh dưỡng: ${sp.diet}` : "",
      enTrans?.diet ? `Diet: ${enTrans.diet}` : "",
      sp.east_sea_zone ? `Vùng biển phân bố: ${sp.east_sea_zone}` : "",
      sp.local_distribution ? `Địa phương ghi nhận: ${sp.local_distribution}` : "",
      factsText ? `Thông tin nổi bật: ${factsText}` : "",
    ];
    return parts.filter(Boolean).join(". ");
  }

  /**
   * Tính mã băm MD5 kèm phiên bản schema để tự động re-index khi cấu trúc vector nâng cấp
   */
  hashContent(text) {
    return crypto
      .createHash("md5")
      .update(`${SEMANTIC_SCHEMA_VERSION}::${text}`, "utf8")
      .digest("hex");
  }

  /**
   * Tải toàn bộ vector embeddings của các loài đang hiển thị vào bộ nhớ RAM
   */
  async loadIndex() {
    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT 
          e.species_id,
          e.embedding,
          s.common_name,
          s.scientific_name as "scientificName"
        FROM species_embeddings e
        JOIN species s ON s.id = e.species_id
        WHERE s.deleted_at IS NULL AND s.is_visible = true
      `);

      if (!rows || rows.length === 0) {
        console.log("[VectorSearch] No embeddings in DB. Triggering initial sync...");
        await this.syncAllSpeciesEmbeddings();
        return;
      }

      this.speciesIndex = rows.map((r) => ({
        speciesId: r.species_id.toString(),
        commonName: r.common_name,
        scientificName: r.scientificName,
        vector: this.normalizeVector(r.embedding),
      }));

      this.isInitialized = true;
      console.log(
        `[VectorSearch] Loaded ${this.speciesIndex.length} visible species vectors into RAM (0.1ms search ready).`
      );

      const activeCount = await prisma.species.count({
        where: { deleted_at: null, is_visible: true },
      });
      if (this.speciesIndex.length < activeCount) {
        console.log(
          `[VectorSearch] Found ${activeCount - this.speciesIndex.length} unindexed species. Syncing in background...`
        );
        this.syncAllSpeciesEmbeddings().catch((e) =>
          console.warn("[VectorSearch] Background sync warning:", e.message)
        );
      }
    } catch (err) {
      console.warn("[VectorSearch] loadIndex failed:", err.message);
    }
  }

  /**
   * Đồng bộ vector cho một loài (hoạt động nền, tự gỡ khỏi RAM nếu loài bị ẩn/xóa)
   */
  async syncSingleSpeciesEmbedding(speciesId) {
    if (!speciesId) return;
    try {
      const sp = await prisma.species.findUnique({
        where: { id: BigInt(speciesId) },
        include: SPECIES_EMBED_INCLUDE,
      });

      const spIdStr = speciesId.toString();

      if (!sp || sp.deleted_at) {
        await this.removeSpeciesEmbedding(speciesId);
        return;
      }

      // Nếu loài đang ẩn, gỡ khỏi RAM index nhưng vẫn giữ/cập nhật DB nếu cần
      if (!sp.is_visible) {
        this.speciesIndex = this.speciesIndex.filter((i) => i.speciesId !== spIdStr);
      }

      const text = this.buildSpeciesSemanticText(sp);
      const hash = this.hashContent(text);

      const existing = await prisma.$queryRawUnsafe(
        `SELECT content_hash, embedding FROM species_embeddings WHERE species_id = $1`,
        sp.id
      );

      let vector = null;
      if (existing?.[0]?.content_hash === hash && Array.isArray(existing?.[0]?.embedding)) {
        vector = this.normalizeVector(existing[0].embedding);
      } else {
        console.log(`[VectorSearch] Auto-embedding updated species: ${sp.common_name} (ID: ${sp.id})`);
        vector = await this.embedText(text, "RETRIEVAL_DOCUMENT", sp.common_name);
        if (!vector) return;

        const vectorArray = Array.from(vector);
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO species_embeddings (species_id, embedding, content_hash, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (species_id) DO UPDATE 
          SET embedding = EXCLUDED.embedding, content_hash = EXCLUDED.content_hash, updated_at = NOW()
          `,
          sp.id,
          vectorArray,
          hash
        );
      }

      if (sp.is_visible && vector) {
        const existingIdx = this.speciesIndex.findIndex((i) => i.speciesId === spIdStr);
        const entry = {
          speciesId: spIdStr,
          commonName: sp.common_name,
          scientificName: sp.scientificName,
          vector,
        };
        if (existingIdx >= 0) {
          this.speciesIndex[existingIdx] = entry;
        } else {
          this.speciesIndex.push(entry);
        }
        console.log(`[VectorSearch] Species "${sp.common_name}" vector ready in RAM.`);
      }
    } catch (err) {
      console.warn(`[VectorSearch] syncSingleSpeciesEmbedding(${speciesId}) error:`, err.message);
    }
  }

  /**
   * Xóa vector của loài khi loài bị xóa khỏi hệ thống
   */
  async removeSpeciesEmbedding(speciesId) {
    if (!speciesId) return;
    try {
      const spIdStr = speciesId.toString();
      await prisma.$executeRawUnsafe(
        `DELETE FROM species_embeddings WHERE species_id = $1`,
        BigInt(speciesId)
      );
      this.speciesIndex = this.speciesIndex.filter((i) => i.speciesId !== spIdStr);
      console.log(`[VectorSearch] Removed vector for species ID: ${speciesId}`);
    } catch (err) {
      console.warn(`[VectorSearch] removeSpeciesEmbedding(${speciesId}) error:`, err.message);
    }
  }

  /**
   * Quét toàn bộ loài trong database và batch-sync vector cho các loài mới hoặc thay đổi schema/nội dung
   */
  async syncAllSpeciesEmbeddings() {
    if (this.isSyncing) return { synced: 0, skipped: 0 };
    this.isSyncing = true;
    console.log("[VectorSearch] Starting batch species embeddings synchronization...");

    let syncedCount = 0;
    let skippedCount = 0;

    try {
      const allSpecies = await prisma.species.findMany({
        where: { deleted_at: null },
        include: SPECIES_EMBED_INCLUDE,
      });

      const existingEmbeddings = await prisma.$queryRawUnsafe(`
        SELECT species_id, content_hash FROM species_embeddings
      `);
      const existingMap = new Map(
        existingEmbeddings.map((e) => [e.species_id.toString(), e.content_hash])
      );

      const toSync = [];
      for (const sp of allSpecies) {
        const text = this.buildSpeciesSemanticText(sp);
        const hash = this.hashContent(text);
        if (existingMap.get(sp.id.toString()) === hash) {
          skippedCount++;
          continue;
        }
        toSync.push({ sp, text, hash, title: sp.common_name });
      }

      if (toSync.length > 0) {
        const BATCH_SIZE = 45;
        let i = 0;
        let retries = 0;

        while (i < toSync.length) {
          const chunk = toSync.slice(i, i + BATCH_SIZE);
          const { vectors, rateLimited } = await this.embedDocumentBatch(chunk);

          if (rateLimited) {
            if (retries >= 4) {
              console.warn("[VectorSearch] Stopping sync early after repeated rate limits.");
              break;
            }
            retries++;
            console.log(`[VectorSearch] Rate limit hit. Waiting 62s before retry #${retries}...`);
            await new Promise((r) => setTimeout(r, 62000));
            continue;
          }

          retries = 0;
          let resolvedVectors = vectors;

          // Fallback từng phần tử nếu batch lỗi khác (không phải 429)
          if (resolvedVectors.length !== chunk.length) {
            resolvedVectors = [];
            for (const item of chunk) {
              const v = await this.embedText(item.text, "RETRIEVAL_DOCUMENT", item.title);
              resolvedVectors.push(v);
              await new Promise((r) => setTimeout(r, 120));
            }
          }

          for (let j = 0; j < chunk.length; j++) {
            const vec = resolvedVectors[j];
            if (!vec) continue;
            const { sp, hash } = chunk[j];
            await prisma.$executeRawUnsafe(
              `
              INSERT INTO species_embeddings (species_id, embedding, content_hash, updated_at)
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (species_id) DO UPDATE 
              SET embedding = EXCLUDED.embedding, content_hash = EXCLUDED.content_hash, updated_at = NOW()
              `,
              sp.id,
              Array.from(vec),
              hash
            );
            syncedCount++;
          }

          i += BATCH_SIZE;
          console.log(
            `[VectorSearch] Batch progress: ${Math.min(i, toSync.length)}/${toSync.length} embedded.`
          );
          if (i < toSync.length) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      console.log(
        `[VectorSearch] Sync completed! Updated ${syncedCount}, skipped ${skippedCount}.`
      );
      queryVectorCache.clear();
      await this.loadIndex();
      return { synced: syncedCount, skipped: skippedCount };
    } catch (err) {
      console.error("[VectorSearch] syncAllSpeciesEmbeddings error:", err.message);
      return { synced: syncedCount, skipped: skippedCount, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Tìm kiếm sinh vật theo độ tương đồng vector (sử dụng taskType = RETRIEVAL_QUERY)
   * @param {string} rawQuery Câu tìm kiếm tự do của người dùng
   * @param {number} threshold Ngưỡng tương đồng tối thiểu
   * @param {number} limit Số lượng kết quả tối đa
   */
  async search(rawQuery, threshold = 0.52, limit = 30) {
    if (!rawQuery || !rawQuery.trim()) return [];

    if (!this.isInitialized) {
      await this.loadIndex();
    }

    if (this.speciesIndex.length === 0) return [];

    const t0 = Date.now();
    const queryVector = await this.embedText(rawQuery, "RETRIEVAL_QUERY");
    if (!queryVector) return [];

    const tEmbed = Date.now();

    const matches = [];
    for (const item of this.speciesIndex) {
      const score = this.cosineSimilarity(queryVector, item.vector);
      if (score >= threshold) {
        matches.push({
          speciesId: item.speciesId,
          commonName: item.commonName,
          scientificName: item.scientificName,
          score: Math.round(score * 1000) / 1000,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, limit);

    const tDone = Date.now();
    console.log(
      `[VectorSearch] Query: "${rawQuery}" -> ${topMatches.length} matches (Embed: ${tEmbed - t0}ms, Vector Math: ${tDone - tEmbed}ms, Total: ${tDone - t0}ms)`
    );

    return topMatches;
  }
}

export default new VectorSearchService();
