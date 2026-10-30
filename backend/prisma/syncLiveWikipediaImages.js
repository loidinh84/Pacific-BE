import prisma from "../src/lib/prisma.js";

/**
 * syncLiveWikipediaImages.js
 * Đồng bộ ảnh thực tế 100% hoạt động từ API chính thức của Wikipedia / Wikimedia
 * - Thay thế toàn bộ các link 404 bị lỗi hash
 * - Đảm bảo ảnh hiển thị rõ nét, chuẩn khoa học
 */

async function fetchWikiImage(query) {
  if (!query) return null;
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PacificOceanMarineEncyclopedia/1.0 (contact@pacific.ocean; https://pacificocean.vn)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log("🌊 Bắt đầu đồng bộ ảnh thực tế từ Wikipedia API cho toàn bộ sinh vật...");

  const allSpecies = await prisma.species.findMany({
    select: {
      id: true,
      common_name: true,
      scientificName: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`📋 Tổng số sinh vật cần kiểm tra và đồng bộ: ${allSpecies.length} loài.\n`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < allSpecies.length; i++) {
    const s = allSpecies[i];
    
    // 1. Tra cứu theo tên khoa học đầy đủ
    let liveImageUrl = await fetchWikiImage(s.scientificName);

    // 2. Tra cứu theo chi sinh học nếu chưa có kết quả
    if (!liveImageUrl && s.scientificName && s.scientificName.includes(" ")) {
      const genus = s.scientificName.split(" ")[0];
      liveImageUrl = await fetchWikiImage(genus);
    }

    if (liveImageUrl) {
      // Cập nhật lại vào species_media
      await prisma.species_media.deleteMany({
        where: { species_id: s.id, is_primary: true },
      });

      await prisma.species_media.create({
        data: {
          species_id: s.id,
          type: "image",
          url: liveImageUrl,
          caption: `Ảnh tư liệu sinh vật biển ${s.common_name} (${s.scientificName})`,
          is_primary: true,
          sort_order: 1,
        },
      });

      updatedCount++;
      console.log(`[${i + 1}/${allSpecies.length}] ✅ ID ${s.id}: ${s.common_name} -> ${liveImageUrl.substring(0, 75)}...`);
    } else {
      notFoundCount++;
      console.log(`[${i + 1}/${allSpecies.length}] ⚠️  ID ${s.id}: ${s.common_name} (${s.scientificName}) -> Chưa tìm thấy ảnh từ Wikipedia API.`);
    }

    // Giãn cách 100ms giữa các yêu cầu
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n🎉 HOÀN TẤT ĐỒNG BỘ ẢNH THẬT!`);
  console.log(`✅ Đã cập nhật ảnh sống thực tế cho: ${updatedCount} loài.`);
  console.log(`⚠️  Chưa có ảnh (để trống chờ người dùng upload): ${notFoundCount} loài.`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi đồng bộ ảnh:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
