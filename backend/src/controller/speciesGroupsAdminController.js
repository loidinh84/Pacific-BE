import prisma from "../lib/prisma.js";

// Helper chuyển đổi tiếng Việt có dấu thành slug URL thân thiện
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export class SpeciesGroupsAdminController {
  /**
   * GET /api/admin/species-groups
   * Lấy danh sách tất cả các nhóm sinh vật kèm số lượng sinh vật
   * Query params: page, limit, search
   */
  async getSpeciesGroups(req, res) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const search = req.query.search ? req.query.search.trim() : "";
      const skip = (page - 1) * limit;

      const whereClause = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {};

      const [total, groups] = await Promise.all([
        prisma.species_groups.count({ where: whereClause }),
        prisma.species_groups.findMany({
          where: whereClause,
          skip: req.query.page ? skip : undefined,
          take: req.query.limit ? limit : undefined,
          orderBy: { id: "asc" },
          include: {
            _count: {
              select: {
                species: {
                  where: { deleted_at: null },
                },
              },
            },
          },
        }),
      ]);

      const formattedGroups = groups.map((g) => {
        let color = "#3b82f6";
        let is_visible = true;

        if (g.image_url && g.image_url.startsWith("metadata:")) {
          try {
            const meta = JSON.parse(g.image_url.replace("metadata:", ""));
            if (meta.color) color = meta.color;
            if (typeof meta.is_visible === "boolean") is_visible = meta.is_visible;
          } catch (e) {
            // fallback
          }
        }

        return {
          id: g.id.toString(),
          name: g.name,
          slug: g.slug,
          description: g.description || "",
          image_url: g.image_url && !g.image_url.startsWith("metadata:") ? g.image_url : "",
          color,
          is_visible,
          creatureCount: g._count?.species || 0,
          created_at: g.created_at,
        };
      });

      return res.status(200).json({
        success: true,
        groups: formattedGroups,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách nhóm sinh vật:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi tải danh sách nhóm sinh vật",
      });
    }
  }

  /**
   * POST /api/admin/species-groups
   * Tạo nhóm sinh vật mới
   * Body: { name, description, color, is_visible }
   */
  async createSpeciesGroup(req, res) {
    try {
      const { name, description, color = "#3b82f6", is_visible = true } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          error: "Tên nhóm là bắt buộc và phải từ 2 đến 50 ký tự",
        });
      }

      if (description && typeof description === "string" && description.length > 500) {
        return res.status(400).json({
          success: false,
          error: "Mô tả không được vượt quá 500 ký tự",
        });
      }

      const trimmedName = name.trim();

      const existing = await prisma.species_groups.findFirst({
        where: {
          name: { equals: trimmedName, mode: "insensitive" },
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Tên nhóm "${trimmedName}" đã tồn tại trên hệ thống`,
        });
      }

      let baseSlug = slugify(trimmedName);
      if (!baseSlug) baseSlug = `group-${Date.now()}`;
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (await prisma.species_groups.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      const metaString = `metadata:${JSON.stringify({ color, is_visible })}`;

      const newGroup = await prisma.species_groups.create({
        data: {
          name: trimmedName,
          slug: uniqueSlug,
          description: description ? description.trim() : null,
          image_url: metaString,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Tạo nhóm sinh vật thành công",
        group: {
          id: newGroup.id.toString(),
          name: newGroup.name,
          slug: newGroup.slug,
          description: newGroup.description || "",
          color,
          is_visible,
          creatureCount: 0,
          created_at: newGroup.created_at,
        },
      });
    } catch (error) {
      console.error("Lỗi khi tạo nhóm sinh vật:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi tạo nhóm sinh vật",
      });
    }
  }

  /**
   * PUT /api/admin/species-groups/:id
   * Cập nhật thông tin nhóm sinh vật
   * Body: { name, description, color, is_visible }
   */
  async updateSpeciesGroup(req, res) {
    try {
      const groupId = BigInt(req.params.id);
      const { name, description, color, is_visible } = req.body;

      const group = await prisma.species_groups.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy nhóm sinh vật này",
        });
      }

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
          return res.status(400).json({
            success: false,
            error: "Tên nhóm phải từ 2 đến 50 ký tự",
          });
        }

        const trimmedName = name.trim();
        const existing = await prisma.species_groups.findFirst({
          where: {
            name: { equals: trimmedName, mode: "insensitive" },
            id: { not: groupId },
          },
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            error: `Tên nhóm "${trimmedName}" đã được sử dụng bởi nhóm khác`,
          });
        }
      }

      if (description !== undefined && typeof description === "string" && description.length > 500) {
        return res.status(400).json({
          success: false,
          error: "Mô tả không được vượt quá 500 ký tự",
        });
      }

      let currentMeta = { color: "#3b82f6", is_visible: true };
      if (group.image_url && group.image_url.startsWith("metadata:")) {
        try {
          currentMeta = JSON.parse(group.image_url.replace("metadata:", ""));
        } catch (e) {}
      }

      const updatedColor = color !== undefined ? color : currentMeta.color;
      const updatedVisible = is_visible !== undefined ? is_visible : currentMeta.is_visible;
      const newMetaString = `metadata:${JSON.stringify({ color: updatedColor, is_visible: updatedVisible })}`;

      const updated = await prisma.species_groups.update({
        where: { id: groupId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description.trim() }),
          image_url: newMetaString,
        },
        include: {
          _count: {
            select: { species: { where: { deleted_at: null } } },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Cập nhật nhóm sinh vật thành công",
        group: {
          id: updated.id.toString(),
          name: updated.name,
          slug: updated.slug,
          description: updated.description || "",
          color: updatedColor,
          is_visible: updatedVisible,
          creatureCount: updated._count?.species || 0,
        },
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật nhóm sinh vật:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi cập nhật nhóm sinh vật",
      });
    }
  }

  /**
   * DELETE /api/admin/species-groups/:id
   * Xóa nhóm sinh vật (Tự động gỡ liên kết với các sinh vật, không xóa sinh vật)
   */
  async deleteSpeciesGroup(req, res) {
    try {
      const groupId = BigInt(req.params.id);

      const group = await prisma.species_groups.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy nhóm sinh vật cần xóa",
        });
      }

      await prisma.species.updateMany({
        where: { group_id: groupId },
        data: { group_id: null },
      });

      await prisma.species_groups.delete({
        where: { id: groupId },
      });

      return res.status(200).json({
        success: true,
        message: "Đã xóa nhóm sinh vật thành công",
      });
    } catch (error) {
      console.error("Lỗi khi xóa nhóm sinh vật:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi xóa nhóm sinh vật",
      });
    }
  }

  /**
   * POST /api/admin/species-groups/:id/species
   * Gán & đồng bộ danh sách sinh vật vào nhóm
   * Body: { speciesIds: [id1, id2, ...] }
   */
  async assignSpeciesToGroup(req, res) {
    try {
      const groupId = BigInt(req.params.id);
      const { speciesIds } = req.body;

      if (!Array.isArray(speciesIds)) {
        return res.status(400).json({
          success: false,
          error: "speciesIds phải là một mảng danh sách ID sinh vật",
        });
      }

      const group = await prisma.species_groups.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          error: "Nhóm sinh vật không tồn tại",
        });
      }

      const bigIntIds = speciesIds.map((id) => BigInt(id));

      // 1. Gỡ bỏ những sinh vật trước đây thuộc nhóm nhưng hiện tại không có trong danh sách được chọn
      await prisma.species.updateMany({
        where: {
          group_id: groupId,
          id: { notIn: bigIntIds },
        },
        data: {
          group_id: null,
        },
      });

      // 2. Gán những sinh vật được chọn vào nhóm này
      const result = await prisma.species.updateMany({
        where: {
          id: { in: bigIntIds },
        },
        data: {
          group_id: groupId,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Đã cập nhật thành công ${result.count} sinh vật vào nhóm`,
        updatedCount: result.count,
      });
    } catch (error) {
      console.error("Lỗi khi gán sinh vật vào nhóm:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi gán sinh vật vào nhóm",
      });
    }
  }

  /**
   * DELETE /api/admin/species-groups/:id/species/:speciesId
   * Gỡ bỏ 1 sinh vật ra khỏi nhóm
   */
  async removeSpeciesFromGroup(req, res) {
    try {
      const groupId = BigInt(req.params.id);
      const speciesId = BigInt(req.params.speciesId);

      const result = await prisma.species.updateMany({
        where: {
          id: speciesId,
          group_id: groupId,
        },
        data: {
          group_id: null,
        },
      });

      if (result.count === 0) {
        return res.status(404).json({
          success: false,
          error: "Sinh vật không thuộc nhóm này hoặc không tìm thấy",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Đã gỡ sinh vật ra khỏi nhóm thành công",
      });
    } catch (error) {
      console.error("Lỗi khi gỡ sinh vật khỏi nhóm:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi gỡ sinh vật",
      });
    }
  }

  /**
   * GET /api/admin/species-groups/:id/species
   * Lấy danh sách sinh vật thuộc 1 nhóm cụ thể
   */
  async getGroupSpecies(req, res) {
    try {
      const groupId = BigInt(req.params.id);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
      const search = req.query.search ? req.query.search.trim() : "";
      const skip = (page - 1) * limit;

      const whereClause = {
        group_id: groupId,
        deleted_at: null,
        ...(search && {
          OR: [
            { common_name: { contains: search, mode: "insensitive" } },
            { scientificName: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [total, speciesList] = await Promise.all([
        prisma.species.count({ where: whereClause }),
        prisma.species.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { id: "asc" },
          include: {
            species_media: {
              where: { is_primary: true },
              take: 1,
            },
          },
        }),
      ]);

      const formattedSpecies = speciesList.map((sp) => ({
        id: sp.id.toString(),
        code: sp.code,
        name: sp.common_name || sp.scientificName,
        scientificName: sp.scientificName,
        slug: sp.slug,
        image: sp.species_media?.[0]?.url || "/assets/default_creature.png",
      }));

      return res.status(200).json({
        success: true,
        species: formattedSpecies,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách sinh vật của nhóm:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Lỗi hệ thống khi lấy sinh vật của nhóm",
      });
    }
  }
}

export default new SpeciesGroupsAdminController();
