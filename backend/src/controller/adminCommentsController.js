import prisma from "../lib/prisma.js";

/**
 * AdminCommentsController - Quản lý & kiểm duyệt bình luận
 */
class AdminCommentsController {
  /**
   * GET /api/admin/comments
   * Lấy danh sách bình luận kèm phân trang, tìm kiếm, lọc theo tab
   */
  async getCommentsList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
      const skip = (page - 1) * limit;
      const tab = req.query.tab || "all";
      const search = (req.query.search || "").trim();
      const speciesId = req.query.speciesId ? BigInt(req.query.speciesId) : undefined;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Xây dựng điều kiện lọc theo tab
      const where = {};

      if (speciesId) {
        where.species_id = speciesId;
      }

      if (tab === "deleted") {
        where.deleted_at = { not: null };
      } else if (tab === "reported") {
        where.deleted_at = null;
        where.comment_reports = { some: { status: "pending" } };
      } else if (tab === "today") {
        where.deleted_at = null;
        where.created_at = { gte: startOfToday };
      } else {
        // Tab "all"
        where.deleted_at = null;
      }

      // Tìm kiếm từ khóa (nội dung, tên người dùng, tên sinh vật)
      if (search) {
        const searchConditions = [
          { content: { contains: search, mode: "insensitive" } },
          { users: { full_name: { contains: search, mode: "insensitive" } } },
          { users: { username: { contains: search, mode: "insensitive" } } },
          { species: { common_name: { contains: search, mode: "insensitive" } } },
        ];

        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: searchConditions },
          ];
          delete where.OR;
        } else {
          where.OR = searchConditions;
        }
      }

      // Lấy dữ liệu danh sách + tổng số lượng + thống kê số lượng từng tab
      const [total, comments, allCount, reportedCount, deletedCount, todayCount] = await Promise.all([
        prisma.comments.count({ where }),
        prisma.comments.findMany({
          where,
          skip,
          take: limit,
          orderBy: tab === "deleted" ? { deleted_at: "desc" } : { created_at: "desc" },
          include: {
            users: {
              select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                avatar_url: true,
                role: true,
              },
            },
            species: {
              select: {
                id: true,
                code: true,
                common_name: true,
                scientificName: true,
                slug: true,
              },
            },
            comment_reports: {
              orderBy: { created_at: "desc" },
              include: {
                users: {
                  select: {
                    id: true,
                    username: true,
                    full_name: true,
                  },
                },
              },
            },
          },
        }),
        // Đếm badge tab: Tất cả
        prisma.comments.count({ where: { deleted_at: null } }),
        // Đếm badge tab: Bị báo cáo (chỉ đếm các bình luận có báo cáo đang chờ duyệt)
        prisma.comments.count({
          where: {
            deleted_at: null,
            comment_reports: { some: { status: "pending" } },
          },
        }),
        // Đếm badge tab: Đã xóa
        prisma.comments.count({ where: { deleted_at: { not: null } } }),
        // Đếm badge tab: Hôm nay
        prisma.comments.count({
          where: {
            deleted_at: null,
            created_at: { gte: startOfToday },
          },
        }),
      ]);

      const data = comments.map((c) => {
        const pendingReports = c.comment_reports.filter((r) => r.status === "pending");
        const dismissedReports = c.comment_reports.filter((r) => r.status === "dismissed");

        // Chỉ gom lý do báo cáo của các báo cáo CHỜ DUYỆT (pending)
        const reportReasonMap = {};
        pendingReports.forEach((r) => {
          const reason = r.reason || "Bình luận vi phạm tiêu chuẩn cộng đồng";
          reportReasonMap[reason] = (reportReasonMap[reason] || 0) + 1;
        });

        const reportSummaries = Object.entries(reportReasonMap).map(([reason, count]) => ({
          reason,
          count,
        }));

        const hasPendingReports = pendingReports.length > 0;
        const isDismissed = !hasPendingReports && dismissedReports.length > 0;

        return {
          id: c.id.toString(),
          content: c.content,
          status: c.status,
          reportCount: pendingReports.length,
          hasPendingReports,
          isDismissed,
          dismissedCount: dismissedReports.length,
          reportSummaries,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          deletedAt: c.deleted_at,
          user: c.users
            ? {
                id: c.users.id.toString(),
                username: c.users.username,
                fullName: c.users.full_name || c.users.username,
                email: c.users.email,
                avatarUrl: c.users.avatar_url || "",
                role: c.users.role,
              }
            : null,
          species: c.species
            ? {
                id: c.species.id.toString(),
                code: c.species.code,
                commonName: c.species.common_name,
                scientificName: c.species.scientificName,
                slug: c.species.slug,
              }
            : null,
          reports: c.comment_reports.map((r) => ({
            id: r.id.toString(),
            reason: r.reason || "",
            status: r.status,
            createdAt: r.created_at,
            reporter: r.users
              ? {
                  id: r.users.id.toString(),
                  username: r.users.username,
                  fullName: r.users.full_name || r.users.username,
                }
              : null,
          })),
          reportSummaries,
        };
      });

      return res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        counts: {
          all: allCount,
          reported: reportedCount,
          deleted: deletedCount,
          today: todayCount,
        },
      });
    } catch (error) {
      console.error("adminCommentsController.getCommentsList error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải danh sách bình luận" });
    }
  }

  /**
   * DELETE /api/admin/comments/:id
   * Xóa mềm bình luận (chuyển vào thùng rác)
   */
  async deleteComment(req, res) {
    try {
      const commentId = BigInt(req.params.id);

      const existing = await prisma.comments.findUnique({
        where: { id: commentId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Không tìm thấy bình luận" });
      }

      await prisma.$transaction([
        prisma.comments.update({
          where: { id: commentId },
          data: {
            deleted_at: new Date(),
            status: "deleted",
            report_count: 0,
          },
        }),
        // Đánh dấu các báo cáo chưa xử lý là đã duyệt (reviewed)
        prisma.comment_reports.updateMany({
          where: { comment_id: commentId, status: "pending" },
          data: { status: "reviewed" },
        }),
      ]);

      return res.json({
        success: true,
        message: "Đã xóa bình luận thành công",
      });
    } catch (error) {
      console.error("adminCommentsController.deleteComment error:", error);
      return res.status(500).json({ success: false, error: "Không thể xóa bình luận" });
    }
  }

  /**
   * PATCH /api/admin/comments/:id/restore
   * Khôi phục bình luận đã xóa
   */
  async restoreComment(req, res) {
    try {
      const commentId = BigInt(req.params.id);

      const existing = await prisma.comments.findUnique({
        where: { id: commentId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Không tìm thấy bình luận" });
      }

      await prisma.comments.update({
        where: { id: commentId },
        data: {
          deleted_at: null,
          status: "visible",
        },
      });

      return res.json({
        success: true,
        message: "Đã khôi phục bình luận thành công",
      });
    } catch (error) {
      console.error("adminCommentsController.restoreComment error:", error);
      return res.status(500).json({ success: false, error: "Không thể khôi phục bình luận" });
    }
  }

  /**
   * POST /api/admin/comments/:id/reports/dismiss
   * Bác bỏ báo cáo vi phạm — Giữ bình luận
   */
  async dismissReports(req, res) {
    try {
      const commentId = BigInt(req.params.id);

      const existing = await prisma.comments.findUnique({
        where: { id: commentId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Không tìm thấy bình luận" });
      }

      await prisma.$transaction([
        prisma.comment_reports.updateMany({
          where: { comment_id: commentId, status: "pending" },
          data: { status: "dismissed" },
        }),
        prisma.comments.update({
          where: { id: commentId },
          data: {
            report_count: 0,
            status: "visible",
          },
        }),
      ]);

      return res.json({
        success: true,
        message: "Đã giữ bình luận và bác bỏ các báo cáo vi phạm",
      });
    } catch (error) {
      console.error("adminCommentsController.dismissReports error:", error);
      return res.status(500).json({ success: false, error: "Không thể xử lý yêu cầu giữ bình luận" });
    }
  }

  /**
   * PATCH /api/admin/comments/:id/toggle-hide
   * Tạm ẩn hoặc hiển thị lại bình luận
   */
  async toggleHide(req, res) {
    try {
      const commentId = BigInt(req.params.id);

      const existing = await prisma.comments.findUnique({
        where: { id: commentId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Không tìm thấy bình luận" });
      }

      const nextStatus = existing.status === "hidden" ? "visible" : "hidden";

      await prisma.comments.update({
        where: { id: commentId },
        data: { status: nextStatus },
      });

      return res.json({
        success: true,
        status: nextStatus,
        message: nextStatus === "hidden" ? "Đã tạm ẩn bình luận" : "Đã hiển thị lại bình luận",
      });
    } catch (error) {
      console.error("adminCommentsController.toggleHide error:", error);
      return res.status(500).json({ success: false, error: "Không thể thay đổi trạng thái ẩn/hiện" });
    }
  }

  /**
   * DELETE /api/admin/comments/:id/permanent
   * Xóa vĩnh viễn khỏi cơ sở dữ liệu
   */
  async permanentDeleteComment(req, res) {
    try {
      const commentId = BigInt(req.params.id);

      await prisma.comments.delete({
        where: { id: commentId },
      });

      return res.json({
        success: true,
        message: "Đã xóa vĩnh viễn bình luận khỏi hệ thống",
      });
    } catch (error) {
      console.error("adminCommentsController.permanentDeleteComment error:", error);
      return res.status(500).json({ success: false, error: "Không thể xóa vĩnh viễn bình luận" });
    }
  }
}

export default new AdminCommentsController();
