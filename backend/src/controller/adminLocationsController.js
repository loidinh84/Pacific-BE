import prisma from "../lib/prisma.js";

/**
 * AdminLocationsController - Quản lý địa điểm từ phía Admin
 */
class AdminLocationsController {
  /**
   * GET /api/admin/locations
   * Danh sách địa điểm với phân trang, tìm kiếm, lọc nổi bật
   */
  async getLocationList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const isFeatured = req.query.is_featured; // "true" | "false" | undefined
      const oceanZoneId = req.query.ocean_zone_id;
      const sortBy = req.query.sortBy || "id";
      const order = req.query.order === "desc" ? "desc" : "asc";

      const where = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isFeatured === "true") where.is_featured = true;
      if (isFeatured === "false") where.is_featured = false;

      if (oceanZoneId && oceanZoneId !== "all") {
        where.ocean_zone_id = parseInt(oceanZoneId);
      }

      const validSortFields = ["id", "name", "created_at", "is_featured"];
      const sortField = validSortFields.includes(sortBy) ? sortBy : "id";

      const [total, locations] = await Promise.all([
        prisma.locations.count({ where }),
        prisma.locations.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortField]: order },
          include: {
            ocean_zones: { select: { id: true, name: true } },
            _count: {
              select: {
                species_locations: true,
                user_explored_locations: true,
              },
            },
          },
        }),
      ]);

      const data = locations.map((loc) => ({
        id: loc.id.toString(),
        name: loc.name,
        slug: loc.slug,
        latitude: loc.latitude ? Number(loc.latitude) : null,
        longitude: loc.longitude ? Number(loc.longitude) : null,
        description: loc.description || "",
        imageUrl: loc.image_url || "",
        isFeatured: loc.is_featured,
        oceanZoneId: loc.ocean_zone_id,
        oceanZoneName: loc.ocean_zones?.name || "",
        createdAt: loc.created_at,
        speciesCount: loc._count.species_locations,
        exploredCount: loc._count.user_explored_locations,
      }));

      return res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      console.error("adminLocationsController.getLocationList error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải danh sách địa điểm" });
    }
  }

  /**
   * GET /api/admin/locations/:id
   * Chi tiết 1 địa điểm
   */
  async getLocationById(req, res) {
    try {
      const locationId = BigInt(req.params.id);
      const loc = await prisma.locations.findUnique({
        where: { id: locationId },
        include: {
          ocean_zones: true,
          _count: {
            select: {
              species_locations: true,
              user_explored_locations: true,
            },
          },
          species_locations: {
            take: 8,
            include: {
              species: {
                select: {
                  id: true,
                  code: true,
                  common_name: true,
                  scientificName: true,
                  slug: true,
                  species_media: {
                    where: { is_primary: true },
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!loc) {
        return res.status(404).json({ success: false, error: "Không tìm thấy địa điểm" });
      }

      return res.json({
        success: true,
        location: {
          id: loc.id.toString(),
          name: loc.name,
          slug: loc.slug,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          description: loc.description || "",
          imageUrl: loc.image_url || "",
          isFeatured: loc.is_featured,
          oceanZoneId: loc.ocean_zone_id,
          oceanZoneName: loc.ocean_zones?.name || "",
          createdAt: loc.created_at,
          speciesCount: loc._count.species_locations,
          exploredCount: loc._count.user_explored_locations,
          recentSpecies: loc.species_locations.map((sl) => ({
            id: sl.species.id.toString(),
            code: sl.species.code,
            name: sl.species.common_name,
            scientificName: sl.species.scientificName,
            slug: sl.species.slug,
            image: sl.species.species_media?.[0]?.url || "",
          })),
        },
      });
    } catch (error) {
      console.error("adminLocationsController.getLocationById error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải chi tiết địa điểm" });
    }
  }

  /**
   * POST /api/admin/locations
   * Tạo địa điểm mới
   */
  async createLocation(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const { name, slug, latitude, longitude, description, imageUrl, isFeatured, oceanZoneId } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: "Tên địa điểm không được để trống" });
      }

      // Auto-generate slug if not provided
      const finalSlug = slug?.trim()
        || name.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");

      // Check slug uniqueness
      const existing = await prisma.locations.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        return res.status(400).json({ success: false, error: `Slug "${finalSlug}" đã tồn tại` });
      }

      const loc = await prisma.locations.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          latitude: latitude != null ? parseFloat(latitude) : null,
          longitude: longitude != null ? parseFloat(longitude) : null,
          description: description?.trim() || null,
          image_url: imageUrl?.trim() || null,
          is_featured: Boolean(isFeatured),
          ocean_zone_id: oceanZoneId ? parseInt(oceanZoneId) : null,
        },
        include: {
          ocean_zones: { select: { id: true, name: true } },
          _count: { select: { species_locations: true, user_explored_locations: true } },
        },
      });

      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "CREATE_LOCATION",
            target_type: "LOCATION",
            target_id: loc.id,
            description: `Admin đã tạo địa điểm mới: "${loc.name}"`,
          },
        });
      } catch (_) {}

      return res.status(201).json({
        success: true,
        message: `Đã tạo địa điểm "${loc.name}" thành công!`,
        location: {
          id: loc.id.toString(),
          name: loc.name,
          slug: loc.slug,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          description: loc.description || "",
          imageUrl: loc.image_url || "",
          isFeatured: loc.is_featured,
          oceanZoneId: loc.ocean_zone_id,
          oceanZoneName: loc.ocean_zones?.name || "",
          createdAt: loc.created_at,
          speciesCount: loc._count.species_locations,
          exploredCount: loc._count.user_explored_locations,
        },
      });
    } catch (error) {
      console.error("adminLocationsController.createLocation error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tạo địa điểm" });
    }
  }

  /**
   * PUT /api/admin/locations/:id
   * Cập nhật thông tin địa điểm
   */
  async updateLocation(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const locationId = BigInt(req.params.id);
      const { name, latitude, longitude, description, imageUrl, isFeatured, oceanZoneId } = req.body;

      const existing = await prisma.locations.findUnique({ where: { id: locationId } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Không tìm thấy địa điểm" });
      }

      const updated = await prisma.locations.update({
        where: { id: locationId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(latitude !== undefined && { latitude: latitude != null ? parseFloat(latitude) : null }),
          ...(longitude !== undefined && { longitude: longitude != null ? parseFloat(longitude) : null }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(imageUrl !== undefined && { image_url: imageUrl?.trim() || null }),
          ...(isFeatured !== undefined && { is_featured: Boolean(isFeatured) }),
          ...(oceanZoneId !== undefined && { ocean_zone_id: oceanZoneId ? parseInt(oceanZoneId) : null }),
        },
        include: {
          ocean_zones: { select: { id: true, name: true } },
          _count: { select: { species_locations: true, user_explored_locations: true } },
        },
      });

      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "UPDATE_LOCATION",
            target_type: "LOCATION",
            target_id: locationId,
            description: `Admin đã cập nhật địa điểm: "${updated.name}"`,
          },
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: `Đã cập nhật địa điểm "${updated.name}" thành công!`,
        location: {
          id: updated.id.toString(),
          name: updated.name,
          slug: updated.slug,
          latitude: updated.latitude ? Number(updated.latitude) : null,
          longitude: updated.longitude ? Number(updated.longitude) : null,
          description: updated.description || "",
          imageUrl: updated.image_url || "",
          isFeatured: updated.is_featured,
          oceanZoneId: updated.ocean_zone_id,
          oceanZoneName: updated.ocean_zones?.name || "",
          createdAt: updated.created_at,
          speciesCount: updated._count.species_locations,
          exploredCount: updated._count.user_explored_locations,
        },
      });
    } catch (error) {
      console.error("adminLocationsController.updateLocation error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi cập nhật địa điểm" });
    }
  }

  /**
   * DELETE /api/admin/locations/:id
   * Xóa địa điểm (hard delete - sẽ cascade xóa species_locations và user_explored_locations)
   */
  async deleteLocation(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const locationId = BigInt(req.params.id);

      const loc = await prisma.locations.findUnique({ where: { id: locationId } });
      if (!loc) {
        return res.status(404).json({ success: false, error: "Không tìm thấy địa điểm" });
      }

      await prisma.locations.delete({ where: { id: locationId } });

      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "DELETE_LOCATION",
            target_type: "LOCATION",
            target_id: locationId,
            description: `Admin đã xóa địa điểm: "${loc.name}"`,
          },
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: `Đã xóa địa điểm "${loc.name}" thành công!`,
      });
    } catch (error) {
      console.error("adminLocationsController.deleteLocation error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi xóa địa điểm" });
    }
  }

  /**
   * PATCH /api/admin/locations/:id/featured
   * Bật/tắt trạng thái nổi bật
   */
  async toggleFeatured(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const locationId = BigInt(req.params.id);

      const loc = await prisma.locations.findUnique({ where: { id: locationId } });
      if (!loc) {
        return res.status(404).json({ success: false, error: "Không tìm thấy địa điểm" });
      }

      const newFeatured = !loc.is_featured;
      await prisma.locations.update({
        where: { id: locationId },
        data: { is_featured: newFeatured },
      });

      return res.json({
        success: true,
        message: newFeatured
          ? `Đã đánh dấu "${loc.name}" là địa điểm nổi bật`
          : `Đã bỏ đánh dấu nổi bật cho "${loc.name}"`,
        isFeatured: newFeatured,
      });
    } catch (error) {
      console.error("adminLocationsController.toggleFeatured error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi cập nhật trạng thái nổi bật" });
    }
  }
}

export default new AdminLocationsController();
