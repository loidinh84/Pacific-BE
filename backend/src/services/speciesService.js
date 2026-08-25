import speciesRepository from "../repositories/speciesRepository.js";
import { generateNextSpeciesCode, generateSlug, getGroupPrefix } from "../utils/speciesHelper.js";
import prisma from "../lib/prisma.js";
import axios from "axios";

/**
 * SpeciesService - Tầng xử lý nghiệp vụ cho Sinh vật
 */
export class SpeciesService {
  /**
   * Lấy danh sách sinh vật kèm phân trang và bộ lọc
   */
  async getSpeciesList(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const where = {};

    // Tìm kiếm theo từ khóa
    if (queryParams.search && queryParams.search.trim() !== "") {
      const keyword = queryParams.search.trim();
      where.OR = [
        { common_name: { contains: keyword, mode: "insensitive" } },
        { scientificName: { contains: keyword, mode: "insensitive" } },
        { code: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Lọc theo nhóm sinh vật
    if (queryParams.group_id) {
      where.group_id = BigInt(queryParams.group_id);
    }

    // Lọc theo tình trạng bảo tồn
    if (queryParams.status_id) {
      where.conservation_status_id = parseInt(queryParams.status_id, 10);
    }

    // Lọc theo trạng thái ẩn/hiện
    if (queryParams.is_visible !== undefined && queryParams.is_visible !== "") {
      where.is_visible = queryParams.is_visible === "true" || queryParams.is_visible === true;
    }

    const [items, total] = await Promise.all([
      speciesRepository.findAll({ where, skip, take: limit }),
      speciesRepository.count(where),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Lấy chi tiết 1 sinh vật theo ID
   */
  async getSpeciesById(id) {
    const species = await speciesRepository.findById(id);
    if (!species) {
      const error = new Error("Không tìm thấy sinh vật");
      error.statusCode = 404;
      throw error;
    }
    return species;
  }

  /**
   * Thêm sinh vật mới (Tự sinh mã chuẩn [GROUP]-[STATUS]-[NUMBER] và slug)
   */
  async createSpecies(dto) {
    // 1. Tìm mã viết tắt nhóm sinh vật (VD: FSH, MAM, REP, INV, PLN, SPC)
    let groupCode = "SPC";
    if (dto.group_id) {
      const groupRecord = await prisma.species_groups.findUnique({
        where: { id: BigInt(dto.group_id) },
        select: { name: true, slug: true },
      });
      if (groupRecord) {
        groupCode = getGroupPrefix(groupRecord.slug || groupRecord.name);
      }
    }

    // 2. Tìm mã viết tắt của trạng thái bảo tồn (VD: VU, EN, CR, LC, NE...)
    let statusCode = "NE";
    if (dto.conservation_status_id) {
      const statusRecord = await prisma.conservation_statuses.findUnique({
        where: { id: parseInt(dto.conservation_status_id, 10) },
        select: { code: true },
      });
      if (statusRecord?.code) {
        statusCode = statusRecord.code;
      }
    }

    // 3. Tự tạo mã sinh vật [GROUP]-[STATUS]-[NUMBER] nếu chưa truyền
    let code = dto.code;
    if (!code || code.trim() === "") {
      const lastCode = await speciesRepository.getLastCode();
      code = generateNextSpeciesCode(lastCode, groupCode, statusCode);
    }

    // Kiểm tra trùng mã code
    const existingCode = await speciesRepository.findByCode(code);
    if (existingCode) {
      const error = new Error(`Mã sinh vật ${code} đã tồn tại trong hệ thống`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Tự sinh slug
    const nameForSlug = dto.common_name || dto.scientificName || code;
    let baseSlug = dto.slug || generateSlug(nameForSlug);
    let finalSlug = baseSlug;
    let counter = 1;

    // Đảm bảo slug là duy nhất
    while (await speciesRepository.findAll({ where: { slug: finalSlug }, take: 1 }).then(res => res.length > 0)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 3. Đóng gói dữ liệu chèn DB
    const dataToCreate = {
      code,
      scientificName: dto.scientificName || "Chưa cập nhật",
      common_name: dto.common_name || dto.scientificName || code,
      slug: finalSlug,
      description: dto.description || null,
      size_min_cm: dto.size_min_cm ? parseFloat(dto.size_min_cm) : null,
      size_max_cm: dto.size_max_cm ? parseFloat(dto.size_max_cm) : null,
      weight_min_kg: dto.weight_min_kg ? parseFloat(dto.weight_min_kg) : null,
      weight_max_kg: dto.weight_max_kg ? parseFloat(dto.weight_max_kg) : null,
      lifespan_years: dto.lifespan_years ? parseInt(dto.lifespan_years, 10) : null,
      diet: dto.diet || null,
      depth_min_m: dto.depth_min_m ? parseInt(dto.depth_min_m, 10) : null,
      depth_max_m: dto.depth_max_m ? parseInt(dto.depth_max_m, 10) : null,
      is_visible: dto.is_visible !== undefined ? Boolean(dto.is_visible) : true,
      group_id: dto.group_id ? BigInt(dto.group_id) : null,
      conservation_status_id: dto.conservation_status_id ? parseInt(dto.conservation_status_id, 10) : null,
      ocean_zone_id: dto.ocean_zone_id ? parseInt(dto.ocean_zone_id, 10) : null,
    };

    return speciesRepository.create(dataToCreate);
  }

  /**
   * Cập nhật sinh vật
   */
  async updateSpecies(id, dto) {
    await this.getSpeciesById(id); // Thắc mắc 404 nếu không tìm thấy

    const dataToUpdate = {};

    if (dto.scientificName !== undefined) dataToUpdate.scientificName = dto.scientificName;
    if (dto.common_name !== undefined) dataToUpdate.common_name = dto.common_name;
    if (dto.description !== undefined) dataToUpdate.description = dto.description;
    if (dto.size_min_cm !== undefined) dataToUpdate.size_min_cm = dto.size_min_cm ? parseFloat(dto.size_min_cm) : null;
    if (dto.size_max_cm !== undefined) dataToUpdate.size_max_cm = dto.size_max_cm ? parseFloat(dto.size_max_cm) : null;
    if (dto.weight_min_kg !== undefined) dataToUpdate.weight_min_kg = dto.weight_min_kg ? parseFloat(dto.weight_min_kg) : null;
    if (dto.weight_max_kg !== undefined) dataToUpdate.weight_max_kg = dto.weight_max_kg ? parseFloat(dto.weight_max_kg) : null;
    if (dto.lifespan_years !== undefined) dataToUpdate.lifespan_years = dto.lifespan_years ? parseInt(dto.lifespan_years, 10) : null;
    if (dto.diet !== undefined) dataToUpdate.diet = dto.diet;
    if (dto.depth_min_m !== undefined) dataToUpdate.depth_min_m = dto.depth_min_m ? parseInt(dto.depth_min_m, 10) : null;
    if (dto.depth_max_m !== undefined) dataToUpdate.depth_max_m = dto.depth_max_m ? parseInt(dto.depth_max_m, 10) : null;
    if (dto.is_visible !== undefined) dataToUpdate.is_visible = Boolean(dto.is_visible);
    if (dto.group_id !== undefined) dataToUpdate.group_id = dto.group_id ? BigInt(dto.group_id) : null;
    if (dto.conservation_status_id !== undefined) dataToUpdate.conservation_status_id = dto.conservation_status_id ? parseInt(dto.conservation_status_id, 10) : null;
    if (dto.ocean_zone_id !== undefined) dataToUpdate.ocean_zone_id = dto.ocean_zone_id ? parseInt(dto.ocean_zone_id, 10) : null;

    return speciesRepository.update(id, dataToUpdate);
  }

  /**
   * Cập nhật ẩn / hiện loài
   */
  async toggleVisibility(id, is_visible) {
    await this.getSpeciesById(id);
    return speciesRepository.updateVisibility(id, is_visible);
  }

  /**
   * Xóa mềm sinh vật
   */
  async deleteSpecies(id) {
    await this.getSpeciesById(id);
    return speciesRepository.softDelete(id);
  }

  /**
   * Đồng bộ dữ liệu tự động từ GBIF API theo tên khoa học
   */
  async syncFromExternalAPI({ scientificName, group_id, ocean_zone_id, conservation_status_id }) {
    if (!scientificName || scientificName.trim() === "") {
      const error = new Error("Tên khoa học (scientificName) là bắt buộc để đồng bộ");
      error.statusCode = 400;
      throw error;
    }

    const cleanName = scientificName.trim();

    // 1. Gọi GBIF Match API
    let gbifData = null;
    try {
      const response = await axios.get(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(cleanName)}`
      );
      gbifData = response.data;
    } catch (err) {
      console.warn("Lỗi khi kết nối GBIF API:", err.message);
    }

    const matchedName = gbifData?.canonicalName || gbifData?.scientificName || cleanName;
    const commonName = gbifData?.vernacularName || matchedName;
    const description = `Thông tin tự động đồng bộ từ GBIF API cho loài ${matchedName}. Họ (Family): ${gbifData?.family || "Chưa rõ"}, Bộ (Order): ${gbifData?.order || "Chưa rõ"}.`;

    // 2. Thêm vào database
    return this.createSpecies({
      scientificName: matchedName,
      common_name: commonName,
      description,
      group_id,
      ocean_zone_id,
      conservation_status_id,
    });
  }
}

export default new SpeciesService();
