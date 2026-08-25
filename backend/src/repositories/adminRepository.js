import prisma from "../lib/prisma.js";

/**
 * AdminRepository - Tầng truy vấn dữ liệu (Data Access Layer) cho Admin
 */
export class AdminRepository {
  /**
   * Thống kê số lượng người dùng theo trạng thái
   */
  async getUserStats() {
    const [totalUsers, activeUsers, pendingUsers, lockedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { status: "locked" } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      pendingUsers,
      lockedUsers,
    };
  }

  /**
   * Thống kê nội dung sinh vật, lượt xem và tìm kiếm
   */
  async getContentStats() {
    const [totalSpecies, totalViews, totalSearches] = await Promise.all([
      prisma.species.count({ where: { deleted_at: null } }),
      prisma.species_views.count(),
      prisma.search_logs.count(),
    ]);

    return {
      totalSpecies,
      totalViews,
      totalSearches,
    };
  }

  /**
   * Thống kê bình luận và báo cáo vi phạm
   */
  async getCommentStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalComments, reportedComments, todayComments] = await Promise.all([
      prisma.comments.count({ where: { deleted_at: null } }),
      prisma.comment_reports.count({ where: { status: "pending" } }),
      prisma.comments.count({
        where: {
          created_at: { gte: startOfToday },
          deleted_at: null,
        },
      }),
    ]);

    return {
      totalComments,
      reportedComments,
      todayComments,
    };
  }

  /**
   * Lấy danh sách hoạt động gần đây
   */
  async getRecentActivities(limit = 5) {
    return prisma.activity_logs.findMany({
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });
  }
}

export default new AdminRepository();
