import ecosystemService from "../services/ecosystemService.js";

export class AdminRelationshipsController {
  /**
   * GET /api/admin/relationships
   */
  async getRelationships(req, res) {
    try {
      const result = await ecosystemService.getAdminRelationships(req.query);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách quan hệ sinh thái:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Có lỗi xảy ra khi lấy danh sách quan hệ",
      });
    }
  }

  /**
   * POST /api/admin/relationships
   */
  async createRelationship(req, res) {
    try {
      const result = await ecosystemService.createRelationship(req.body);
      return res.status(201).json(result);
    } catch (error) {
      console.error("Lỗi khi tạo quan hệ sinh thái:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Không thể tạo quan hệ sinh thái",
      });
    }
  }

  /**
   * PUT /api/admin/relationships/:id
   */
  async updateRelationship(req, res) {
    try {
      const { id } = req.params;
      const result = await ecosystemService.updateRelationship(id, req.body);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Lỗi khi cập nhật quan hệ sinh thái:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Không thể cập nhật quan hệ sinh thái",
      });
    }
  }

  /**
   * DELETE /api/admin/relationships/:id
   */
  async deleteRelationship(req, res) {
    try {
      const { id } = req.params;
      const result = await ecosystemService.deleteRelationship(id);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Lỗi khi xóa quan hệ sinh thái:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Không thể xóa quan hệ sinh thái",
      });
    }
  }
}

export default new AdminRelationshipsController();
