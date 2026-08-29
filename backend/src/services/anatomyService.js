import anatomyRepository from "../repositories/anatomyRepository.js";
import speciesRepository from "../repositories/speciesRepository.js";

/**
 * AnatomyService - Xử lý nghiệp vụ cho dữ liệu giải phẫu sinh vật
 */
export class AnatomyService {
  /**
   * Lấy danh sách giải phẫu theo Species ID hoặc Code/Slug
   */
  async getAnatomyBySpecies(speciesIdOrCode) {
    let species = null;
    const numericId = Number(speciesIdOrCode);

    if (!isNaN(numericId) && numericId > 0) {
      species = await speciesRepository.findById(numericId);
    } else {
      species = await speciesRepository.findByCodeOrSlug(speciesIdOrCode);
    }

    if (!species) {
      throw new Error("Không tìm thấy sinh vật với ID hoặc Code cung cấp");
    }

    const anatomyList = await anatomyRepository.findBySpeciesId(species.id);
    return {
      species: {
        id: species.id.toString(),
        code: species.code,
        scientificName: species.scientificName,
        commonName: species.common_name,
      },
      anatomy: anatomyList.map((item) => ({
        id: item.id.toString(),
        speciesId: item.species_id.toString(),
        partName: item.part_name,
        latinName: item.latin_name,
        system: item.system,
        description: item.description,
        imageUrl: item.image_url,
        hotspotX: item.hotspot_x ? Number(item.hotspot_x) : null,
        hotspotY: item.hotspot_y ? Number(item.hotspot_y) : null,
        svgRx: item.svg_rx ? Number(item.svg_rx) : null,
        svgRy: item.svg_ry ? Number(item.svg_ry) : null,
        medicalData: item.medical_data,
        pos3D: item.pos_3d,
        sortOrder: item.sort_order,
      })),
    };
  }

  /**
   * Thêm bộ phận giải phẫu mới
   */
  async createAnatomy(data) {
    if (!data.species_id || !data.part_name) {
      throw new Error("species_id và part_name là bắt buộc");
    }
    const created = await anatomyRepository.create(data);
    return {
      ...created,
      id: created.id.toString(),
      species_id: created.species_id.toString(),
    };
  }

  /**
   * Cập nhật bộ phận giải phẫu
   */
  async updateAnatomy(id, data) {
    const existing = await anatomyRepository.findById(id);
    if (!existing) {
      throw new Error("Không tìm thấy bộ phận giải phẫu với ID này");
    }
    const updated = await anatomyRepository.update(id, data);
    return {
      ...updated,
      id: updated.id.toString(),
      species_id: updated.species_id.toString(),
    };
  }

  /**
   * Xóa bộ phận giải phẫu
   */
  async deleteAnatomy(id) {
    const existing = await anatomyRepository.findById(id);
    if (!existing) {
      throw new Error("Không tìm thấy bộ phận giải phẫu với ID này");
    }
    return anatomyRepository.delete(id);
  }

  /**
   * Seed dữ liệu giải phẫu mẫu cho sinh vật
   */
  async seedAnatomyData(speciesId, items) {
    return anatomyRepository.seedAnatomyForSpecies(speciesId, items);
  }
}

export default new AnatomyService();
