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
      adminRepository.getRecentActivities(5),
    ]);

    return {
      users: userStats,
      contentAndView: contentStats,
      comments: commentStats,
      recentActivities,
    };
  }
}

export default new AdminService();
