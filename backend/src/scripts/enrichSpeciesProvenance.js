/**
 * enrichSpeciesProvenance.js
 * Script Kỹ sư Dữ liệu (Data Engineer):
 * 1. Đối chiếu toàn bộ sinh vật trong PostgreSQL với WoRMS, OBIS và GBIF để gắn `source_api_id` chính thống.
 * 2. Bổ sung khoảng nhiệt độ nước biển thực nghiệm (sst) từ UNESCO OBIS `/v3/statistics/env`.
 * 3. Chuẩn hóa các bản ghi có số đo giả lập (50-200cm ở Cá Mập Trắng, size_min=0 ở Cá Voi Lưng Gù, ảnh Unsplash chung chung).
 * 4. Đồng bộ lại api_providers trong system_settings loại bỏ endpoint HTML/lỗi thời.
 */

import prisma from "../lib/prisma.js";
import apiProviderService from "../services/apiProviderService.js";

const REQUEST_TIMEOUT_MS = 9000;

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PacificOceanApp/1.0 (DataEngineering)" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveProvenanceAndEnv(sciName) {
  let sourceApiId = null;
  let aphiaID = null;
  let tempMin = null;
  let tempMax = null;

  // 1. Tra cứu WoRMS AphiaID chuẩn
  const wormsData = await fetchJsonSafe(
    `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(sciName)}?like=false`
  );
  if (Array.isArray(wormsData) && wormsData.length > 0) {
    const rec =
      wormsData.find((r) => r.status === "accepted" && r.isMarine === 1) ||
      wormsData.find((r) => r.status === "accepted") ||
      wormsData[0];
    aphiaID = rec.valid_AphiaID || rec.AphiaID || null;
    if (aphiaID) sourceApiId = `worms:${aphiaID}`;
  }

  // 2. Fallback GBIF Match nếu WoRMS không khớp chính xác
  if (!sourceApiId) {
    const gbifData = await fetchJsonSafe(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sciName)}`
    );
    if (gbifData && gbifData.matchType !== "NONE" && gbifData.usageKey) {
      sourceApiId = `gbif:${gbifData.usageKey}`;
    }
  }

  // 3. Nếu có AphiaID -> Tra cứu OBIS Environmental Stats lấy khoảng nhiệt độ SST thực tế
  if (aphiaID) {
    const env = await fetchJsonSafe(`https://api.obis.org/v3/statistics/env?taxonid=${aphiaID}`);
    if (env && Array.isArray(env.sst) && env.sst.length > 0) {
      const validSst = env.sst.filter((b) => typeof b.sst === "number" && (b.records || 0) >= 2);
      const pool = validSst.length > 0 ? validSst : env.sst.filter((b) => typeof b.sst === "number" && (b.records || 0) > 0);
      if (pool.length > 0) {
        const vals = pool.map((b) => b.sst);
        tempMin = Math.min(...vals);
        tempMax = Math.max(...vals);
      }
    }
  }

  return { sourceApiId, aphiaID, tempMin, tempMax };
}

async function runEnrichment() {
  console.log("=== BẮT ĐẦU CHUẨN HÓA DỮ LIỆU KHOA HỌC (DATA ENGINEERING) ===");

  // 0. Chuẩn hóa danh sách API Providers trong system_settings
  await apiProviderService.getRawProviders();
  console.log("Đã chuẩn hóa external_api_providers trong system_settings.");

  // 1. Sửa các bản ghi đặc biệt đã phát hiện sai lệch trong Audit
  // 1a. Cá Mập Trắng Lớn (id=1): thay số đo giả 50-200cm bằng số liệu khoa học chuẩn
  const shark = await prisma.species.findUnique({ where: { id: 1n } });
  if (shark && Number(shark.size_min_cm) === 50 && Number(shark.size_max_cm) === 200) {
    await prisma.species.update({
      where: { id: 1n },
      data: {
        size_min_cm: 340,
        size_max_cm: 640,
        weight_min_kg: 520,
        weight_max_kg: 2268,
        lifespan_years: 70,
        updated_at: new Date(),
      },
    });
    console.log("Đã chuẩn hóa thông số sinh học chuẩn cho Cá Mập Trắng Lớn (id=1).");
  }

  // 1b. Bạch Tuộc Khổng Lồ Bắc Thái Bình Dương (id=2): bổ sung cân nặng, tuổi thọ và vùng phân bố chuẩn
  const octopus = await prisma.species.findUnique({ where: { id: 2n } });
  if (octopus && octopus.weight_min_kg === null) {
    await prisma.species.update({
      where: { id: 2n },
      data: {
        weight_min_kg: 15,
        weight_max_kg: 50,
        lifespan_years: 4,
        east_sea_zone: "Thái Bình Dương Bắc (Nhật Bản - Alaska - Bắc Mỹ)",
        local_distribution: "Vùng biển lạnh & ôn đới Bắc Thái Bình Dương",
        updated_at: new Date(),
      },
    });
    console.log("Đã chuẩn hóa thông số & phân bố cho Enteroctopus dofleini (id=2).");
  }

  // 1c. Cá Voi Lưng Gù (id=5): sửa size_min_cm=0 và xóa 2 ảnh Unsplash sóng biển chung chung
  const whale = await prisma.species.findUnique({
    where: { id: 5n },
    include: { species_media: true },
  });
  if (whale) {
    if (Number(whale.size_min_cm) === 0) {
      await prisma.species.update({
        where: { id: 5n },
        data: { size_min_cm: 1200, size_max_cm: 1600, updated_at: new Date() },
      });
      console.log("Đã sửa size_min_cm=0 -> 1200-1600cm cho Cá Voi Lưng Gù (id=5).");
    }
    const genericUnsplashIds = whale.species_media
      .filter((m) => m.url.includes("images.unsplash.com/photo-1518837695005"))
      .map((m) => m.id);
    if (genericUnsplashIds.length > 0 && whale.species_media.length > genericUnsplashIds.length) {
      await prisma.species_media.deleteMany({
        where: { id: { in: genericUnsplashIds } },
      });
      console.log(`Đã gỡ ${genericUnsplashIds.length} ảnh Unsplash chung chung trùng lặp khỏi Cá Voi Lưng Gù (id=5).`);
    }
  }

  // 2. Xử lý hàng loạt toàn bộ sinh vật còn thiếu source_api_id hoặc thiếu nhiệt độ
  const allSpecies = await prisma.species.findMany({
    where: { deleted_at: null },
    orderBy: { id: "asc" },
  });

  const targets = allSpecies.filter(
    (s) => !s.source_api_id || s.temperature_min_c === null || s.temperature_max_c === null
  );
  console.log(`Tổng số loài cần đối chiếu WoRMS/OBIS/GBIF: ${targets.length}/${allSpecies.length}`);

  let updatedProvenance = 0;
  let updatedTemp = 0;
  const unmatched = [];

  const BATCH_SIZE = 6;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sp) => {
        const res = await resolveProvenanceAndEnv(sp.scientificName);
        const updateData = {};

        if (!sp.source_api_id && res.sourceApiId) {
          updateData.source_api_id = res.sourceApiId;
          updatedProvenance++;
        } else if (!sp.source_api_id && !res.sourceApiId) {
          unmatched.push({ id: sp.id.toString(), name: sp.common_name, sci: sp.scientificName });
        }

        if (sp.temperature_min_c === null && res.tempMin !== null) {
          updateData.temperature_min_c = res.tempMin;
          updateData.temperature_max_c = res.tempMax;
          updatedTemp++;
        }

        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date();
          await prisma.species.update({
            where: { id: sp.id },
            data: updateData,
          });
        }
      })
    );

    const processed = Math.min(i + BATCH_SIZE, targets.length);
    if (processed % 30 === 0 || processed === targets.length) {
      console.log(`Tiến độ: ${processed}/${targets.length} (Provenance: +${updatedProvenance}, Nhiệt độ OBIS: +${updatedTemp})`);
    }
  }

  console.log("\n=== KẾT QUẢ CHUẨN HÓA DỮ LIỆU ===");
  console.log(`- Đã gắn source_api_id chuẩn WoRMS/GBIF: +${updatedProvenance}`);
  console.log(`- Đã bổ sung khoảng nhiệt độ SST thực tế từ OBIS: +${updatedTemp}`);
  console.log(`- Số loài chưa khớp tự động (cần rà soát tên khoa học): ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(JSON.stringify(unmatched, null, 2));
  }
}

runEnrichment()
  .catch((err) => {
    console.error("Lỗi khi chạy script chuẩn hóa:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

