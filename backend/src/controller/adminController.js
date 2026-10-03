import adminService from "../services/adminService.js";

/**
 * AdminController - Tầng tiếp nhận & phản hồi HTTP (Controller Layer) cho Admin
 */
export class AdminController {
  /**
   * GET /api/admin/stats/overview
   * Lấy số liệu tổng quan cho dashboard admin
   */
  async getOverviewStats(req, res) {
    try {
      const stats = await adminService.getOverviewStats();
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Lỗi khi lấy số liệu thống kê overview admin:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi truy vấn dữ liệu thống kê tổng quan",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/admin/stats/charts?days=7
   * Lấy dữ liệu biểu đồ lượt xem và người dùng theo ngày
   */
  async getChartStats(req, res) {
    try {
      const days = parseInt(req.query.days, 10) || 7;
      const charts = await adminService.getChartStats(days);
      return res.status(200).json({
        success: true,
        data: charts,
      });
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu biểu đồ admin:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi truy vấn dữ liệu biểu đồ",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/admin/stats/rankings
   * Lấy bảng xếp hạng top sinh vật, tầng đại dương, người dùng hoạt động
   */
  async getRankingsStats(req, res) {
    try {
      const rankings = await adminService.getRankingsStats();
      return res.status(200).json({
        success: true,
        data: rankings,
      });
    } catch (error) {
      console.error("Lỗi khi lấy bảng xếp hạng admin:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi truy vấn dữ liệu bảng xếp hạng",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/admin/stats/full?days=7
   * Lấy toàn bộ dữ liệu Dashboard một lần duy nhất
   */
  async getFullDashboard(req, res) {
    try {
      const days = parseInt(req.query.days, 10) || 7;
      const full = await adminService.getFullDashboardData(days);
      return res.status(200).json({
        success: true,
        data: full,
      });
    } catch (error) {
      console.error("Lỗi khi lấy toàn bộ dữ liệu dashboard admin:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi truy vấn toàn bộ dữ liệu dashboard",
        error: error.message,
      });
    }
  }
}

export default new AdminController();
