import prisma from "../lib/prisma.js";

/**
 * AdminRepository - Tầng truy vấn dữ liệu (Data Access Layer) cho Admin
 */
export class AdminRepository {
  /**
   * Thống kê số lượng người dùng theo trạng thái & % tăng trưởng so với tuần trước
   */
  async getUserStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      lockedUsers,
      usersThisWeek,
      usersLastWeek,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { status: "locked" } }),
      prisma.user.count({ where: { created_at: { gte: sevenDaysAgo } } }),
      prisma.user.count({
        where: {
          created_at: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);

    const userGrowth =
      usersLastWeek === 0
        ? usersThisWeek > 0
          ? 100
          : 0
        : Math.round(((usersThisWeek - usersLastWeek) / usersLastWeek) * 100);

    return {
      totalUsers,
      activeUsers,
      pendingUsers,
      lockedUsers,
      userGrowth,
    };
  }

  /**
   * Thống kê nội dung sinh vật, lượt xem, tìm kiếm, yêu thích & tăng trưởng
   */
  async getContentStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalSpecies,
      totalViews,
      totalSearches,
      totalFavorites,
      viewsThisWeek,
      viewsLastWeek,
    ] = await Promise.all([
      prisma.species.count({ where: { deleted_at: null } }),
      prisma.species_views.count(),
      prisma.search_logs.count(),
      prisma.favorites.count(),
      prisma.species_views.count({ where: { viewed_at: { gte: sevenDaysAgo } } }),
      prisma.species_views.count({
        where: { viewed_at: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
    ]);

    const viewGrowth =
      viewsLastWeek === 0
        ? viewsThisWeek > 0
          ? 100
          : 0
        : Math.round(((viewsThisWeek - viewsLastWeek) / viewsLastWeek) * 100);

    return {
      totalSpecies,
      totalViews,
      totalSearches,
      totalFavorites,
      viewGrowth,
    };
  }

  /**
   * Thống kê bình luận và báo cáo vi phạm
   */
  async getCommentStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalComments,
      reportedComments,
      todayComments,
      deletedComments,
    ] = await Promise.all([
      prisma.comments.count({ where: { deleted_at: null } }),
      prisma.comment_reports.count({ where: { status: "pending" } }),
      prisma.comments.count({
        where: {
          created_at: { gte: startOfToday },
          deleted_at: null,
        },
      }),
      prisma.comments.count({ where: { deleted_at: { not: null } } }),
    ]);

    return {
      totalComments,
      reportedComments,
      todayComments,
      deletedComments,
    };
  }

  /**
   * Lấy dữ liệu biểu đồ lượt xem và người dùng mới theo ngày
   */
  async getChartStats(days = 7) {
    const safeDays = Math.min(Math.max(Number(days) || 7, 7), 90);
    const offsetDays = safeDays - 1;

    const [viewsByDay, usersByDay] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
          TO_CHAR(d.day, 'DD/MM') AS label,
          COUNT(sv.id)::int AS count
        FROM generate_series(
          CURRENT_DATE - (${offsetDays} || ' days')::interval,
          CURRENT_DATE,
          '1 day'::interval
        ) d(day)
        LEFT JOIN species_views sv 
          ON DATE(sv.viewed_at) = DATE(d.day)
        GROUP BY d.day
        ORDER BY d.day ASC;
      `,
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
          TO_CHAR(d.day, 'DD/MM') AS label,
          COUNT(u.id)::int AS count
        FROM generate_series(
          CURRENT_DATE - (${offsetDays} || ' days')::interval,
          CURRENT_DATE,
          '1 day'::interval
        ) d(day)
        LEFT JOIN users u 
          ON DATE(u.created_at) = DATE(d.day)
        GROUP BY d.day
        ORDER BY d.day ASC;
      `,
    ]);

    return {
      viewsByDay,
      usersByDay,
    };
  }

  /**
   * Top 5 sinh vật xem nhiều nhất
   */
  async getTopViewedSpecies(limit = 5) {
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const top = await prisma.$queryRaw`
      SELECT 
        s.id::text AS id,
        s.code,
        s.common_name AS "commonName",
        s.scientific_name AS "scientificName",
        s.slug,
        COUNT(sv.id)::int AS "viewCount",
        oz.name AS "oceanZoneName",
        (
          SELECT sm.url FROM species_media sm 
          WHERE sm.species_id = s.id 
          ORDER BY sm.is_primary DESC, sm.sort_order ASC 
          LIMIT 1
        ) AS "imageUrl"
      FROM species s
      JOIN species_views sv ON s.id = sv.species_id
      LEFT JOIN ocean_zones oz ON s.ocean_zone_id = oz.id
      WHERE s.deleted_at IS NULL
      GROUP BY s.id, s.code, s.common_name, s.scientific_name, s.slug, oz.name
      ORDER BY "viewCount" DESC
      LIMIT ${safeLimit};
    `;
    return top;
  }

  /**
   * Phân bố sinh vật theo tầng đại dương
   */
  async getSpeciesByOceanZone() {
    const zones = await prisma.$queryRaw`
      SELECT 
        oz.id,
        oz.name,
        oz.depth_min_m AS "depthMin",
        oz.depth_max_m AS "depthMax",
        COUNT(s.id)::int AS "speciesCount"
      FROM ocean_zones oz
      LEFT JOIN species s ON oz.id = s.ocean_zone_id AND s.deleted_at IS NULL
      GROUP BY oz.id, oz.name, oz.depth_min_m, oz.depth_max_m
      ORDER BY oz.id ASC;
    `;
    return zones;
  }

  /**
   * Top 5 người dùng tích cực nhất
   */
  async getTopActiveUsers(limit = 5) {
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const users = await prisma.$queryRaw`
      SELECT 
        u.id::text AS id,
        u.username,
        u.full_name AS "fullName",
        u.email,
        u.avatar_url AS "avatarUrl",
        COUNT(sv.id)::int AS "viewCount",
        (
          SELECT COUNT(*)::int FROM comments c 
          WHERE c.user_id = u.id AND c.deleted_at IS NULL
        ) AS "commentCount"
      FROM users u
      JOIN species_views sv ON u.id = sv.user_id
      GROUP BY u.id, u.username, u.full_name, u.email, u.avatar_url
      ORDER BY "viewCount" DESC
      LIMIT ${safeLimit};
    `;
    return users;
  }

  /**
   * Lấy danh sách hoạt động gần đây
   */
  async getRecentActivities(limit = 6) {
    const logs = await prisma.activity_logs.findMany({
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

    return logs.map((log) => ({
      id: log.id.toString(),
      action: log.action,
      targetType: log.target_type,
      targetId: log.target_id ? log.target_id.toString() : null,
      description: log.description,
      createdAt: log.created_at,
      user: log.users
        ? {
            id: log.users.id.toString(),
            username: log.users.username,
            email: log.users.email,
            avatarUrl: log.users.avatar_url,
          }
        : null,
    }));
  }
}

export default new AdminRepository();
