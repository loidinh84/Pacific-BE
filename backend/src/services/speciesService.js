import speciesRepository from "../repositories/speciesRepository.js";
import {
  generateNextSpeciesCode,
  generateSlug,
  getGroupPrefix,
} from "../utils/speciesHelper.js";
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
    // 1. Map DTO flexible fields
    const scientificName = dto.scientificName || dto.scientific_name || "Chưa cập nhật";
    const commonName = dto.name || dto.common_name || scientificName || "Sinh vật mới";

    let oceanZoneId = dto.ocean_zone_id ? parseInt(dto.ocean_zone_id, 10) : null;
    if (!oceanZoneId && dto.oceanZone) {
      const zoneMap = { Sunlight: 1, Twilight: 2, Midnight: 3, Abyssal: 4, Hadal: 5 };
      oceanZoneId = zoneMap[dto.oceanZone] || parseInt(dto.oceanZone, 10) || null;
    }

    let conservationStatusId = dto.conservation_status_id ? parseInt(dto.conservation_status_id, 10) : null;
    if (!conservationStatusId && dto.conservationStatus) {
      const statusMap = { LC: 1, NT: 2, VU: 3, EN: 4, CR: 5, EW: 6, EX: 7, DD: 8, NE: 9 };
      conservationStatusId = statusMap[dto.conservationStatus] || parseInt(dto.conservationStatus, 10) || null;
    }

    let groupId = dto.group_id || dto.groupId;
    groupId = groupId ? BigInt(groupId) : null;

    // 2. Tìm mã viết tắt nhóm sinh vật (VD: FSH, MAM, REP, INV, PLN, SPC)
    let groupCode = "SPC";
    if (groupId) {
      const groupRecord = await prisma.species_groups.findUnique({
        where: { id: groupId },
        select: { name: true, slug: true },
      });
      if (groupRecord) {
        groupCode = getGroupPrefix(groupRecord.slug || groupRecord.name);
      }
    }

    // 3. Tìm mã viết tắt của trạng thái bảo tồn (VD: VU, EN, CR, LC, NE...)
    let statusCode = "NE";
    if (conservationStatusId) {
      const statusRecord = await prisma.conservation_statuses.findUnique({
        where: { id: conservationStatusId },
        select: { code: true },
      });
      if (statusRecord?.code) {
        statusCode = statusRecord.code;
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
      size_min_cm: (dto.sizeMinCm || dto.size_min_cm) ? parseFloat(dto.sizeMinCm || dto.size_min_cm) : null,
      size_max_cm: (dto.sizeMaxCm || dto.size_max_cm) ? parseFloat(dto.sizeMaxCm || dto.size_max_cm) : null,
      weight_min_kg: (dto.weightMinKg || dto.weight_min_kg) ? parseFloat(dto.weightMinKg || dto.weight_min_kg) : null,
      weight_max_kg: (dto.weightMaxKg || dto.weight_max_kg) ? parseFloat(dto.weightMaxKg || dto.weight_max_kg) : null,
      lifespan_years: (dto.lifespanYears || dto.lifespan_years)
        ? parseInt(dto.lifespanYears || dto.lifespan_years, 10)
        : null,
      diet: dto.diet || null,
      depth_min_m: (dto.depthMin || dto.depth_min_m) ? parseInt(dto.depthMin || dto.depth_min_m, 10) : null,
      depth_max_m: (dto.depthMax || dto.depth_max_m) ? parseInt(dto.depthMax || dto.depth_max_m, 10) : null,
      temperature_min_c: (dto.tempMinC || dto.temperature_min_c) ? parseFloat(dto.tempMinC || dto.temperature_min_c) : null,
      temperature_max_c: (dto.tempMaxC || dto.temperature_max_c) ? parseFloat(dto.tempMaxC || dto.temperature_max_c) : null,
      model_3d_url: dto.model3dUrl || dto.model_3d_url || null,
      sound_url: dto.soundUrl || dto.sound_url || null,
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

    return speciesRepository.findById(newSpecies.id);
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
    if (sMin !== undefined) dataToUpdate.size_min_cm = sMin ? parseFloat(sMin) : null;

    const sMax = dto.sizeMaxCm !== undefined ? dto.sizeMaxCm : dto.size_max_cm;
    if (sMax !== undefined) dataToUpdate.size_max_cm = sMax ? parseFloat(sMax) : null;

    const wMin = dto.weightMinKg !== undefined ? dto.weightMinKg : dto.weight_min_kg;
    if (wMin !== undefined) dataToUpdate.weight_min_kg = wMin ? parseFloat(wMin) : null;

    const wMax = dto.weightMaxKg !== undefined ? dto.weightMaxKg : dto.weight_max_kg;
    if (wMax !== undefined) dataToUpdate.weight_max_kg = wMax ? parseFloat(wMax) : null;

    const ls = dto.lifespanYears !== undefined ? dto.lifespanYears : dto.lifespan_years;
    if (ls !== undefined) dataToUpdate.lifespan_years = ls ? parseInt(ls, 10) : null;

    if (dto.diet !== undefined) dataToUpdate.diet = dto.diet;

    const dMin = dto.depthMin !== undefined ? dto.depthMin : dto.depth_min_m;
    if (dMin !== undefined) dataToUpdate.depth_min_m = dMin ? parseInt(dMin, 10) : null;

    const dMax = dto.depthMax !== undefined ? dto.depthMax : dto.depth_max_m;
    if (dMax !== undefined) dataToUpdate.depth_max_m = dMax ? parseInt(dMax, 10) : null;

    const tMin = dto.tempMinC !== undefined ? dto.tempMinC : dto.temperature_min_c;
    if (tMin !== undefined) dataToUpdate.temperature_min_c = tMin ? parseFloat(tMin) : null;

    const tMax = dto.tempMaxC !== undefined ? dto.tempMaxC : dto.temperature_max_c;
    if (tMax !== undefined) dataToUpdate.temperature_max_c = tMax ? parseFloat(tMax) : null;

    const m3d = dto.model3dUrl !== undefined ? dto.model3dUrl : dto.model_3d_url;
    if (m3d !== undefined) dataToUpdate.model_3d_url = m3d || null;

    const snd = dto.soundUrl !== undefined ? dto.soundUrl : dto.sound_url;
    if (snd !== undefined) dataToUpdate.sound_url = snd || null;

    if (dto.is_visible !== undefined) dataToUpdate.is_visible = Boolean(dto.is_visible);

    const grp = dto.groupId !== undefined ? dto.groupId : dto.group_id;
    if (grp !== undefined) dataToUpdate.group_id = grp ? BigInt(grp) : null;

    const cons = dto.conservationStatus !== undefined ? dto.conservationStatus : dto.conservation_status_id;
    if (cons !== undefined) {
      const statusMap = { LC: 1, NT: 2, VU: 3, EN: 4, CR: 5, EW: 6, EX: 7, DD: 8, NE: 9 };
      dataToUpdate.conservation_status_id = statusMap[cons] || (cons ? parseInt(cons, 10) : null);
    }

    const zone = dto.oceanZone !== undefined ? dto.oceanZone : dto.ocean_zone_id;
    if (zone !== undefined) {
      const zoneMap = { Sunlight: 1, Twilight: 2, Midnight: 3, Abyssal: 4, Hadal: 5 };
      dataToUpdate.ocean_zone_id = zoneMap[zone] || (zone ? parseInt(zone, 10) : null);
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

    return speciesRepository.findById(id);
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

    // 1. Gọi GBIF Match API
    let gbifData = null;
    try {
      const response = await axios.get(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(cleanName)}`,
      );
      gbifData = response.data;
    } catch (err) {
      console.warn("Lỗi khi kết nối GBIF API:", err.message);
    }

    const matchedName =
      gbifData?.canonicalName || gbifData?.scientificName || cleanName;
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

  /**
   * Lấy trạng thái sức khỏe kết nối 3 API ngoài và danh sách sinh vật bị thiếu dữ liệu/ảnh từ DB
   */
  async getSyncStatus() {
    const checkPing = async (url) => {
      try {
        const start = Date.now();
        await axios.get(url, { timeout: 6000 });
        return {
          status: "ok",
          desc: "Hoạt động bình thường",
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        return {
          status: "error",
          desc: `Lỗi kết nối (${err.message})`,
          latencyMs: null,
        };
      }
    };

    const [gbifStatus, inatStatus, obisStatus, incompleteSpecies] =
      await Promise.all([
        checkPing("https://api.gbif.org/v1/species/match?name=Carcharodon"),
        checkPing("https://api.inaturalist.org/v1/taxa?q=Carcharodon"),
        checkPing(
          "https://api.obis.org/v3/taxon/search?scientificname=Carcharodon",
        ),
        prisma.species.findMany({
          where: {
            deleted_at: null,
            OR: [{ species_media: { none: {} } }, { description: null }],
          },
          take: 10,
          include: {
            species_media: true,
          },
        }),
      ]);

    const apiStatuses = [
      { name: "GBIF API", status: gbifStatus.status, desc: gbifStatus.desc },
      {
        name: "iNaturalist API",
        status: inatStatus.status,
        desc: inatStatus.desc,
      },
      { name: "OBIS API", status: obisStatus.status, desc: obisStatus.desc },
    ];

    const failedSpecies = incompleteSpecies.map((item) => ({
      id: String(item.id),
      name: item.common_name || item.scientificName || `Sinh vật #${item.id}`,
      error:
        item.species_media.length === 0
          ? "Thiếu hình ảnh từ API"
          : "Thiếu thông tin chi tiết",
      image:
        item.species_media?.[0]?.url ||
        "https://images.unsplash.com/photo-1560275619-4662804300e8?auto=format&fit=crop&w=150&q=80",
    }));

    return { apiStatuses, failedSpecies };
  }

  /**
   * Thử lại đồng bộ cho 1 sinh vật theo ID
   */
  async retrySyncItem(id) {
    const target = await speciesRepository.findById(id);
    if (!target) {
      const error = new Error("Không tìm thấy sinh vật");
      error.statusCode = 404;
      throw error;
    }

    const cleanName = target.scientificName || target.common_name || "";
    let gbifData = null;
    try {
      const res = await axios.get(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(cleanName)}`,
      );
      gbifData = res.data;
    } catch {
      // Fallback
    }

    const matchedName = gbifData?.canonicalName || cleanName;
    const desc =
      target.description ||
      `Đã cập nhật tự động từ GBIF API cho loài ${matchedName}.`;

    return speciesRepository.update(id, {
      scientificName: matchedName,
      description: desc,
    });
  }

  /**
   * Đồng bộ tất cả sinh vật còn thiếu dữ liệu
   */
  async syncAllIncomplete() {
    const incomplete = await prisma.species.findMany({
      where: { deleted_at: null },
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
