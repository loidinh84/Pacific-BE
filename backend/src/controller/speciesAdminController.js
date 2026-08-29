import speciesService from "../services/speciesService.js";


export class SpeciesAdminController {
  /**
   * GET /api/admin/species
   * Lấy danh sách tất cả sinh vật kèm bộ lọc và phân trang
   */
  async getSpeciesList(req, res) {
    try {
      const result = await speciesService.getSpeciesList(req.query);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách sinh vật:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi lấy danh sách sinh vật",
      });
    }
  }

  /**
   * GET /api/admin/species/:id
   * Lấy chi tiết 1 sinh vật
   */
  async getSpeciesById(req, res) {
    try {
      const species = await speciesService.getSpeciesById(req.params.id);
      return res.status(200).json({
        success: true,
        data: species,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi lấy chi tiết sinh vật",
      });
    }
  }

  /**
   * POST /api/admin/species
   * Thêm sinh vật mới
   */
  async createSpecies(req, res) {
    try {
      const newSpecies = await speciesService.createSpecies(req.body);
      return res.status(201).json({
        success: true,
        message: `Thêm sinh vật thành công với mã ${newSpecies.code}`,
        data: newSpecies,
      });
    } catch (error) {
      console.error("Lỗi khi thêm sinh vật:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi thêm sinh vật mới",
      });
    }
  }

  /**
   * PUT /api/admin/species/:id
   * Cập nhật thông tin sinh vật
   */
  async updateSpecies(req, res) {
    try {
      const updatedSpecies = await speciesService.updateSpecies(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: "Cập nhật sinh vật thành công",
        data: updatedSpecies,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật sinh vật:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi cập nhật sinh vật",
      });
    }
  }

  /**
   * PATCH /api/admin/species/:id/visibility
   * Bật / Tắt trạng thái hiển thị
   */
  async toggleVisibility(req, res) {
    try {
      const { is_visible } = req.body;
      const updatedSpecies = await speciesService.toggleVisibility(req.params.id, is_visible);
      return res.status(200).json({
        success: true,
        message: `Đã ${updatedSpecies.is_visible ? "hiển thị" : "ẩn"} sinh vật ${updatedSpecies.code}`,
        data: updatedSpecies,
      });
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái ẩn/hiện:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi thay đổi trạng thái ẩn/hiện sinh vật",
      });
    }
  }

  /**
   * DELETE /api/admin/species/:id
   * Xóa mềm sinh vật
   */
  async deleteSpecies(req, res) {
    try {
      const deletedSpecies = await speciesService.deleteSpecies(req.params.id);
      return res.status(200).json({
        success: true,
        message: `Đã xóa mềm sinh vật ${deletedSpecies.code} thành công`,
        data: deletedSpecies,
      });
    } catch (error) {
      console.error("Lỗi khi xóa sinh vật:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi xóa sinh vật",
      });
    }
  }

  /**
   * POST /api/admin/species/sync
   * Đồng bộ tự động từ GBIF/iNaturalist API theo tên khoa học
   */
  async syncFromExternalAPI(req, res) {
    try {
      const syncedSpecies = await speciesService.syncFromExternalAPI(req.body);
      return res.status(201).json({
        success: true,
        message: `Đồng bộ dữ liệu thành công cho loài ${syncedSpecies.scientificName}`,
        data: syncedSpecies,
      });
    } catch (error) {
      console.error("Lỗi khi đồng bộ từ API bên ngoài:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi đồng bộ sinh vật từ API",
      });
    }
  }

  /**
   * GET /api/admin/species/sync-status
   * Lấy trạng thái sức khỏe API và sinh vật chưa hoàn thiện từ DB
   */
  async getSyncStatus(req, res) {
    try {
      const data = await speciesService.getSyncStatus();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Lỗi khi kiểm tra trạng thái API:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể kiểm tra trạng thái API đồng bộ",
      });
    }
  }

  /**
   * POST /api/admin/species/sync-item/:id
   * Thử lại đồng bộ 1 sinh vật từ API ngoài
   */
  async retrySyncItem(req, res) {
    try {
      const updated = await speciesService.retrySyncItem(req.params.id);
      return res.status(200).json({
        success: true,
        message: "Đồng bộ lại thành công",
        data: updated,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Lỗi khi đồng bộ lại sinh vật",
      });
    }
  }

  /**
   * POST /api/admin/species/sync-all
   * Đồng bộ tất cả sinh vật còn thiếu dữ liệu
   */
  async syncAllIncomplete(req, res) {
    try {
      const result = await speciesService.syncAllIncomplete();
      return res.status(200).json({
        success: true,
        message: `Đã hoàn tất đồng bộ hàng loạt (${result.count} sinh vật)`,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi đồng bộ hàng loạt",
      });
    }
  }
}

export default new SpeciesAdminController();
