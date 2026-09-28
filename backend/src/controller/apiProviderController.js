import apiProviderService from "../services/apiProviderService.js";

export class ApiProviderController {
  async getProviders(req, res) {
    try {
      const includePing = req.query.ping === "true" || req.query.ping === "1";
      const providers = await apiProviderService.getAllProviders(includePing);
      return res.json({
        success: true,
        data: providers,
      });
    } catch (err) {
      console.error("[API PROVIDER CONTROLLER] Lỗi getProviders:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Lỗi khi lấy danh sách nguồn API",
      });
    }
  }

  async createProvider(req, res) {
    try {
      const newProvider = await apiProviderService.addProvider(req.body);
      return res.status(201).json({
        success: true,
        message: "Đã thêm nguồn API mới thành công",
        data: newProvider,
      });
    } catch (err) {
      console.error("[API PROVIDER CONTROLLER] Lỗi createProvider:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Lỗi khi thêm nguồn API",
      });
    }
  }

  async updateProvider(req, res) {
    try {
      const { id } = req.params;
      const updated = await apiProviderService.updateProvider(id, req.body);
      return res.json({
        success: true,
        message: "Đã cập nhật nguồn API thành công",
        data: updated,
      });
    } catch (err) {
      console.error("[API PROVIDER CONTROLLER] Lỗi updateProvider:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Lỗi khi cập nhật nguồn API",
      });
    }
  }

  async deleteProvider(req, res) {
    try {
      const { id } = req.params;
      const result = await apiProviderService.deleteProvider(id);
      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("[API PROVIDER CONTROLLER] Lỗi deleteProvider:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Lỗi khi xóa nguồn API",
      });
    }
  }

  async testProvider(req, res) {
    try {
      const { id } = req.params;
      // If dynamic custom endpoint test before saving
      if (id === "custom" || req.body?.endpoint) {
        const pingRes = await apiProviderService.pingEndpoint(
          req.body.endpoint,
          req.body.headers,
          req.body.apiKey
        );
        return res.json({
          success: true,
          data: {
            endpoint: req.body.endpoint,
            ...pingRes,
          },
        });
      }

      const result = await apiProviderService.testProvider(id);
      return res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("[API PROVIDER CONTROLLER] Lỗi testProvider:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Lỗi khi kiểm tra kết nối API",
      });
    }
  }
}

export default new ApiProviderController();
