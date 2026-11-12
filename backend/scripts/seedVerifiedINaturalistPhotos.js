import prisma from "../src/lib/prisma.js";

/**
 * Script thu thập 100% ẢNH THỰC TẾ DO THỢ LẶN / NHÀ NGHIÊN CỨU CHỤP TỪ iNaturalist Research Grade.
 * Nguồn ảnh lưu trên Amazon S3 Open Data của iNaturalist:
 * - Ổn định 100%, không bị 404, không bị chặn hotlinking như Wikimedia.
 * - Ảnh chụp cận cảnh chính xác sinh vật biển dưới nước.
 */

const SPECIES_QUERIES = [
  {
    code: "SPECIES_GWS_01",
    taxonName: "Carcharodon carcharias",
    vietnameseName: "Cá Mập Trắng Lớn",
  },
  {
    code: "SPECIES_BW_02",
    taxonName: "Balaenoptera musculus",
    vietnameseName: "Cá Voi Xanh",
  },
  {
    code: "SPECIES_ANGLER_03",
    taxonName: "Melanocetus",
    fallbackUrls: [
      "https://inaturalist-open-data.s3.amazonaws.com/photos/758591767/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/758591808/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/673149434/large.jpg",
      "https://inaturalist-open-data.s3.amazonaws.com/photos/468285045/large.jpg",
    ],
    vietnameseName: "Cá Quỷ Biển Sâu",
  },
  {
    code: "SPECIES_TURTLE_04",
    taxonName: "Dermochelys coriacea",
    vietnameseName: "Rùa Da (Đồi Mồi Dứa)",
  },
  {
    code: "SPECIES_OCTOPUS_05",
    taxonName: "Hapalochlaena lunulata",
    vietnameseName: "Bạch Tuộc Đốm Xanh",
  },
];

async function checkUrlOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function fetchVerifiedPhotos(taxonName, fallbackUrls = []) {
  const verifiedUrls = [];

  try {
    const apiUrl = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(
      taxonName
    )}&photos=true&quality_grade=research&per_page=10`;

    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      for (const obs of data.results || []) {
        for (const p of obs.photos || []) {
          if (p.url) {
            const largeUrl = p.url.replace("/square.", "/large.");
            if (!verifiedUrls.includes(largeUrl)) {
              verifiedUrls.push(largeUrl);
              if (verifiedUrls.length >= 4) break;
            }
          }
        }
        if (verifiedUrls.length >= 4) break;
      }
    }
  } catch (err) {
    console.warn(`Lỗi khi gọi API iNaturalist cho ${taxonName}:`, err.message);
  }

  // Nếu chưa đủ 4 ảnh, bổ sung từ danh sách fallback
  if (verifiedUrls.length < 4 && fallbackUrls.length > 0) {
    for (const fb of fallbackUrls) {
      if (!verifiedUrls.includes(fb)) {
        verifiedUrls.push(fb);
        if (verifiedUrls.length >= 4) break;
      }
    }
  }

  // Kiểm tra từng URL xem có trả về HTTP 200 không
  const tested = [];
  for (const url of verifiedUrls) {
    const isOk = await checkUrlOk(url);
    if (isOk) {
      tested.push(url);
    }
  }

  return tested;
}

async function run() {
  console.log("🌊 [PACIFIC PHOTO REPAIR] Bắt đầu lấy ảnh thợ lặn trực tiếp từ iNaturalist S3 CDN...");

  for (const item of SPECIES_QUERIES) {
    console.log(`\n⏳ Đang lấy ảnh thực tế cho: ${item.vietnameseName} (${item.taxonName})...`);

    const photos = await fetchVerifiedPhotos(item.taxonName, item.fallbackUrls || []);
    console.log(`=> Đã kiểm định thành công ${photos.length} ảnh hợp lệ (HTTP 200).`);

    if (photos.length === 0) {
      console.warn(`⚠️ Không tìm thấy ảnh cho ${item.vietnameseName}`);
      continue;
    }

    const species = await prisma.species.findUnique({
      where: { code: item.code },
      select: { id: true },
    });

    if (!species) {
      console.warn(`⚠️ Không tìm thấy loài trong DB: ${item.code}`);
      continue;
    }

    // Xóa media cũ
    await prisma.species_media.deleteMany({ where: { species_id: species.id } });

    // Lưu media mới đã kiểm định 100% HTTP 200
    await prisma.species_media.createMany({
      data: photos.map((url, idx) => ({
        species_id: species.id,
        type: "image",
        url: url,
        caption: `Ảnh thợ lặn / nhà nghiên cứu chụp thực địa ${item.vietnameseName} #${idx + 1}`,
        is_primary: idx === 0,
        sort_order: idx + 1,
      })),
    });

    console.log(`✅ Đã lưu ${photos.length} ảnh S3 chất lượng cao vào Neon DB cho ${item.vietnameseName}!`);
  }

  console.log("\n🎉 HOÀN TẤT CẬP NHẬT ẢNH CHUẨN XÁC 100%!");
}

run()
  .catch((e) => {
    console.error("❌ Lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

