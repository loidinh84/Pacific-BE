/**
 * enrichSpeciesMedia.js
 * Script Kỹ sư Dữ liệu:
 * - Truy vấn iNaturalist `/v1/taxa?q={scientificName}` -> `/v1/taxa/{id}` lấy danh sách ảnh chuẩn loài (`taxon_photos`)
 * - Bổ sung 3-4 ảnh chụp thực tế đúng loài cho toàn bộ sinh vật trong `species_media`
 * - Xử lý riêng các mục sinh cảnh/nhóm rộng như Sinh Vật Phù Du (Copepoda / marine plankton)
 */

import prisma from "../lib/prisma.js";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "PacificOceanApp/1.0 (DataEngineering; media-enrichment)",
};

const TARGET_PHOTOS_PER_SPECIES = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429 && attempt < retries) {
        await sleep(2500);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < retries) await sleep(800);
    }
  }
  return null;
}

async function fetchTaxonPhotosFromINat(taxonId, limit = 5) {
  if (!taxonId) return [];
  const detail = await fetchJsonWithRetry(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
  const taxon = detail?.results?.[0];
  if (!taxon) return [];

  const urls = [];
  const seen = new Set();

  if (Array.isArray(taxon.taxon_photos)) {
    for (const tp of taxon.taxon_photos) {
      const u = tp?.photo?.large_url || tp?.photo?.medium_url;
      if (u && typeof u === "string" && u.startsWith("http") && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
        if (urls.length >= limit) break;
      }
    }
  }

  if (urls.length === 0 && taxon.default_photo) {
    const defUrl = taxon.default_photo.large_url || taxon.default_photo.medium_url;
    if (defUrl && !seen.has(defUrl)) urls.push(defUrl);
  }

  return urls;
}

async function searchINatPhotosByScientificName(sciName, limit = 5) {
  if (!sciName) return [];

  const clean = String(sciName)
    .replace(/\([^)]*\)/g, "")
    .trim();
  if (!clean) return [];

  // Map nhóm sinh vật phù du rộng sang các nhóm đại diện thực tế trên iNaturalist
  if (/planktonic ecosystem/i.test(clean)) {
    const [copepoda, diatoms] = await Promise.all([
      fetchTaxonPhotosFromINat(121643, 3), // Copepoda
      fetchTaxonPhotosFromINat(123880, 2), // Bacillariophyta (Diatoms)
    ]);
    return [...new Set([...copepoda, ...diatoms])].slice(0, limit);
  }

  const searchRes = await fetchJsonWithRetry(
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(clean)}&per_page=3`
  );
  const results = searchRes?.results || [];
  if (results.length === 0) return [];

  const lowerClean = clean.toLowerCase();
  const matched =
    results.find((r) => (r.name || "").toLowerCase() === lowerClean) ||
    results.find((r) => lowerClean.startsWith((r.name || "").toLowerCase())) ||
    results[0];

  if (!matched?.id) return [];
  return fetchTaxonPhotosFromINat(matched.id, limit);
}

async function runMediaEnrichment() {
  console.log("=== BẮT ĐẦU LÀM GIÀU BỘ SƯU TẬP ẢNH SINH VẬT (iNaturalist Taxon Detail) ===");

  const allSpecies = await prisma.species.findMany({
    where: { deleted_at: null },
    orderBy: { id: "asc" },
    include: {
      species_media: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }, { id: "asc" }],
      },
    },
  });

  const targets = allSpecies.filter((sp) => {
    const imageCount = sp.species_media.filter((m) => m.type === "image").length;
    return imageCount < TARGET_PHOTOS_PER_SPECIES;
  });

  console.log(`Tổng số sinh vật cần bổ sung ảnh (< ${TARGET_PHOTOS_PER_SPECIES} ảnh): ${targets.length}/${allSpecies.length}`);

  let updatedSpecies = 0;
  let insertedPhotos = 0;
  const unresolved = [];

  const BATCH_SIZE = 4;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (sp) => {
        const existingImages = sp.species_media.filter((m) => m.type === "image");
        const existingUrlSet = new Set(existingImages.map((m) => m.url));
        const needed = TARGET_PHOTOS_PER_SPECIES - existingImages.length;
        if (needed <= 0) return;

        const candidateUrls = await searchINatPhotosByScientificName(sp.scientificName, TARGET_PHOTOS_PER_SPECIES + 2);
        const freshUrls = candidateUrls.filter((u) => !existingUrlSet.has(u)).slice(0, needed);

        if (freshUrls.length === 0) {
          if (existingImages.length <= 1) {
            unresolved.push({ id: sp.id.toString(), name: sp.common_name, sci: sp.scientificName });
          }
          return;
        }

        const maxSortOrder = sp.species_media.reduce((max, m) => Math.max(max, m.sort_order || 0), 0);
        const hasPrimary = sp.species_media.some((m) => m.is_primary);

        await prisma.species_media.createMany({
          data: freshUrls.map((url, idx) => ({
            species_id: sp.id,
            type: "image",
            url,
            caption: `${sp.common_name} (${sp.scientificName}) - iNaturalist`,
            is_primary: !hasPrimary && idx === 0,
            sort_order: maxSortOrder + idx + 1,
          })),
        });

        updatedSpecies++;
        insertedPhotos += freshUrls.length;
      })
    );

    const processed = Math.min(i + BATCH_SIZE, targets.length);
    if (processed % 24 === 0 || processed === targets.length) {
      console.log(`Tiến độ: ${processed}/${targets.length} (Đã bổ sung cho ${updatedSpecies} loài, +${insertedPhotos} ảnh)`);
    }

    if (i + BATCH_SIZE < targets.length) {
      await sleep(300);
    }
  }

  const mediaStats = await prisma.species_media.count({ where: { type: "image" } });

  console.log("\n=== HOÀN TẤT LÀM GIÀU MEDIA ===");
  console.log(`- Số loài được bổ sung ảnh thực tế: ${updatedSpecies}`);
  console.log(`- Tổng số ảnh mới đã lưu vào PostgreSQL: +${insertedPhotos}`);
  console.log(`- Tổng số ảnh trong bảng species_media hiện tại: ${mediaStats}`);
  console.log(`- Số loài vẫn còn <= 1 ảnh sau truy vấn iNaturalist: ${unresolved.length}`);
  if (unresolved.length > 0 && unresolved.length <= 20) {
    console.log(JSON.stringify(unresolved, null, 2));
  }
}

runMediaEnrichment()
  .catch((err) => {
    console.error("Lỗi enrichSpeciesMedia:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

