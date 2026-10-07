import prisma from "../lib/prisma.js";

const SETTING_KEY = "SYSTEM_CONFIG";
const SETTING_GROUP = "GENERAL";

const DEFAULT_SETTINGS = {
  general: {
    websiteName: "Pacific Ocean Portal",
    seoDescription: "Cổng thông tin & tra cứu sinh vật biển Thái Bình Dương chuẩn khoa học",
    contactEmail: "admin@pacific.org",
    logoUrl: "",
    socialLinks: [
      { id: "1", platform: "Facebook", url: "https://facebook.com/pacific.ocean" },
      { id: "2", platform: "Instagram", url: "https://instagram.com/pacific.ocean" },
      { id: "3", platform: "YouTube", url: "https://youtube.com/@pacific.ocean" },
    ],
  },
  display: {
    defaultLanguage: "vi",
    enableAudioAutoPlay: false,
    enable3DViewer: true,
    enableOceanEffects: true,
  },
  content: {
    autoModeration: true,
    filterProfanity: true,
    maxReportsToHide: 3,
  },
  users: {
    allowRegistration: true,
    requireEmailVerification: false,
  },
  api: {
    gbifApiKey: "gbif_sec_99182310231",
    syncFrequency: "daily",
  },
  security: {
    require2FA: true,
    sessionTimeoutMinutes: 60,
  },
};

const logActivity = async (actorId, action, targetType, targetId, description) => {
  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorId ? BigInt(actorId) : null,
        action,
        target_type: targetType || null,
        target_id: targetId ? BigInt(targetId) : null,
        description: description || null,
      },
    });
  } catch (err) {
    console.warn("⚠️ [LOG ACTIVITY FAILED]:", err.message);
  }
};

class AdminSettingsController {
  /**
   * GET /api/admin/settings
   * Lấy cấu hình hệ thống
   */
  async getSettings(req, res) {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { setting_key: SETTING_KEY },
      });

      let config = DEFAULT_SETTINGS;

      if (setting && setting.setting_value) {
        let parsed = setting.setting_value;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = DEFAULT_SETTINGS;
          }
        }
        config = {
          general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
          display: { ...DEFAULT_SETTINGS.display, ...(parsed.display || {}) },
          content: { ...DEFAULT_SETTINGS.content, ...(parsed.content || {}) },
          users: { ...DEFAULT_SETTINGS.users, ...(parsed.users || {}) },
          api: { ...DEFAULT_SETTINGS.api, ...(parsed.api || {}) },
          security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
        };
      }

      return res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error("Lỗi khi tải cấu hình hệ thống:", error);
      return res.status(500).json({
        success: false,
        error: "Lỗi hệ thống khi tải cấu hình cài đặt",
      });
    }
  }

  /**
   * PUT /api/admin/settings
   * Cập nhật toàn bộ hoặc một phần cấu hình hệ thống
   */
  async updateSettings(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const incoming = req.body;

      if (!incoming || typeof incoming !== "object") {
        return res.status(400).json({
          success: false,
          error: "Dữ liệu cấu hình không hợp lệ",
        });
      }

      // Lấy cấu hình hiện tại để merge
      const existing = await prisma.system_settings.findUnique({
        where: { setting_key: SETTING_KEY },
      });

      let current = DEFAULT_SETTINGS;
      if (existing && existing.setting_value) {
        let parsed = existing.setting_value;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {}
        }
        if (parsed && typeof parsed === "object") {
          current = parsed;
        }
      }

      // Merge deep
      const merged = {
        general: { ...(current.general || DEFAULT_SETTINGS.general), ...(incoming.general || {}) },
        display: { ...(current.display || DEFAULT_SETTINGS.display), ...(incoming.display || {}) },
        content: { ...(current.content || DEFAULT_SETTINGS.content), ...(incoming.content || {}) },
        users: { ...(current.users || DEFAULT_SETTINGS.users), ...(incoming.users || {}) },
        api: { ...(current.api || DEFAULT_SETTINGS.api), ...(incoming.api || {}) },
        security: { ...(current.security || DEFAULT_SETTINGS.security), ...(incoming.security || {}) },
      };

      await prisma.system_settings.upsert({
        where: { setting_key: SETTING_KEY },
        update: {
          setting_value: merged,
          setting_group: SETTING_GROUP,
          updated_by: adminId,
          updated_at: new Date(),
        },
        create: {
          setting_key: SETTING_KEY,
          setting_value: merged,
          setting_group: SETTING_GROUP,
          updated_by: adminId,
          updated_at: new Date(),
        },
      });

      await logActivity(
        adminId,
        "UPDATE_SYSTEM_SETTINGS",
        "SYSTEM_SETTINGS",
        null,
        "Quản trị viên cập nhật thiết lập hệ thống portal"
      );

      return res.status(200).json({
        success: true,
        message: "Lưu cấu hình hệ thống thành công",
        data: merged,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật cấu hình hệ thống:", error);
      return res.status(500).json({
        success: false,
        error: "Lỗi hệ thống khi lưu cấu hình cài đặt",
      });
    }
  }
}

export default new AdminSettingsController();
