import speciesRepository from "../repositories/speciesRepository.js";
import {
  generateNextSpeciesCode,
  generateSlug,
  getGroupPrefix,
} from "../utils/speciesHelper.js";
import prisma from "../lib/prisma.js";
import taxonomyService from "./taxonomyService.js";
import apiProviderService from "./apiProviderService.js";
import vectorSearchService from "./vectorSearchService.js";

function toFloatOrNull(val) {
  if (val === undefined || val === null || val === "") return null;
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : null;
}

function toIntOrNull(val) {
  if (val === undefined || val === null || val === "") return null;
  const num = parseInt(val, 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * SpeciesService - Tầng xử lý nghiệp vụ cho Sinh vật
 */
export class SpeciesService {
  /**
   * Lấy danh sách sinh vật kèm phân trang và bộ lọc
   */
  async getSpeciesList(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(queryParams.limit, 10) || 10),
    );
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
      where.is_visible =
        queryParams.is_visible === "true" || queryParams.is_visible === true;
    }

    // Sắp xếp dữ liệu
    let orderBy = { id: "desc" };
    if (queryParams.sortBy) {
      const direction = queryParams.order === "asc" ? "asc" : "desc";
      const validSortCols = {
        id: "id",
        code: "code",
        name: "common_name",
        common_name: "common_name",
        scientificName: "scientificName",
        scientific_name: "scientificName",
        views: "view_count",
        view_count: "view_count",
        is_visible: "is_visible",
        created_at: "created_at",
      };
      const targetCol = validSortCols[queryParams.sortBy];
      if (targetCol) {
        orderBy = { [targetCol]: direction };
      }
    }

    const [items, total] = await Promise.all([
      speciesRepository.findAll({ where, skip, take: limit, orderBy }),
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
   * Thêm sinh vật mới
   */
  async createSpecies(dto) {
    // 1. Map DTO flexible fields
    const scientificName = dto.scientificName || dto.scientific_name || "Chưa cập nhật";
    const commonName = dto.name || dto.common_name || scientificName || "Sinh vật mới";

    let oceanZoneId = dto.ocean_zone_id ? parseInt(dto.ocean_zone_id, 10) : null;
    if (!oceanZoneId && dto.oceanZone) {
      const zoneMap = { Sunlight: 1, Twilight: 2, Midnight: 3, Abyssal: 4, Hadal: 5 };
      oceanZoneId = zoneMap[dto.oceanZone] || parseInt(dto.oceanZone, 10) || null;
    }
    if (oceanZoneId) {
      const zoneExists = await prisma.ocean_zones.findUnique({ where: { id: oceanZoneId } });
      if (!zoneExists) oceanZoneId = null;
    }

    let conservationStatusId = dto.conservation_status_id ? parseInt(dto.conservation_status_id, 10) : null;
    if (!conservationStatusId && dto.conservationStatus) {
      const statusMap = { LC: 1, NT: 2, VU: 3, EN: 4, CR: 5, EW: 6, EX: 7, DD: 8, NE: 9 };
      conservationStatusId = statusMap[dto.conservationStatus] || parseInt(dto.conservationStatus, 10) || null;
    }

    let statusCode = "NE";
    if (conservationStatusId) {
      const statusRecord = await prisma.conservation_statuses.findUnique({
        where: { id: conservationStatusId },
        select: { code: true },
      });
      if (statusRecord?.code) {
        statusCode = statusRecord.code;
      } else {
        conservationStatusId = null;
      }
    }

    let groupId = dto.group_id || dto.groupId;
    groupId = groupId ? BigInt(groupId) : null;

    // Lấy mã viết tắt nhóm sinh vật
    let groupCode = "SPC";
    if (groupId) {
      const groupRecord = await prisma.species_groups.findUnique({
        where: { id: groupId },
        select: { id: true, name: true, slug: true },
      });
      if (groupRecord) {
        groupCode = getGroupPrefix(groupRecord.slug || groupRecord.name);
      } else {
        // If specified groupId does not exist, fallback to first group or null
        const firstGroup = await prisma.species_groups.findFirst();
        if (firstGroup) {
          groupId = firstGroup.id;
          groupCode = getGroupPrefix(firstGroup.slug || firstGroup.name);
        } else {
          groupId = null;
        }
      }
    } else {
      // Auto-detect group if not provided
      const firstGroup = await prisma.species_groups.findFirst();
      if (firstGroup) {
        groupId = firstGroup.id;
        groupCode = getGroupPrefix(firstGroup.slug || firstGroup.name);
      }
    }

    // 4. Tự tạo mã sinh vật [GROUP]-[STATUS]-[NUMBER] nếu chưa truyền
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

    // 5. Tự sinh slug
    const nameForSlug = commonName || scientificName || code;
    let baseSlug = dto.slug || generateSlug(nameForSlug);
    let finalSlug = baseSlug;
    let counter = 1;

    // Đảm bảo slug là duy nhất
    while (
      await speciesRepository
        .findAll({ where: { slug: finalSlug }, take: 1 })
        .then((res) => res.length > 0)
    ) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 6. Đóng gói dữ liệu chèn DB
    const dataToCreate = {
      code,
      scientificName,
      common_name: commonName,
      slug: finalSlug,
      description: dto.description || null,
      size_min_cm: toFloatOrNull(dto.sizeMinCm ?? dto.size_min_cm),
      size_max_cm: toFloatOrNull(dto.sizeMaxCm ?? dto.size_max_cm),
      weight_min_kg: toFloatOrNull(dto.weightMinKg ?? dto.weight_min_kg),
      weight_max_kg: toFloatOrNull(dto.weightMaxKg ?? dto.weight_max_kg),
      lifespan_years: toIntOrNull(dto.lifespanYears ?? dto.lifespan_years),
      diet: dto.diet || null,
      depth_min_m: toIntOrNull(dto.depthMin ?? dto.depth_min_m),
      depth_max_m: toIntOrNull(dto.depthMax ?? dto.depth_max_m),
      temperature_min_c: toFloatOrNull(dto.tempMinC ?? dto.temperature_min_c),
      temperature_max_c: toFloatOrNull(dto.tempMaxC ?? dto.temperature_max_c),
      model_3d_url: dto.model3dUrl || dto.model_3d_url || null,
      sound_url: dto.soundUrl || dto.sound_url || null,
      source_api_id: dto.source_api_id || dto.sourceApiId || (dto.aphiaID ? `worms:${dto.aphiaID}` : null),
      east_sea_zone: dto.east_sea_zone || dto.geoZone || null,
      local_distribution: dto.local_distribution || null,
      is_visible: dto.is_visible !== undefined ? Boolean(dto.is_visible) : true,
      group_id: groupId,
      conservation_status_id: conservationStatusId,
      ocean_zone_id: oceanZoneId,
    };

    const newSpecies = await speciesRepository.create(dataToCreate);

    // 7. Tạo danh sách species_media trong DB
    const rawMedia = dto.mediaItems || (dto.images ? dto.images.map(img => ({ url: img, type: "image" })) : []);
    if (rawMedia && rawMedia.length > 0) {
      const mediaRecords = rawMedia.map((item, idx) => ({
        species_id: newSpecies.id,
        url: typeof item === "string" ? item : item.url,
        type: (typeof item === "object" && item.type === "video") ? "video" : "image",
        sort_order: idx,
        is_primary: idx === 0,
        caption: commonName,
      }));
      await prisma.species_media.createMany({ data: mediaRecords });
    }

    const created = await speciesRepository.findById(newSpecies.id);

    // Sinh vector ngữ nghĩa chạy ngầm
    vectorSearchService.syncSingleSpeciesEmbedding(newSpecies.id).catch((err) =>
      console.warn("[VectorSearch] Auto sync on createSpecies failed:", err.message)
    );

    return created;
  }

  /**
   * Cập nhật sinh vật
   */
  async updateSpecies(id, dto) {
    await this.getSpeciesById(id); // Thắc mắc 404 nếu không tìm thấy

    const dataToUpdate = {};

    const sciName = dto.scientificName || dto.scientific_name;
    if (sciName !== undefined) dataToUpdate.scientificName = sciName;

    const commName = dto.name || dto.common_name;
    if (commName !== undefined) dataToUpdate.common_name = commName;

    if (dto.description !== undefined) dataToUpdate.description = dto.description;

    const sMin = dto.sizeMinCm !== undefined ? dto.sizeMinCm : dto.size_min_cm;
    if (sMin !== undefined) dataToUpdate.size_min_cm = toFloatOrNull(sMin);

    const sMax = dto.sizeMaxCm !== undefined ? dto.sizeMaxCm : dto.size_max_cm;
    if (sMax !== undefined) dataToUpdate.size_max_cm = toFloatOrNull(sMax);

    const wMin = dto.weightMinKg !== undefined ? dto.weightMinKg : dto.weight_min_kg;
    if (wMin !== undefined) dataToUpdate.weight_min_kg = toFloatOrNull(wMin);

    const wMax = dto.weightMaxKg !== undefined ? dto.weightMaxKg : dto.weight_max_kg;
    if (wMax !== undefined) dataToUpdate.weight_max_kg = toFloatOrNull(wMax);

    const ls = dto.lifespanYears !== undefined ? dto.lifespanYears : dto.lifespan_years;
    if (ls !== undefined) dataToUpdate.lifespan_years = toIntOrNull(ls);

    if (dto.diet !== undefined) dataToUpdate.diet = dto.diet;

    const dMin = dto.depthMin !== undefined ? dto.depthMin : dto.depth_min_m;
    if (dMin !== undefined) dataToUpdate.depth_min_m = toIntOrNull(dMin);

    const dMax = dto.depthMax !== undefined ? dto.depthMax : dto.depth_max_m;
    if (dMax !== undefined) dataToUpdate.depth_max_m = toIntOrNull(dMax);

    const tMin = dto.tempMinC !== undefined ? dto.tempMinC : dto.temperature_min_c;
    if (tMin !== undefined) dataToUpdate.temperature_min_c = toFloatOrNull(tMin);

    const tMax = dto.tempMaxC !== undefined ? dto.tempMaxC : dto.temperature_max_c;
    if (tMax !== undefined) dataToUpdate.temperature_max_c = toFloatOrNull(tMax);

    const m3d = dto.model3dUrl !== undefined ? dto.model3dUrl : dto.model_3d_url;
    if (m3d !== undefined) dataToUpdate.model_3d_url = m3d || null;

    const snd = dto.soundUrl !== undefined ? dto.soundUrl : dto.sound_url;
    if (snd !== undefined) dataToUpdate.sound_url = snd || null;

    const srcApi = dto.source_api_id !== undefined ? dto.source_api_id : dto.sourceApiId;
    if (srcApi !== undefined) dataToUpdate.source_api_id = srcApi || null;

    const eastSea = dto.east_sea_zone !== undefined ? dto.east_sea_zone : dto.geoZone;
    if (eastSea !== undefined) dataToUpdate.east_sea_zone = eastSea || null;

    if (dto.local_distribution !== undefined) {
      dataToUpdate.local_distribution = dto.local_distribution || null;
    }

    if (dto.is_visible !== undefined) dataToUpdate.is_visible = Boolean(dto.is_visible);

    const grp = dto.groupId !== undefined ? dto.groupId : dto.group_id;
    if (grp !== undefined) {
      const rawGrp = grp ? BigInt(grp) : null;
      if (rawGrp) {
        const groupExists = await prisma.species_groups.findUnique({ where: { id: rawGrp } });
        dataToUpdate.group_id = groupExists ? rawGrp : null;
      } else {
        dataToUpdate.group_id = null;
      }
    }

    const cons = dto.conservationStatus !== undefined ? dto.conservationStatus : dto.conservation_status_id;
    if (cons !== undefined) {
      const statusMap = { LC: 1, NT: 2, VU: 3, EN: 4, CR: 5, EW: 6, EX: 7, DD: 8, NE: 9 };
      let sId = statusMap[cons] || (cons ? parseInt(cons, 10) : null);
      if (sId) {
        const statusExists = await prisma.conservation_statuses.findUnique({ where: { id: sId } });
        dataToUpdate.conservation_status_id = statusExists ? sId : null;
      } else {
        dataToUpdate.conservation_status_id = null;
      }
    }

    const zone = dto.oceanZone !== undefined ? dto.oceanZone : dto.ocean_zone_id;
    if (zone !== undefined) {
      const zoneMap = { Sunlight: 1, Twilight: 2, Midnight: 3, Abyssal: 4, Hadal: 5 };
      let zId = zoneMap[zone] || (zone ? parseInt(zone, 10) : null);
      if (zId) {
        const zoneExists = await prisma.ocean_zones.findUnique({ where: { id: zId } });
        dataToUpdate.ocean_zone_id = zoneExists ? zId : null;
      } else {
        dataToUpdate.ocean_zone_id = null;
      }
    }

    const updated = await speciesRepository.update(id, dataToUpdate);

    // Cập nhật media nếu có
    const rawMedia = dto.mediaItems || (dto.images ? dto.images.map(img => ({ url: img, type: "image" })) : null);
    if (rawMedia) {
      await prisma.species_media.deleteMany({ where: { species_id: BigInt(id) } });
      if (rawMedia.length > 0) {
        const mediaRecords = rawMedia.map((item, idx) => ({
          species_id: BigInt(id),
          url: typeof item === "string" ? item : item.url,
          type: (typeof item === "object" && item.type === "video") ? "video" : "image",
          sort_order: idx,
          is_primary: idx === 0,
        }));
        await prisma.species_media.createMany({ data: mediaRecords });
      }
    }

    const finalRecord = await speciesRepository.findById(id);

    // Tự động cập nhật vector ngữ nghĩa cho loài được chỉnh sửa trong nền
    vectorSearchService.syncSingleSpeciesEmbedding(id).catch((err) =>
      console.warn("[VectorSearch] Auto sync on updateSpecies failed:", err.message)
    );

    return finalRecord;
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
    const result = await speciesRepository.softDelete(id);

    // Tự động gỡ bỏ vector của loài đã xóa trong nền
    vectorSearchService.removeSpeciesEmbedding(id).catch((err) =>
      console.warn("[VectorSearch] Auto remove on deleteSpecies failed:", err.message)
    );

    return result;
  }

  /**
   * Đồng bộ dữ liệu tự động từ Cổng Khoa học Đa nguồn (WoRMS + OBIS + GBIF + iNaturalist + Wikidata)
   */
  async syncFromExternalAPI({
    scientificName,
    group_id,
    ocean_zone_id,
    conservation_status_id,
  }) {
    if (!scientificName || scientificName.trim() === "") {
      const error = new Error(
        "Tên khoa học (scientificName) là bắt buộc để đồng bộ",
      );
      error.statusCode = 400;
      throw error;
    }

    const cleanName = scientificName.trim();
    const taxRes = await taxonomyService.searchTaxonomy(cleanName, "auto");

    if (!taxRes || !taxRes.success || !taxRes.data) {
      const error = new Error(
        taxRes?.message || `Không tìm thấy dữ liệu xác thực cho "${cleanName}" từ các nguồn API khoa học.`,
      );
      error.statusCode = 404;
      throw error;
    }

    const d = taxRes.data;
    return this.createSpecies({
      scientificName: d.scientificName || cleanName,
      common_name: d.name || cleanName,
      description: d.description,
      group_id: group_id || d.groupId,
      ocean_zone_id: ocean_zone_id,
      oceanZone: d.oceanZone,
      conservation_status_id: conservation_status_id,
      conservationStatus: d.conservationStatus,
      depthMin: d.depthMin,
      depthMax: d.depthMax,
      sizeMinCm: d.sizeMinCm,
      sizeMaxCm: d.sizeMaxCm,
      weightMinKg: d.weightMinKg,
      weightMaxKg: d.weightMaxKg,
      lifespanYears: d.lifespanYears,
      tempMinC: d.tempMinC,
      tempMaxC: d.tempMaxC,
      diet: d.diet,
      source_api_id: d.source_api_id,
      east_sea_zone: d.geoZone,
      mediaItems: d.mediaItems,
    });
  }

  
  async getSyncStatus() {
    const [providersWithPing, incompleteSpecies] = await Promise.all([
      apiProviderService.getAllProviders(true),
      prisma.species.findMany({
        where: {
          deleted_at: null,
          OR: [
            { species_media: { none: {} } },
            { description: null },
            { source_api_id: null },
            { temperature_min_c: null },
          ],
        },
        take: 15,
        include: {
          species_media: true,
        },
      }),
    ]);

    // Active providers formatted for status card display
    const apiStatuses = providersWithPing
      .filter((p) => p.isEnabled)
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        desc: p.statusMessage || p.desc,
        responseTimeMs: p.responseTimeMs,
        category: p.category,
      }));

    const failedSpecies = incompleteSpecies.map((item) => {
      let errMsg = "Thiếu thông tin chi tiết";
      if (item.species_media.length === 0) errMsg = "Thiếu hình ảnh xác thực từ API";
      else if (!item.source_api_id) errMsg = "Thiếu mã truy xuất nguồn gốc (WoRMS / OBIS / GBIF)";
      else if (item.temperature_min_c === null) errMsg = "Thiếu khoảng nhiệt độ thực nghiệm (OBIS)";

      return {
        id: String(item.id),
        name: item.common_name || item.scientificName || `Sinh vật #${item.id}`,
        error: errMsg,
        image: item.species_media?.[0]?.url || null,
      };
    });

    return { apiStatuses, failedSpecies, allProviders: providersWithPing };
  }

  /**
   * Thử lại đồng bộ dữ liệu sinh vật (Ưu tiên tên khoa học chuẩn, chỉ bổ sung trường thật)
   */
  async retrySyncItem(id) {
    const target = await speciesRepository.findById(id);
    if (!target) {
      const error = new Error("Không tìm thấy sinh vật");
      error.statusCode = 404;
      throw error;
    }

    const cleanName = target.scientificName || target.common_name || "";
    const taxRes = await taxonomyService.searchTaxonomy(cleanName, "auto");

    const dataToUpdate = {};
    if (taxRes && taxRes.success && taxRes.data) {
      const d = taxRes.data;
      if ((!target.scientificName || target.scientificName === target.common_name) && d.scientificName) {
        dataToUpdate.scientificName = d.scientificName;
      }
      if (!target.source_api_id && d.source_api_id) {
        dataToUpdate.source_api_id = d.source_api_id;
      }
      if ((!target.description || target.description.trim() === "" || target.description.includes("PostgreSQL")) && d.description) {
        dataToUpdate.description = d.description;
      }
      if (target.size_min_cm === null && toFloatOrNull(d.sizeMinCm) !== null) {
        dataToUpdate.size_min_cm = toFloatOrNull(d.sizeMinCm);
      }
      if (target.size_max_cm === null && toFloatOrNull(d.sizeMaxCm) !== null) {
        dataToUpdate.size_max_cm = toFloatOrNull(d.sizeMaxCm);
      }
      if (target.weight_min_kg === null && toFloatOrNull(d.weightMinKg) !== null) {
        dataToUpdate.weight_min_kg = toFloatOrNull(d.weightMinKg);
      }
      if (target.weight_max_kg === null && toFloatOrNull(d.weightMaxKg) !== null) {
        dataToUpdate.weight_max_kg = toFloatOrNull(d.weightMaxKg);
      }
      if (target.lifespan_years === null && toIntOrNull(d.lifespanYears) !== null) {
        dataToUpdate.lifespan_years = toIntOrNull(d.lifespanYears);
      }
      if (target.depth_min_m === null && toIntOrNull(d.depthMin) !== null) {
        dataToUpdate.depth_min_m = toIntOrNull(d.depthMin);
      }
      if (target.depth_max_m === null && toIntOrNull(d.depthMax) !== null) {
        dataToUpdate.depth_max_m = toIntOrNull(d.depthMax);
      }
      if (target.temperature_min_c === null && toFloatOrNull(d.tempMinC) !== null) {
        dataToUpdate.temperature_min_c = toFloatOrNull(d.tempMinC);
      }
      if (target.temperature_max_c === null && toFloatOrNull(d.tempMaxC) !== null) {
        dataToUpdate.temperature_max_c = toFloatOrNull(d.tempMaxC);
      }
      if (!target.diet && d.diet) {
        dataToUpdate.diet = d.diet;
      }

      // Add missing media photos into species_media table
      if (Array.isArray(d.photos) && d.photos.length > 0) {
        const existingMediaCount = await prisma.species_media.count({
          where: { species_id: BigInt(id) },
        });

        if (existingMediaCount === 0) {
          await prisma.species_media.createMany({
            data: d.photos.map((url, idx) => ({
              species_id: BigInt(id),
              url,
              type: "image",
              sort_order: idx,
              is_primary: idx === 0,
              caption: target.common_name || d.name,
            })),
          });
        }
      }
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await speciesRepository.update(id, dataToUpdate);
    }

    return speciesRepository.findById(id);
  }

  /**
   * Đồng bộ tất cả sinh vật còn thiếu dữ liệu
   */
  async syncAllIncomplete() {
    const incomplete = await prisma.species.findMany({
      where: {
        deleted_at: null,
        OR: [
          { species_media: { none: {} } },
          { description: null },
          { source_api_id: null },
          { temperature_min_c: null },
        ],
      },
      take: 20,
    });

    for (const item of incomplete) {
      try {
        await this.retrySyncItem(item.id);
      } catch {
        // Continue loop
      }
    }

    return { count: incomplete.length };
  }
}

export default new SpeciesService();
