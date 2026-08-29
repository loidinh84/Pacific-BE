import prisma from "../lib/prisma.js";

/**
 * AnatomyRepository - Tầng truy vấn dữ liệu cho Giải phẫu sinh vật (species_anatomy)
 */
export class AnatomyRepository {
  /**
   * Lấy danh sách bộ phận giải phẫu theo Species ID
   */
  async findBySpeciesId(speciesId) {
    return prisma.species_anatomy.findMany({
      where: {
        species_id: BigInt(speciesId),
      },
      orderBy: {
        sort_order: "asc",
      },
    });
  }

  /**
   * Lấy chi tiết 1 bộ phận giải phẫu theo ID
   */
  async findById(id) {
    return prisma.species_anatomy.findUnique({
      where: {
        id: BigInt(id),
      },
    });
  }

  /**
   * Tạo mới 1 bộ phận giải phẫu
   */
  async create(data) {
    return prisma.species_anatomy.create({
      data: {
        species_id: BigInt(data.species_id),
        part_name: data.part_name,
        latin_name: data.latin_name || null,
        system: data.system || null,
        description: data.description || null,
        image_url: data.image_url || null,
        hotspot_x: data.hotspot_x !== undefined ? data.hotspot_x : null,
        hotspot_y: data.hotspot_y !== undefined ? data.hotspot_y : null,
        svg_rx: data.svg_rx !== undefined ? data.svg_rx : null,
        svg_ry: data.svg_ry !== undefined ? data.svg_ry : null,
        medical_data: data.medical_data || null,
        pos_3d: data.pos_3d || null,
        sort_order: data.sort_order || 0,
      },
    });
  }

  /**
   * Cập nhật thông tin bộ phận giải phẫu
   */
  async update(id, data) {
    const updateData = {};
    if (data.part_name !== undefined) updateData.part_name = data.part_name;
    if (data.latin_name !== undefined) updateData.latin_name = data.latin_name;
    if (data.system !== undefined) updateData.system = data.system;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.hotspot_x !== undefined) updateData.hotspot_x = data.hotspot_x;
    if (data.hotspot_y !== undefined) updateData.hotspot_y = data.hotspot_y;
    if (data.svg_rx !== undefined) updateData.svg_rx = data.svg_rx;
    if (data.svg_ry !== undefined) updateData.svg_ry = data.svg_ry;
    if (data.medical_data !== undefined) updateData.medical_data = data.medical_data;
    if (data.pos_3d !== undefined) updateData.pos_3d = data.pos_3d;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

    return prisma.species_anatomy.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
  }

  /**
   * Xóa bộ phận giải phẫu
   */
  async delete(id) {
    return prisma.species_anatomy.delete({
      where: { id: BigInt(id) },
    });
  }

  /**
   * Bulk upsert/seed nhiều bộ phận giải phẫu cho 1 sinh vật
   */
  async seedAnatomyForSpecies(speciesId, anatomyItems) {
    // Clean old entries for clean seed
    await prisma.species_anatomy.deleteMany({
      where: { species_id: BigInt(speciesId) },
    });

    const records = anatomyItems.map((item, idx) => ({
      species_id: BigInt(speciesId),
      part_name: item.part_name || item.labelVi,
      latin_name: item.latin_name || item.latinName || null,
      system: item.system || null,
      description: item.description || item.descVi || null,
      image_url: item.image_url || null,
      hotspot_x: item.hotspot_x !== undefined ? item.hotspot_x : item.x,
      hotspot_y: item.hotspot_y !== undefined ? item.hotspot_y : item.y,
      svg_rx: item.svg_rx !== undefined ? item.svg_rx : item.svgRx,
      svg_ry: item.svg_ry !== undefined ? item.svg_ry : item.svgRy,
      medical_data: item.medical_data || item.medicalData || null,
      pos_3d: item.pos_3d || item.pos3D || null,
      sort_order: item.sort_order || idx + 1,
    }));

    return prisma.species_anatomy.createMany({
      data: records,
    });
  }
}

export default new AnatomyRepository();
