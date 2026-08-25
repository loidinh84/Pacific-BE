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
}

export default new AdminController();
