import adminRepository from "../repositories/adminRepository.js";

/**
 * AdminService - Tầng xử lý nghiệp vụ (Business Logic Layer) cho Admin
 */
export class AdminService {
  /**
   * Lấy tổng quan các số liệu thống kê cho Dashboard Admin
   */
  async getOverviewStats() {
    const [userStats, contentStats, commentStats, recentActivities] = await Promise.all([
      adminRepository.getUserStats(),
      adminRepository.getContentStats(),
      adminRepository.getCommentStats(),
      adminRepository.getRecentActivities(6),
    ]);

    return {
      users: userStats,
      contentAndView: contentStats,
      comments: commentStats,
      recentActivities,
    };
  }

  /**
   * Lấy dữ liệu biểu đồ lượt xem và người dùng mới theo ngày
   */
  async getChartStats(days = 7) {
    return adminRepository.getChartStats(days);
  }

  /**
   * Lấy các bảng xếp hạng & phân bố
   */
  async getRankingsStats() {
    const [topSpecies, speciesByZone, topUsers] = await Promise.all([
      adminRepository.getTopViewedSpecies(5),
      adminRepository.getSpeciesByOceanZone(),
      adminRepository.getTopActiveUsers(5),
    ]);

    return {
      topSpecies,
      speciesByZone,
      topUsers,
    };
  }

  /**
   * Lấy toàn bộ dữ liệu Dashboard trong 1 request (tối ưu tải trang)
   */
  async getFullDashboardData(days = 7) {
    const [overview, charts, rankings] = await Promise.all([
      this.getOverviewStats(),
      this.getChartStats(days),
      this.getRankingsStats(),
    ]);

    return {
      ...overview,
      charts,
      rankings,
    };
  }
}

export default new AdminService();
