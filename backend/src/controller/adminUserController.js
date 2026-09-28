import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

/**
 * AdminUserController - Quản lý người dùng từ phía Admin
 */
class AdminUserController {
  /**
   * GET /api/admin/users
   * Danh sách người dùng có phân trang, tìm kiếm, lọc
   */
  async getUserList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const roleFilter = req.query.role || "all";
      const statusFilter = req.query.status || "all";
      const sortBy = req.query.sortBy || "created_at";
      const order = req.query.order === "asc" ? "asc" : "desc";

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { full_name: { contains: search, mode: "insensitive" } },
        ];
      }

      if (roleFilter !== "all") {
        where.role = roleFilter;
      }

      if (statusFilter !== "all") {
        where.status = statusFilter;
      }

      // Build orderBy
      const validSortFields = ["created_at", "username", "email", "full_name", "status", "role"];
      const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortField]: order },
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
            avatar_url: true,
            role: true,
            status: true,
            created_at: true,
            last_login_at: true,
            _count: {
              select: {
                favorites: true,
                species_views: true,
              },
            },
          },
        }),
      ]);

      const data = users.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        fullName: u.full_name || "",
        email: u.email,
        avatar: u.avatar_url || "",
        role: u.role,
        status: u.status,
        joinedDate: u.created_at,
        lastLogin: u.last_login_at || null,
        totalFavorites: u._count.favorites,
        totalViews: u._count.species_views,
      }));

      return res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      console.error("adminUserController.getUserList error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải danh sách người dùng" });
    }
  }

  /**
   * GET /api/admin/users/:id
   * Chi tiết người dùng
   */
  async getUserById(req, res) {
    try {
      const userId = BigInt(req.params.id);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          full_name: true,
          email: true,
          avatar_url: true,
          bio: true,
          phone_number: true,
          date_of_birth: true,
          role: true,
          status: true,
          created_at: true,
          last_login_at: true,
          _count: {
            select: {
              favorites: true,
              species_views: true,
              user_explored_locations: true,
              comments: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      }

      return res.json({
        success: true,
        user: {
          id: user.id.toString(),
          username: user.username,
          fullName: user.full_name || "",
          email: user.email,
          avatar: user.avatar_url || "",
          bio: user.bio || "",
          phoneNumber: user.phone_number || "",
          dateOfBirth: user.date_of_birth ? user.date_of_birth.toISOString().split("T")[0] : "",
          role: user.role,
          status: user.status,
          joinedDate: user.created_at,
          lastLogin: user.last_login_at || null,
          stats: {
            totalFavorites: user._count.favorites,
            totalViews: user._count.species_views,
            totalLocations: user._count.user_explored_locations,
            totalComments: user._count.comments,
          },
        },
      });
    } catch (error) {
      console.error("adminUserController.getUserById error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải chi tiết người dùng" });
    }
  }

  /**
   * PATCH /api/admin/users/:id/status
   * Cập nhật trạng thái: active | locked | pending
   */
  async updateUserStatus(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const userId = BigInt(req.params.id);
      const { status } = req.body;

      const validStatuses = ["active", "locked", "pending"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(", ")}`,
        });
      }

      // Không cho phép admin tự khóa chính mình
      if (userId === adminId && status === "locked") {
        return res.status(400).json({ success: false, error: "Không thể tự khóa tài khoản của chính mình" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { status, updated_at: new Date() },
        select: { id: true, username: true, status: true },
      });

      // Ghi log hoạt động
      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "UPDATE_USER_STATUS",
            target_type: "USER",
            target_id: userId,
            description: `Admin đã cập nhật trạng thái người dùng "${user.username}" → ${status}`,
          },
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: `Đã cập nhật trạng thái người dùng "${updated.username}" thành "${status}"`,
        user: { id: updated.id.toString(), username: updated.username, status: updated.status },
      });
    } catch (error) {
      console.error("adminUserController.updateUserStatus error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi cập nhật trạng thái người dùng" });
    }
  }

  /**
   * PATCH /api/admin/users/:id/role
   * Cập nhật vai trò: user | admin
   */
  async updateUserRole(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const userId = BigInt(req.params.id);
      const { role } = req.body;

      const validRoles = ["user", "admin"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Vai trò không hợp lệ. Chỉ chấp nhận: ${validRoles.join(", ")}`,
        });
      }

      // Không cho phép admin tự hạ cấp mình
      if (userId === adminId && role === "user") {
        return res.status(400).json({ success: false, error: "Không thể tự hạ cấp vai trò của chính mình" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { role, updated_at: new Date() },
        select: { id: true, username: true, role: true },
      });

      // Ghi log
      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "UPDATE_USER_ROLE",
            target_type: "USER",
            target_id: userId,
            description: `Admin đã cập nhật vai trò người dùng "${user.username}" → ${role}`,
          },
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: `Đã cập nhật vai trò người dùng "${updated.username}" thành "${role}"`,
        user: { id: updated.id.toString(), username: updated.username, role: updated.role },
      });
    } catch (error) {
      console.error("adminUserController.updateUserRole error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi cập nhật vai trò người dùng" });
    }
  }

  /**
   * POST /api/admin/users/:id/reset-password
   * Đặt lại mật khẩu về mặc định (hoặc mật khẩu tùy chỉnh)
   */
  async resetUserPassword(req, res) {
    try {
      const adminId = BigInt(req.user.userId);
      const userId = BigInt(req.params.id);
      const { newPassword } = req.body;

      const password = newPassword?.trim() || "Pacific@123";

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password_hash: hashedPassword, updated_at: new Date() },
      });

      // Ghi log
      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: adminId,
            action: "RESET_USER_PASSWORD",
            target_type: "USER",
            target_id: userId,
            description: `Admin đã đặt lại mật khẩu cho người dùng "${user.username}"`,
          },
        });
      } catch (_) {}

      return res.json({
        success: true,
        message: `Đã đặt lại mật khẩu cho "${user.username}". Mật khẩu mới: ${password}`,
        temporaryPassword: password,
      });
    } catch (error) {
      console.error("adminUserController.resetUserPassword error:", error);
      return res.status(500).json({ success: false, error: "Lỗi hệ thống khi đặt lại mật khẩu" });
    }
  }
}

export default new AdminUserController();
