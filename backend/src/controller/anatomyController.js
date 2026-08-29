import anatomyService from "../services/anatomyService.js";

/**
 * AnatomyController - Điều khiển các endpoint API cho Giải phẫu sinh vật
 */
export class AnatomyController {
  /**
   * GET /api/species/:id/anatomy - Lấy danh sách bộ phận giải phẫu của sinh vật
   */
  async getAnatomyBySpecies(req, res) {
    try {
      const { id } = req.params;
      const data = await anatomyService.getAnatomyBySpecies(id);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message || "Lỗi khi lấy dữ liệu giải phẫu",
      });
    }
  }

  /**
   * POST /api/admin/species/:id/anatomy - Thêm bộ phận giải phẫu mới (Admin)
   */
  async createAnatomy(req, res) {
    try {
      const { id } = req.params;
      const body = { ...req.body, species_id: id };
      const created = await anatomyService.createAnatomy(body);
      return res.status(201).json({
        success: true,
        message: "Tạo bộ phận giải phẫu thành công",
        data: created,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi tạo bộ phận giải phẫu",
      });
    }
  }

  /**
   * PUT /api/admin/anatomy/:anatomyId - Cập nhật bộ phận giải phẫu (Admin)
   */
  async updateAnatomy(req, res) {
    try {
      const { anatomyId } = req.params;
      const updated = await anatomyService.updateAnatomy(anatomyId, req.body);
      return res.status(200).json({
        success: true,
        message: "Cập nhật bộ phận giải phẫu thành công",
        data: updated,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi cập nhật bộ phận giải phẫu",
      });
    }
  }

  /**
   * DELETE /api/admin/anatomy/:anatomyId - Xóa bộ phận giải phẫu (Admin)
   */
  async deleteAnatomy(req, res) {
    try {
      const { anatomyId } = req.params;
      await anatomyService.deleteAnatomy(anatomyId);
      return res.status(200).json({
        success: true,
        message: "Xóa bộ phận giải phẫu thành công",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi xóa bộ phận giải phẫu",
      });
    }
  }
}

export default new AnatomyController();
