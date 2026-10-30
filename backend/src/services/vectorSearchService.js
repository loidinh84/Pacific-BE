import crypto from "crypto";
import prisma from "../lib/prisma.js";

/**
 * vectorSearchService.js
 * Dịch vụ tìm kiếm ngữ nghĩa theo không gian vector
 * Sử dụng Gemini Embedding 768 chiều
 * - Lưu trữ vĩnh viễn trong PostgreSQL table `species_embeddings`
 * Lập chỉ mục trong bộ nhớ để so khớp nhanh
 * - Tự động đồng bộ khi có loài mới hoặc sửa đổi thông tin
 */

// Bộ nhớ đệm cho vector truy vấn
const queryVectorCache = new Map();
const MAX_CACHE_SIZE = 500;

class VectorSearchService {
  constructor() {
    this.speciesIndex = []; // { id, speciesId, commonName, scientificName, vector: Float32Array }
    this.isInitialized = false;
    this.isSyncing = false;
  }

  /**
   * Tính Cosine Similarity giữa 2 vector Float32Array
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = vecA.length;
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
   */
  async embedText(text) {
    if (!text || typeof text !== "string") return null;
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Kiểm tra cache trước
    if (queryVectorCache.has(cleanText)) {
      return queryVectorCache.get(cleanText);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[VectorSearch] GEMINI_API_KEY is not configured.");
      return null;
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: cleanText }] },
          outputDimensionality: 768,
        }),
      });

      if (!response.ok) {
        console.warn(`[VectorSearch] Embed error HTTP ${response.status}`);
        return null;
      }

      const resData = await response.json();
      const rawValues = resData?.embedding?.values;
      if (!rawValues || !Array.isArray(rawValues)) return null;

      const vector = new Float32Array(rawValues);

      // Lưu vào cache
      if (queryVectorCache.size >= MAX_CACHE_SIZE) {
        const firstKey = queryVectorCache.keys().next().value;
        queryVectorCache.delete(firstKey);
      }
      queryVectorCache.set(cleanText, vector);

      return vector;
    } catch (err) {
      console.warn("[VectorSearch] embedText exception:", err.message);
      return null;
    }
  }

  /**
   * Tạo văn bản giàu ngữ nghĩa đại diện cho 1 loài sinh vật
   */
  buildSpeciesSemanticText(sp) {
    const parts = [
      sp.common_name,
      sp.scientificName ? `(${sp.scientificName})` : "",
      sp.species_groups?.name ? `Nhóm: ${sp.species_groups.name}` : "",
      sp.description || "",
      sp.diet ? `Thức ăn & chế độ dinh dưỡng: ${sp.diet}` : "",
      sp.east_sea_zone ? `Vùng biển phân bố: ${sp.east_sea_zone}` : "",
      sp.local_distribution ? `Địa phương: ${sp.local_distribution}` : "",
    ];
    return parts.filter(Boolean).join(". ");
  }

  /**
   * Tính mã băm MD5 để nhận biết khi nội dung loài bị thay đổi
   */
  hashContent(text) {
    return crypto.createHash("md5").update(text, "utf8").digest("hex");
  }

  /**
   * Tải toàn bộ vector embeddings từ PostgreSQL vào bộ nhớ RAM
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
        WHERE s.deleted_at IS NULL
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
        vector: new Float32Array(r.embedding),
      }));

      this.isInitialized = true;
      console.log(`[VectorSearch] Loaded ${this.speciesIndex.length} species vectors into RAM (0.1ms search ready).`);

      // Kiểm tra nếu số lượng vector ít hơn số loài đang hoạt động thì tự động bù trong nền
      const activeCount = await prisma.species.count({ where: { deleted_at: null } });
      if (this.speciesIndex.length < activeCount) {
        console.log(`[VectorSearch] Found ${activeCount - this.speciesIndex.length} unindexed species. Syncing in background...`);
        this.syncAllSpeciesEmbeddings().catch((e) =>
          console.warn("[VectorSearch] Background sync warning:", e.message)
        );
      }
    } catch (err) {
      console.warn("[VectorSearch] loadIndex failed:", err.message);
    }
  }

  /**
   * Đồng bộ vector cho một loài
   * Hoạt động phi tập trung, không khóa tiến trình chính.
   */
  async syncSingleSpeciesEmbedding(speciesId) {
    if (!speciesId) return;
    try {
      const sp = await prisma.species.findUnique({
        where: { id: BigInt(speciesId) },
        include: {
          species_groups: { select: { name: true } },
        },
      });

      // Nếu loài bị xóa hoặc không tồn tại, gỡ bỏ khỏi cơ sở dữ liệu và RAM
      if (!sp || sp.deleted_at) {
        await this.removeSpeciesEmbedding(speciesId);
        return;
      }

      const text = this.buildSpeciesSemanticText(sp);
      const hash = this.hashContent(text);

      // Kiểm tra xem hash có thay đổi không
      const existing = await prisma.$queryRawUnsafe(
        `SELECT content_hash FROM species_embeddings WHERE species_id = $1`,
        sp.id
      );
      if (existing?.[0]?.content_hash === hash) {
        return; // Nội dung không đổi, không cần gọi API
      }

      console.log(`[VectorSearch] Auto-embedding updated species: ${sp.common_name} (ID: ${sp.id})`);
      const vector = await this.embedText(text);
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

      // Cập nhật ngay lập tức vào chỉ mục RAM
      const spIdStr = sp.id.toString();
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
      console.log(`[VectorSearch] Species "${sp.common_name}" vector successfully indexed.`);
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
   * Quét toàn bộ loài trong database, tính toán và lưu vector cho các loài mới/sửa đổi
   */
  async syncAllSpeciesEmbeddings() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    console.log("[VectorSearch] Starting species embeddings synchronization...");

    try {
      const allSpecies = await prisma.species.findMany({
        where: { deleted_at: null },
        include: {
          species_groups: { select: { name: true } },
        },
      });

      // Lấy danh sách hash hiện tại trong DB
      const existingEmbeddings = await prisma.$queryRawUnsafe(`
        SELECT species_id, content_hash FROM species_embeddings
      `);
      const existingMap = new Map(
        existingEmbeddings.map((e) => [e.species_id.toString(), e.content_hash])
      );

      let syncedCount = 0;

      for (const sp of allSpecies) {
        const text = this.buildSpeciesSemanticText(sp);
        const hash = this.hashContent(text);
        const currentHash = existingMap.get(sp.id.toString());

        // Nếu nội dung không đổi, bỏ qua không cần tốn API
        if (currentHash === hash) continue;

        console.log(`[VectorSearch] Embedding species: ${sp.common_name}...`);
        const vector = await this.embedText(text);
        if (!vector) continue;

        // Lưu vector vào cơ sở dữ liệu
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

        syncedCount++;
        // Giãn cách nhẹ 150ms để không vượt rate limit
        await new Promise((r) => setTimeout(r, 150));
      }

      console.log(`[VectorSearch] Sync completed! Updated ${syncedCount} species.`);
      // Nạp lại index vào RAM
      await this.loadIndex();
    } catch (err) {
      console.error("[VectorSearch] syncAllSpeciesEmbeddings error:", err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Tìm kiếm sinh vật theo độ tương đồng vector
   * @param {string} rawQuery Câu tìm kiếm tự do của người dùng
   * @param {number} threshold Ngưỡng tương đồng tối thiểu
   * @param {number} limit Số lượng kết quả tối đa
   * @returns {Promise<Array<{ speciesId: string, score: number }>>}
   */
  async search(rawQuery, threshold = 0.52, limit = 8) {
    if (!rawQuery || !rawQuery.trim()) return [];

    if (!this.isInitialized) {
      await this.loadIndex();
    }

    if (this.speciesIndex.length === 0) return [];

    const t0 = Date.now();
    const queryVector = await this.embedText(rawQuery);
    if (!queryVector) return [];

    const tEmbed = Date.now();

    // So khớp vector trong bộ nhớ
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

    // Sắp xếp điểm tương đồng giảm dần
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
