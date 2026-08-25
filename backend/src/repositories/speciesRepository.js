import prisma from "../lib/prisma.js";

/**
 * SpeciesRepository - Tầng truy vấn dữ liệu cho Sinh vật (Species)
 */
export class SpeciesRepository {
  /**
   * Lấy danh sách sinh vật theo điều kiện và phân trang
   */
  async findAll({ where = {}, skip = 0, take = 10, orderBy = { id: "desc" } }) {
    return prisma.species.findMany({
      where: {
        deleted_at: null,
        ...where,
      },
      skip,
      take,
      orderBy,
      include: {
        species_groups: {
          select: { id: true, name: true, slug: true },
        },
        conservation_statuses: {
          select: { id: true, code: true, name: true },
        },
        ocean_zones: {
          select: { id: true, name: true, depth_min_m: true, depth_max_m: true },
        },
        species_media: {
          take: 3,
          orderBy: { sort_order: "asc" },
        },
      },
    });
  }

  /**
   * Đếm số lượng sinh vật thỏa điều kiện
   */
  async count(where = {}) {
    return prisma.species.count({
      where: {
        deleted_at: null,
        ...where,
      },
    });
  }

  /**
   * Tìm sinh vật theo ID
   */
  async findById(id) {
    return prisma.species.findFirst({
      where: {
        id: BigInt(id),
        deleted_at: null,
      },
      include: {
        species_groups: true,
        conservation_statuses: true,
        ocean_zones: true,
        species_media: true,
        species_facts: true,
      },
    });
  }

  /**
   * Lấy mã sinh vật mới nhất trong DB
   */
  async getLastCode() {
    const lastRecord = await prisma.species.findFirst({
      orderBy: { id: "desc" },
      select: { code: true },
    });
    return lastRecord ? lastRecord.code : null;
  }

  /**
   * Tìm sinh vật theo Code
   */
  async findByCode(code) {
    return prisma.species.findUnique({
      where: { code },
    });
  }

  /**
   * Tạo sinh vật mới
   */
  async create(data) {
    return prisma.species.create({
      data,
    });
  }

  /**
   * Cập nhật thông tin sinh vật
   */
  async update(id, data) {
    return prisma.species.update({
      where: { id: BigInt(id) },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Cập nhật trạng thái ẩn / hiện sinh vật
   */
  async updateVisibility(id, is_visible) {
    return prisma.species.update({
      where: { id: BigInt(id) },
      data: {
        is_visible: Boolean(is_visible),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Xóa mềm sinh vật
   */
  async softDelete(id) {
    return prisma.species.update({
      where: { id: BigInt(id) },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
}

export default new SpeciesRepository();
