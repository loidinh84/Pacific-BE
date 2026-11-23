import prisma from '../src/lib/prisma.js';

const NON_EAST_SEA_IDS = [
  2,   // Enteroctopus dofleini (Bạch Tuộc Khổng Lồ Bắc Thái Bình Dương)
  131, // Acropora cervicornis (San Hô Sừng Hươu Caribe)
  193, // Lagenorhynchus obliquidens (Cá Heo Răng Khía Bắc Thái Bình Dương)
  245, // Grimpoteuthis discoveryi (Bạch Tuộc Dumbo Bắc Đại Tây Dương)
  250, // Syringammina fragilissima (Trùng Lỗ Khổng Lồ Bắc Đại Tây Dương)
  260, // Torpedo californica (Cá Đuối Điện California)
  265, // Phycodurus eques (Cá Rồng Biển Lá Úc)
  269, // Eptatretus stoutii (Cá Phù Thủy Đông Bắc Thái Bình Dương)
  275, // Pseudocarcinus gigas (Cua Khổng Lồ Tasmania)
  285, // Ophiura sarsii (Sao Giòn Cận Cực Bắc)
];

async function main() {
  console.log('--- ĐANG QUÉT VÀ LOẠI BỎ SINH VẬT KHÔNG THUỘC BIỂN ĐÔNG ---');
  
  for (const id of NON_EAST_SEA_IDS) {
    const sp = await prisma.species.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, code: true, common_name: true, scientificName: true, east_sea_zone: true }
    });

    if (sp) {
      console.log(`[XÓA] ID ${id}: ${sp.common_name} (${sp.scientificName}) - Khu vực cũ: ${sp.east_sea_zone}`);
      
      // 1. Soft delete và ẩn hoàn toàn
      await prisma.species.update({
        where: { id: BigInt(id) },
        data: {
          deleted_at: new Date(),
          is_visible: false,
          updated_at: new Date(),
        }
      });

      // 2. Xóa khỏi bảng embeddings nếu có
      try {
        await prisma.species_embeddings.deleteMany({
          where: { species_id: BigInt(id) }
        });
      } catch (e) {
        // No-op
      }
    } else {
      console.log(`[BỎ QUA] ID ${id}: Không tìm thấy trong DB`);
    }
  }

  // 3. Chuẩn hóa loài Bọ Biển Khổng Lồ (ID 50) thành loài đặc hữu Biển Đông/Bình Định: Bathynomus jamesi
  const bobi = await prisma.species.findUnique({ where: { id: BigInt(50) } });
  if (bobi && bobi.scientificName === 'Bathynomus giganteus') {
    await prisma.species.update({
      where: { id: BigInt(50) },
      data: {
        scientificName: 'Bathynomus jamesi',
        common_name: 'Bọ Biển Biển Đông (Bình Định)',
        updated_at: new Date(),
      }
    });
    console.log('[CẬP NHẬT] ID 50: Đã chuẩn hóa danh pháp thành Bathynomus jamesi (loài bọ biển thực tế tại Biển Đông / Bình Định)');
  }

  const remaining = await prisma.species.count({
    where: { is_visible: true, deleted_at: null }
  });
  console.log(`\nHoàn thành! Số lượng sinh vật chuẩn Biển Đông còn lại trong CSDL: ${remaining} loài.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi khi loại bỏ sinh vật:', err);
  process.exit(1);
});
