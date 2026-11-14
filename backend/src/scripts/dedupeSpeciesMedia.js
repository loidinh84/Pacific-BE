/**
 * dedupeSpeciesMedia.js
 * Script Kỹ sư Dữ liệu:
 * 1. Khử trùng lặp URL ảnh chéo giữa các loài (VD: Cá Voi Eden vs Cá Voi Bryde, Rắn Biển Cổ Ngỗng vs Rắn Biển Đầu Nhỏ).
 * 2. Thay thế ảnh trùng góc chụp green-screen ở Cá Chim Trắng (Pampus argenteus) bằng các quan sát thực tế khác nhau trên iNaturalist.
 * 3. Bổ sung thêm ảnh từ research observations cho 6 loài còn <= 1 ảnh nếu tìm thấy.
 */

import prisma from "../lib/prisma.js";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "PacificOceanApp/1.0 (DataEngineering; media-dedupe)",
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchObservationPhotos(query, excludeSet, limit = 4) {
  const taxonRes = await fetchJson(
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=3`
  );
  const taxonId = taxonRes?.results?.[0]?.id;
  if (!taxonId) return [];

  const urls = [];
  // Thử lấy từ taxon_photos trước (lấy những ảnh chưa có trong excludeSet)
  const detail = await fetchJson(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
  const taxonPhotos = detail?.results?.[0]?.taxon_photos || [];
  for (const tp of taxonPhotos) {
    const u = tp?.photo?.large_url || tp?.photo?.medium_url;
    if (u && !excludeSet.has(u) && !urls.includes(u)) {
      urls.push(u);
      if (urls.length >= limit) return urls;
    }
  }

  // Bổ sung từ research-grade observations (ảnh thực địa từ các nhà quan sát khác nhau)
  const obsRes = await fetchJson(
    `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&quality_grade=research&photos=true&per_page=15`
  );
  for (const obs of obsRes?.results || []) {
    for (const ph of obs.photos || []) {
      const large = ph?.url ? ph.url.replace(/\/square\./i, "/large.").replace(/\/medium\./i, "/large.") : null;
      if (large && large.startsWith("http") && !excludeSet.has(large) && !urls.includes(large)) {
        urls.push(large);
        if (urls.length >= limit) return urls;
      }
    }
  }
  return urls;
}

async function runDedupe() {
  console.log("=== KHỬ TRÙNG LẶP & CHUẨN HÓA MEDIA ĐA LOÀI ===");

  const allImages = await prisma.species_media.findMany({
    where: { type: "image" },
    select: { url: true },
  });
  const globalUsed = new Set(allImages.map((m) => m.url));

  // 1. Sửa Cá Chim Trắng (Pampus argenteus, id=52): loại bỏ ảnh iNaturalist trùng góc chụp nền xanh Wikimedia 20560081 / 20560083
  const pampus = await prisma.species.findFirst({
    where: { scientificName: { contains: "Pampus argenteus", mode: "insensitive" }, deleted_at: null },
    include: { species_media: { orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }] } },
  });
  if (pampus) {
    const dupGreenUrls = [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/20560081/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/20560083/large.jpg",
    ];
    const toRemove = pampus.species_media.filter((m) => dupGreenUrls.includes(m.url));
    if (toRemove.length > 0) {
      await prisma.species_media.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } });
      const distinctPampus = [
        "https://inaturalist-open-data.s3.amazonaws.com/photos/20560086/large.jpeg",
        "https://inaturalist-open-data.s3.amazonaws.com/photos/22207160/large.jpeg",
        "https://inaturalist-open-data.s3.amazonaws.com/photos/97561085/large.jpg",
      ].filter((u) => !pampus.species_media.some((m) => m.url === u));

      for (let idx = 0; idx < distinctPampus.slice(0, toRemove.length).length; idx++) {
        await prisma.species_media.create({
          data: {
            species_id: pampus.id,
            type: "image",
            url: distinctPampus[idx],
            caption: `${pampus.common_name} (${pampus.scientificName}) - iNaturalist`,
            is_primary: false,
            sort_order: 10 + idx,
          },
        });
        globalUsed.add(distinctPampus[idx]);
      }
      console.log(`Đã thay ${toRemove.length} ảnh nền xanh trùng ở Cá Chim Trắng (id=${pampus.id}).`);
    }
  }

  // 2. Xử lý toàn bộ URL bị dùng chung giữa nhiều loài (giữ loài đầu tiên, thay mới cho loài sau)
  const groupedMedia = await prisma.species_media.findMany({
    where: { type: "image" },
    include: { species: { select: { id: true, common_name: true, scientificName: true } } },
    orderBy: [{ species_id: "asc" }, { sort_order: "asc" }],
  });

  const urlOwners = new Map();
  for (const m of groupedMedia) {
    if (!urlOwners.has(m.url)) urlOwners.set(m.url, []);
    urlOwners.get(m.url).push(m);
  }

  const speciesToRefresh = new Map(); // speciesId -> { sp, dupMediaIds }
  for (const [, rows] of urlOwners.entries()) {
    if (rows.length <= 1) continue;
    // Giữ dòng đầu tiên (species_id nhỏ nhất), đánh dấu các bản trùng của loài sau để thay thế
    for (const dupRow of rows.slice(1)) {
      const sid = dupRow.species_id.toString();
      if (!speciesToRefresh.has(sid)) {
        speciesToRefresh.set(sid, { species: dupRow.species, mediaRows: [] });
      }
      speciesToRefresh.get(sid).mediaRows.push(dupRow);
    }
  }

  for (const [sid, info] of speciesToRefresh.entries()) {
    const query = info.species.scientificName;
    const altUrls = await fetchObservationPhotos(query, globalUsed, info.mediaRows.length);
    console.log(`Loài trùng ảnh chéo id=${sid} (${info.species.common_name}): tìm được ${altUrls.length}/${info.mediaRows.length} ảnh thay thế.`);

    for (let i = 0; i < info.mediaRows.length; i++) {
      const row = info.mediaRows[i];
      if (altUrls[i]) {
        await prisma.species_media.update({
          where: { id: row.id },
          data: { url: altUrls[i], caption: `${info.species.common_name} - iNaturalist observation` },
        });
        globalUsed.add(altUrls[i]);
      } else {
        // Nếu hết ảnh thay thế riêng, xóa bản ghi trùng thay vì giữ ảnh trùng lặp giữa 2 loài
        await prisma.species_media.delete({ where: { id: row.id } });
      }
    }
  }

  // 3. Thử lấy ảnh observation cho các loài hiện <= 1 ảnh
  const lowMediaSpecies = await prisma.species.findMany({
    where: { deleted_at: null },
    include: { species_media: { where: { type: "image" } } },
  });
  for (const sp of lowMediaSpecies.filter((s) => s.species_media.length <= 1)) {
    const needed = Math.max(0, 4 - sp.species_media.length);
    const fresh = await fetchObservationPhotos(sp.scientificName, globalUsed, needed);
    if (fresh.length > 0) {
      await prisma.species_media.createMany({
        data: fresh.map((url, idx) => ({
          species_id: sp.id,
          type: "image",
          url,
          caption: `${sp.common_name} - iNaturalist`,
          is_primary: sp.species_media.length === 0 && idx === 0,
          sort_order: 20 + idx,
        })),
      });
      fresh.forEach((u) => globalUsed.add(u));
      console.log(`Bổ sung thêm ${fresh.length} ảnh observation cho ${sp.common_name} (${sp.scientificName}).`);
    }
  }

  // Tổng kết kiểm tra trùng lặp chéo
  const finalMedia = await prisma.species_media.findMany({ where: { type: "image" }, select: { url: true } });
  const finalCounts = new Map();
  finalMedia.forEach((m) => finalCounts.set(m.url, (finalCounts.get(m.url) || 0) + 1));
  const remainingCrossDupes = [...finalCounts.values()].filter((c) => c > 1).length;
  console.log("=== KẾT QUẢ KHỬ TRÙNG LẶP ===", {
    totalMedia: finalMedia.length,
    remainingCrossDupes,
  });
}

runDedupe()
  .catch((err) => {
    console.error("Lỗi dedupeSpeciesMedia:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

