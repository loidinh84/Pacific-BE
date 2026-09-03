import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

// Helper: tính số ngày tham gia
const calculateMemberDays = (createdAt) => {
  if (!createdAt) return 1;
  const diffTime = Math.abs(Date.now() - new Date(createdAt).getTime());
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

// Helper: ghi activity log an toàn
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

class AdminProfileController {
  /**
   * 1. GET /api/admin/me
   * Lấy thông tin cá nhân của Admin hiện tại
   */
  async getAdminProfile(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài khoản quản trị viên" });
      }

      const memberDays = calculateMemberDays(admin.created_at);

      return res.status(200).json({
        success: true,
        admin: {
          id: admin.id.toString(),
          username: admin.username,
          fullName: admin.full_name || "",
          email: admin.email,
          avatar: admin.avatar_url || "",
          bio: admin.bio || "",
          phoneNumber: admin.phone_number || "",
          dateOfBirth: admin.date_of_birth ? admin.date_of_birth.toISOString().split("T")[0] : "",
          role: admin.role,
          status: admin.status,
          joinedDate: admin.created_at,
          lastLogin: admin.last_login_at || admin.created_at,
          memberDays,
        },
      });
    } catch (error) {
      console.error("getAdminProfile error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải hồ sơ quản trị viên" });
    }
  }

  /**
   * 2. PUT /api/admin/me
   * Cập nhật thông tin: fullName, bio, email, phoneNumber, dateOfBirth
   */
  async updateAdminProfile(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const { username, fullName, bio, email, currentPassword, phoneNumber, dateOfBirth } = req.body;

      const currentAdmin = await prisma.user.findUnique({
        where: { id: adminId },
      });

      if (!currentAdmin) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài khoản quản trị viên" });
      }

      const updateData = {};

      // Validate username
      if (username !== undefined && username.trim().toLowerCase() !== currentAdmin.username.toLowerCase()) {
        const cleanUsername = username.trim().toLowerCase();
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(cleanUsername)) {
          return res.status(400).json({
            success: false,
            error: "Tên đăng nhập phải từ 3 đến 30 ký tự, chỉ gồm chữ cái, chữ số và dấu gạch dưới (_)",
          });
        }

        const existingUsername = await prisma.user.findFirst({
          where: {
            username: cleanUsername,
            NOT: { id: adminId },
          },
        });

        if (existingUsername) {
          return res.status(409).json({
            success: false,
            error: "Tên đăng nhập này đã được sử dụng bởi tài khoản khác",
          });
        }

        updateData.username = cleanUsername;
      }


      // Validate fullName
      if (fullName !== undefined) {
        if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 50) {
          return res.status(400).json({ success: false, error: "Họ và tên phải từ 2 đến 50 ký tự" });
        }
        updateData.full_name = fullName.trim();
      }

      // Validate bio
      if (bio !== undefined) {
        if (typeof bio === "string" && bio.length > 500) {
          return res.status(400).json({ success: false, error: "Tiểu sử không được vượt quá 500 ký tự" });
        }
        updateData.bio = bio ? bio.trim() : "";
      }

      // Validate phone
      if (phoneNumber !== undefined) {
        if (phoneNumber && phoneNumber.trim().length > 0) {
          const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
          if (!phoneRegex.test(phoneNumber.trim())) {
            return res.status(400).json({ success: false, error: "Số điện thoại không đúng định dạng" });
          }
          updateData.phone_number = phoneNumber.trim();
        } else {
          updateData.phone_number = null;
        }
      }

      // Validate dateOfBirth
      if (dateOfBirth !== undefined) {
        if (dateOfBirth) {
          const dob = new Date(dateOfBirth);
          if (isNaN(dob.getTime())) {
            return res.status(400).json({ success: false, error: "Ngày sinh không hợp lệ" });
          }
          updateData.date_of_birth = dob;
        } else {
          updateData.date_of_birth = null;
        }
      }

      // Nếu có yêu cầu đổi Email -> Bắt buộc kiểm tra mật khẩu hiện tại
      if (email && email.toLowerCase().trim() !== currentAdmin.email.toLowerCase()) {
        const cleanEmail = email.toLowerCase().trim();
        const emailRegex = /^[^s@]+@[^s@]+.[^s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({ success: false, error: "Địa chỉ email không đúng định dạng" });
        }

        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: "Vui lòng nhập mật khẩu hiện tại để xác nhận thay đổi email",
          });
        }

        if (!currentAdmin.password_hash) {
          return res.status(400).json({
            success: false,
            error: "Tài khoản chưa thiết lập mật khẩu",
          });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, currentAdmin.password_hash);
        if (!isPasswordValid) {
          return res.status(400).json({ success: false, error: "Mật khẩu hiện tại không chính xác" });
        }

        // Kiểm tra email đã được tài khoản khác sử dụng chưa
        const existingUser = await prisma.user.findFirst({
          where: {
            email: cleanEmail,
            NOT: { id: adminId },
          },
        });

        if (existingUser) {
          return res.status(409).json({ success: false, error: "Email này đã được sử dụng bởi tài khoản khác" });
        }

        updateData.email = cleanEmail;
      }

      updateData.updated_at = new Date();

      const updated = await prisma.user.update({
        where: { id: adminId },
        data: updateData,
      });

      await logActivity(adminId, "UPDATE_PROFILE", "USER", adminId, "Quản trị viên cập nhật thông tin hồ sơ cá nhân");

      return res.status(200).json({
        success: true,
        message: "Cập nhật hồ sơ quản trị viên thành công",
        admin: {
          id: updated.id.toString(),
          username: updated.username,
          fullName: updated.full_name || "",
          email: updated.email,
          avatar: updated.avatar_url || "",
          bio: updated.bio || "",
          phoneNumber: updated.phone_number || "",
          dateOfBirth: updated.date_of_birth ? updated.date_of_birth.toISOString().split("T")[0] : "",
          role: updated.role,
          status: updated.status,
          joinedDate: updated.created_at,
          lastLogin: updated.last_login_at || updated.created_at,
        },
      });
    } catch (error) {
      console.error("updateAdminProfile error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi cập nhật hồ sơ quản trị viên" });
    }
  }

  /**
   * 3. POST /api/admin/me/avatar
   * Cập nhật avatar của Admin
   */
  async updateAdminAvatar(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const { avatarUrl } = req.body;

      if (!avatarUrl || typeof avatarUrl !== "string") {
        return res.status(400).json({ success: false, error: "Dữ liệu ảnh đại diện không hợp lệ" });
      }

      const updated = await prisma.user.update({
        where: { id: adminId },
        data: {
          avatar_url: avatarUrl,
          updated_at: new Date(),
        },
      });

      await logActivity(adminId, "UPDATE_AVATAR", "USER", adminId, "Quản trị viên thay đổi ảnh đại diện");

      return res.status(200).json({
        success: true,
        message: "Cập nhật ảnh đại diện thành công",
        avatarUrl: updated.avatar_url,
      });
    } catch (error) {
      console.error("updateAdminAvatar error:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi cập nhật ảnh đại diện" });
    }
  }

  /**
   * 4. GET /api/admin/me/stats
   * Thống kê quản trị: usersManaged, speciesManaged, groupsManaged, activityCount, memberDays
   */
  async getAdminStats(req, res) {
    try {
      const adminId = BigInt(req.user.userId);

      const [admin, usersCount, speciesCount, groupsCount, activityCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: adminId }, select: { created_at: true } }),
        prisma.user.count(),
        prisma.species.count({ where: { deleted_at: null } }),
        prisma.species_groups.count(),
        prisma.activity_logs.count({ where: { actor_id: adminId } }),
      ]);

      const memberDays = calculateMemberDays(admin?.created_at);

      return res.status(200).json({
        success: true,
        stats: {
          usersManaged: usersCount,
          speciesManaged: speciesCount,
          groupsManaged: groupsCount,
          activityCount: activityCount,
          memberDays,
        },
      });
    } catch (error) {
      console.error("getAdminStats error:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi tải dữ liệu thống kê quản trị" });
    }
  }

  /**
   * 5. GET /api/admin/me/activity
   * Lịch sử hoạt động phân trang: page, limit, filter
   */
  async getAdminActivity(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
      const filter = (req.query.filter || "all").toLowerCase();

      const where = {
        actor_id: adminId,
      };

      if (filter === "create") {
        where.action = { contains: "CREATE", mode: "insensitive" };
      } else if (filter === "update") {
        where.action = { contains: "UPDATE", mode: "insensitive" };
      } else if (filter === "delete") {
        where.action = { contains: "DELETE", mode: "insensitive" };
      }

      const [total, rawLogs] = await Promise.all([
        prisma.activity_logs.count({ where }),
        prisma.activity_logs.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const activities = rawLogs.map((log) => ({
        id: log.id.toString(),
        action: log.action,
        targetType: log.target_type || "HỆ THỐNG",
        targetId: log.target_id ? log.target_id.toString() : null,
        description: log.description || log.action,
        timestamp: log.created_at,
        status: "SUCCESS",
      }));

      return res.status(200).json({
        success: true,
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error("getAdminActivity error:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi tải lịch sử hoạt động" });
    }
  }

  /**
   * 6. GET /api/admin/me/permissions
   * Danh sách quyền theo vai trò
   */
  async getAdminPermissions(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, username: true },
      });

      const role = admin?.role || "admin";

      const allPermissions = [
        {
          module: "Sinh vật biển (Species)",
          description: "Quản lý thông tin, phân loại và dữ liệu 3D sinh vật",
          permissions: [
            { code: "species.view", name: "Xem danh sách & Chi tiết", granted: true },
            { code: "species.create", name: "Thêm sinh vật mới", granted: true },
            { code: "species.edit", name: "Chỉnh sửa thông tin sinh vật", granted: true },
            { code: "species.delete", name: "Xóa mềm sinh vật", granted: role === "super_admin" || role === "admin" },
            { code: "species.sync", name: "Đồng bộ tự động từ API ngoài (GBIF/WoRMS)", granted: true },
          ],
        },
        {
          module: "Nhóm loài (Species Groups)",
          description: "Quản lý phân loại nhóm sinh vật",
          permissions: [
            { code: "groups.view", name: "Xem danh sách nhóm", granted: true },
            { code: "groups.manage", name: "Thêm / Sửa nhóm loài", granted: true },
            { code: "groups.assign", name: "Gán & Phân loại sinh vật vào nhóm", granted: true },
            { code: "groups.delete", name: "Xóa nhóm loài (bảo toàn sinh vật)", granted: role === "super_admin" },
          ],
        },
        {
          module: "Địa điểm & Vùng biển (Locations)",
          description: "Quản lý các điểm nóng và hải trình khám phá",
          permissions: [
            { code: "locations.view", name: "Xem bản đồ & Địa điểm", granted: true },
            { code: "locations.create", name: "Thêm tọa độ địa điểm mới", granted: true },
            { code: "locations.edit", name: "Chỉnh sửa thông tin địa điểm", granted: true },
            { code: "locations.delete", name: "Xóa địa điểm", granted: role === "super_admin" },
          ],
        },
        {
          module: "Người dùng & Bình luận (Users & Moderation)",
          description: "Quản lý tài khoản người dùng và kiểm duyệt nội dung",
          permissions: [
            { code: "users.view", name: "Xem danh sách người dùng", granted: true },
            { code: "users.edit", name: "Cập nhật trạng thái / Khóa tài khoản", granted: role === "super_admin" },
            { code: "comments.moderate", name: "Kiểm duyệt & Ẩn bình luận vi phạm", granted: true },
          ],
        },
        {
          module: "Hệ thống & Cấu hình (System & Config)",
          description: "Thiết lập tham số toàn cục và bảo mật",
          permissions: [
            { code: "system.settings", name: "Xem cấu hình hệ thống", granted: true },
            { code: "system.edit_config", name: "Chỉnh sửa cấu hình API Keys & Mailer", granted: role === "super_admin" },
            { code: "system.logs", name: "Xem nhật ký kiểm toán (Audit Logs)", granted: true },
          ],
        },
      ];

      return res.status(200).json({
        success: true,
        role,
        permissionsList: allPermissions,
      });
    } catch (error) {
      console.error("getAdminPermissions error:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi tải danh sách quyền" });
    }
  }

  /**
   * 7. POST /api/admin/me/change-password
   * Đổi mật khẩu Admin
   */
  async changeAdminPassword(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Vui lòng nhập đầy đủ Mật khẩu hiện tại, Mật khẩu mới và Xác nhận mật khẩu",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Mật khẩu mới và Xác nhận mật khẩu không khớp",
        });
      }

      // Password policy: >= 8 ký tự, có chữ hoa, chữ thường, chữ số
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          error: "Mật khẩu mới phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số",
        });
      }

      const admin = await prisma.user.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài khoản quản trị viên" });
      }

      if (!admin.password_hash) {
        return res.status(400).json({ success: false, error: "Tài khoản chưa thiết lập mật khẩu cũ" });
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, admin.password_hash);
      if (!isCurrentValid) {
        return res.status(400).json({ success: false, error: "Mật khẩu hiện tại không chính xác" });
      }

      const newHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: adminId },
        data: {
          password_hash: newHash,
          updated_at: new Date(),
        },
      });

      await logActivity(adminId, "CHANGE_PASSWORD", "USER", adminId, "Quản trị viên đổi mật khẩu thành công");

      return res.status(200).json({
        success: true,
        message: "Đổi mật khẩu thành công!",
      });
    } catch (error) {
      console.error("changeAdminPassword error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi đổi mật khẩu" });
    }
  }

  /**
   * 8. PUT /api/admin/me/settings
   * Cập nhật tùy chọn: notificationsEmail, theme, language
   */
  async updateAdminSettings(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const { notificationsEmail, theme, language } = req.body;

      const updateData = { updated_at: new Date() };

      if (language && (language === "vi" || language === "en")) {
        updateData.preferred_language_code = language;
      }

      const updated = await prisma.user.update({
        where: { id: adminId },
        data: updateData,
      });

      await logActivity(adminId, "UPDATE_SETTINGS", "SYSTEM", null, "Cập nhật tùy chọn giao diện & thông báo");

      return res.status(200).json({
        success: true,
        message: "Lưu cài đặt thành công",
        settings: {
          notificationsEmail: notificationsEmail !== undefined ? !!notificationsEmail : true,
          theme: theme || "dark",
          language: updated.preferred_language_code || "vi",
        },
      });
    } catch (error) {
      console.error("updateAdminSettings error:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi lưu cài đặt quản trị viên" });
    }
  }
}

export default new AdminProfileController();
