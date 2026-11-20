import prisma from "../src/lib/prisma.js";

const FIXES = [
  // 1. Mực Mắt Chọi Lác (id 247)
  {
    targetSlug: "muc-mat-lech",
    newSlug: "muc-mat-choi-lac",
    common_name: "Mực Mắt Chọi Lác",
    common_name_en: "Cockeyed Squid (Jewel Squid)",
    scientificName: "Histioteuthis pacifica",
    description: "Sở hữu hai mắt bất đối xứng độc nhất: mắt trái to lồi màu vàng hướng lên để soi bóng con mồi ngược ánh sáng tầng mặt, mắt phải nhỏ màu xanh hướng xuống quét đáy đại dương tăm tối.",
    description_en: "Famous for asymmetric eyes: large upward-facing yellow left eye scans for silhouettes against downwelling surface light, while small downward-facing right eye monitors the dark abyss below.",
    diet: "Cá lồng đèn nhỏ, tôm giáp xác biển sâu",
    diet_en: "Small lanternfish, deep-sea pelagic shrimp",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/7/70/Histioteuthis_NOAA.jpg", caption: "Mực Mắt Chọi Lác (Histioteuthis pacifica) - NOAA Okeanos Explorer", is_primary: true },
      { url: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Histioteuthis_reversa_%28Michael_Vecchione%2C_NOAA%29.JPG", caption: "Chi tiết cơ quan phát quang và mắt bất đối xứng của chi Histioteuthis", is_primary: false },
      { url: "https://static.inaturalist.org/photos/12259849/large.jpg", caption: "Tiêu bản quan sát thực địa mực mắt chọi lác", is_primary: false },
    ],
    facts: [
      { title: "Đôi mắt bất đối xứng", content: "Mắt trái có đường kính gấp đôi mắt phải và có sắc tố vàng nhạy quang đặc biệt." },
      { title: "Chiếc áo phát quang", content: "Mặt bụng được bao phủ bởi hàng trăm cơ quan phát sáng photophore giúp tàng hình ngược sáng." }
    ]
  },

  // 2. Giáp Xác Bơi Khổng Lồ (Gigantocypris)
  {
    targetSlug: "giap-xac-boi-khong-lo-gigantocypris",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Gigantocypris.jpg", caption: "Giáp Xác Bơi Khổng Lồ (Gigantocypris agassizii) với đôi mắt gương cầu lồi lớn", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/586467985/large.jpg", caption: "Toàn thân hình cầu trong suốt màu hổ phách của Gigantocypris", is_primary: false },
      { url: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Notes_on_some_rare_and_interesting_marine_crustacea_%281904%29_%2814596862569%29.jpg", caption: "Minh họa cấu tạo mắt gương đặc biệt của chi Gigantocypris", is_primary: false },
    ]
  },

  // 3. Giun Ống Miệng Lạnh Haima (Paraescarpia echinospica)
  {
    targetSlug: "giun-ong-mieng-lanh-haima",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/4/48/Nur04505.jpg", caption: "Thảm giun ống tại miệng phun lạnh biển sâu (Siboglinidae / Paraescarpia)", is_primary: true },
      { url: "https://upload.wikimedia.org/wikipedia/commons/9/96/Champ_de_vers_siboglinid%C3%A9s_%28Siboglinidae%29_%28Ifremer_00558-67007_-_20629%29.jpg", caption: "Quần xã giun ống cộng sinh vi khuẩn hóa tổng hợp methane dưới đáy sâu", is_primary: false },
      { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Riftia_tube_worms_Galapagos_2011.jpg/960px-Riftia_tube_worms_Galapagos_2011.jpg", caption: "Cận cảnh cụm giun ống biển sâu Siboglinidae", is_primary: false },
    ]
  },

  // 4. Trai Biển Sâu Haima (Gigantidas haimaensis)
  {
    targetSlug: "trai-bien-sau-haima",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Gigantidas_tangaroa.jpg", caption: "Trai Biển Sâu Haima (Gigantidas) sống tại bồn trũng đáy sâu Biển Đông", is_primary: true },
      { url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Bathymodiolus_childressi.jpg", caption: "Quần tụ thảm trai quanh vết rò rỉ methane đáy sâu", is_primary: false },
      { url: "https://static.inaturalist.org/photos/245584309/large.jpeg", caption: "Mẫu vỏ và mô cộng sinh vi khuẩn của trai biển sâu Gigantidas", is_primary: false },
    ]
  },

  // 5. Cá Ốc Rãnh Sâu Manila (Pseudoliparis amblystomopsis)
  {
    targetSlug: "ca-oc-ranh-sau-hadal-snailfish",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Pseudoliparis_swirei.png", caption: "Cá Ốc Rãnh Sâu Manila (Pseudoliparis) bơi ở độ sâu hơn 4,800m", is_primary: true },
      { url: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Pseudoliparis_swirei_drawing.svg", caption: "Sơ đồ giải phẫu thích nghi áp suất cực cao của cá ốc rãnh sâu hadal", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/18324426/large.jpeg", caption: "Tiêu bản cá ốc vùng rãnh thẳm họ Liparidae", is_primary: false },
    ]
  },

  // 6. Sao Giòn Vực Thẳm (Ophiura sarsii)
  {
    targetSlug: "sao-gion-vuc-tham",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/3/31/Ophiura_sarsii.jpg", caption: "Sao Giòn Vực Thẳm (Ophiura sarsii) bám trên đá bazan đáy Rãnh Manila", is_primary: true },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/154202786/large.jpg", caption: "Cận cảnh 5 cánh uốn lượn linh hoạt của sao giòn biển sâu", is_primary: false },
      { url: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Ophiura_sarsii_%28EQCS056-08%29.jpg", caption: "Mẫu sao giòn thu thập từ chuyến thám hiểm đại dương", is_primary: false },
    ]
  },

  // 7. Mực Thủy Tinh (Cranchia scabra)
  {
    targetSlug: "muc-thuy-tinh-glass-squid",
    media: [
      { url: "https://upload.wikimedia.org/wikipedia/commons/7/74/Cranchia_scabra.jpg", caption: "Mực Thủy Tinh Trong Suốt (Cranchia scabra) bơi lơ lửng ở tầng chạng vạng", is_primary: true },
      { url: "https://upload.wikimedia.org/wikipedia/commons/3/3b/Cranchia_scabra_-_NHM_1.jpg", caption: "Gai sần và túi cơ thể trong suốt như thủy tinh của Cranchia scabra", is_primary: false },
      { url: "https://inaturalist-open-data.s3.amazonaws.com/photos/174546799/large.jpg", caption: "Đôi mắt phát quang xanh ngọc của mực thủy tinh", is_primary: false },
    ]
  },
];

async function run() {
  console.log("Updating Neon database for ocean depth creatures...");

  for (const fix of FIXES) {
    const sp = await prisma.species.findFirst({
      where: {
        OR: [
          { slug: fix.targetSlug },
          { slug: fix.newSlug || fix.targetSlug },
        ],
      },
    });

    if (!sp) {
      console.log(`[WARN] Not found: ${fix.targetSlug}`);
      continue;
    }

    const updateData = {};
    if (fix.newSlug) updateData.slug = fix.newSlug;
    if (fix.common_name) updateData.common_name = fix.common_name;
    if (fix.scientificName) updateData.scientificName = fix.scientificName;
    if (fix.description) updateData.description = fix.description;
    if (fix.diet) updateData.diet = fix.diet;

    await prisma.species.update({
      where: { id: sp.id },
      data: updateData,
    });
    console.log(`Updated species #${sp.id} -> slug: ${updateData.slug || sp.slug}`);

    // Update media
    if (fix.media && fix.media.length > 0) {
      await prisma.species_media.deleteMany({
        where: { species_id: sp.id },
      });

      for (let i = 0; i < fix.media.length; i++) {
        const m = fix.media[i];
        await prisma.species_media.create({
          data: {
            species_id: sp.id,
            type: "image",
            url: m.url,
            caption: m.caption,
            is_primary: !!m.is_primary,
            sort_order: i + 1,
          },
        });
      }
      console.log(`  -> Replaced ${fix.media.length} media items`);
    }

    // Translations
    if (fix.common_name) {
      await prisma.species_translations.upsert({
        where: {
          species_id_language_code: {
            species_id: sp.id,
            language_code: "vi",
          },
        },
        update: {
          common_name: fix.common_name,
          description: fix.description || sp.description,
          diet: fix.diet || sp.diet,
        },
        create: {
          species_id: sp.id,
          language_code: "vi",
          common_name: fix.common_name,
          description: fix.description || sp.description,
          diet: fix.diet || sp.diet,
        },
      });

      if (fix.common_name_en) {
        await prisma.species_translations.upsert({
          where: {
            species_id_language_code: {
              species_id: sp.id,
              language_code: "en",
            },
          },
          update: {
            common_name: fix.common_name_en,
            description: fix.description_en || sp.description,
            diet: fix.diet_en || sp.diet,
          },
          create: {
            species_id: sp.id,
            language_code: "en",
            common_name: fix.common_name_en,
            description: fix.description_en || sp.description,
            diet: fix.diet_en || sp.diet,
          },
        });
      }
    }

    // Facts
    if (fix.facts && fix.facts.length > 0) {
      await prisma.species_facts.deleteMany({
        where: { species_id: sp.id },
      });
      for (let i = 0; i < fix.facts.length; i++) {
        const f = fix.facts[i];
        await prisma.species_facts.create({
          data: {
            species_id: sp.id,
            content: `${f.title}: ${f.content}`,
            sort_order: i + 1,
          },
        });
      }
    }
  }

  console.log("Database update completed!");
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
