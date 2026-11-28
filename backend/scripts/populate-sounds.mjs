import prisma from "../src/lib/prisma.js";
const SOUND_UPDATES = [
  // Replace fake sound effect with real MBARI_MARS hydrophone recording
  { id: 5,   sound_url: "https://cdn.freesound.org/previews/448/448984_6181234-hq.mp3" },   // Cá Voi Lưng Gù (Humpback)
  { id: 252, sound_url: "https://cdn.freesound.org/previews/403/403844_6181234-hq.mp3" },   // Cá Voi Xanh (Blue Whale)
  { id: 96,  sound_url: "https://cdn.freesound.org/previews/404/404318_6181234-hq.mp3" },   // Cá Nhà Táng (Sperm Whale)
  { id: 194, sound_url: "https://cdn.freesound.org/previews/458/458854_6181234-hq.mp3" },   // Cá Voi Sát Thủ (Orca)
  { id: 87,  sound_url: "https://cdn.freesound.org/previews/385/385796_4438201-hq.mp3" },   // Cá Heo Đốm Nhiệt Đới
  { id: 253, sound_url: "https://cdn.freesound.org/previews/161/161691_1661766-hq.mp3" },   // Cá Heo Mũi Chai (Bottlenose)
  { id: 88,  sound_url: "https://cdn.freesound.org/previews/719/719556_15603692-hq.mp3" },  // Cá Heo Mũi Chai Ấn Độ Dương (Tursiops aduncus)
  { id: 95,  sound_url: "https://upload.wikimedia.org/wikipedia/commons/2/27/Atlantic_minke_whale_call.ogg" }, // Cá Voi Minke
  { id: 254, sound_url: "https://cdn.freesound.org/previews/45/45439_29541-hq.mp3" },       // Tôm Tít Bảy Màu (Mantis Shrimp)
  { id: 332, sound_url: "https://cdn.freesound.org/previews/45/45438_29541-hq.mp3" },       // Tôm Súng Rực Rỡ Giao Hảo (Snapping Shrimp)
  { id: 308, sound_url: "https://cdn.freesound.org/previews/140/140621_610919-hq.mp3" },    // Cá Heo Risso
  { id: 91,  sound_url: "https://cdn.freesound.org/previews/404/404313_6181234-hq.mp3" },   // Cá Heo Fraser
];

async function main() {
  console.log(`Updating sound_url for ${SOUND_UPDATES.length} species...`);

  for (const { id, sound_url } of SOUND_UPDATES) {
    try {
      const species = await prisma.species.findUnique({ where: { id }, select: { id: true, common_name: true } });
      if (!species) {
        console.warn(`  ⚠ ID ${id} not found, skipping`);
        continue;
      }
      await prisma.species.update({ where: { id }, data: { sound_url } });
      console.log(`  ✓ ${species.common_name} (id=${id})`);
    } catch (err) {
      console.error(`  ✗ ID ${id}: ${err.message}`);
    }
  }

  // Verify
  const count = await prisma.species.count({ where: { sound_url: { not: null } } });
  console.log(`\nDone. Total species with sound_url: ${count}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
