import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

// Helper: tính số ngày tham gia
const calculateMemberDays = (createdAt) => {
  const diffTime = Math.abs(Date.now() - new Date(createdAt).getTime());
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

/**
 * GET /api/users/me
 * Lấy toàn bộ thông tin cá nhân của người dùng hiện tại (Private)
 */
export const getMyProfile = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "Không tìm thấy tài khoản người dùng" });
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
        joinedDate: user.created_at,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải hồ sơ cá nhân" });
  }
};

/**
 * PUT /api/users/me
 * Cập nhật thông tin cơ bản: fullName, bio, phoneNumber, dateOfBirth
 */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const { fullName, bio, phoneNumber, dateOfBirth, avatar } = req.body;

    // Validate fullName nếu có gửi lên
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 50) {
        return res.status(400).json({
          success: false,
          error: "Họ và tên phải từ 2 đến 50 ký tự",
        });
      }
    }

    // Validate bio
    if (bio !== undefined && typeof bio === "string" && bio.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Tiểu sử (bio) không được vượt quá 500 ký tự",
      });
    }

    // Validate phone VN format nếu có nhập
    if (phoneNumber) {
      const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        return res.status(400).json({
          success: false,
          error: "Số điện thoại không đúng định dạng (Ví dụ: 0912345678 hoặc +84912345678)",
        });
      }
    }

    // Validate dateOfBirth (age >= 10)
    let parsedDob = null;
    if (dateOfBirth) {
      const dobDate = new Date(dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        return res.status(400).json({ success: false, error: "Ngày sinh không hợp lệ" });
      }
      const ageYears = (Date.now() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 10) {
        return res.status(400).json({ success: false, error: "Bạn phải đủ từ 10 tuổi trở lên" });
      }
      parsedDob = dobDate;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined && { full_name: fullName.trim() }),
        ...(bio !== undefined && { bio: bio.trim() }),
        ...(phoneNumber !== undefined && { phone_number: phoneNumber.trim() }),
        ...(parsedDob !== undefined && { date_of_birth: parsedDob }),
        ...(avatar !== undefined && { avatar_url: avatar }),
        updated_at: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công!",
      user: {
        id: updatedUser.id.toString(),
        username: updatedUser.username,
        fullName: updatedUser.full_name || "",
        email: updatedUser.email,
        avatar: updatedUser.avatar_url || "",
        bio: updatedUser.bio || "",
        phoneNumber: updatedUser.phone_number || "",
        dateOfBirth: updatedUser.date_of_birth ? updatedUser.date_of_birth.toISOString().split("T")[0] : "",
        joinedDate: updatedUser.created_at,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    return res.status(500).json({ success: false, error: "Lỗi khi cập nhật hồ sơ cá nhân" });
  }
};

/**
 * PUT /api/users/me/email
 * Thay đổi email (Yêu cầu mật khẩu hiện tại)
 */
export const changeEmail = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập đầy đủ Email mới và Mật khẩu hiện tại",
      });
    }

    const cleanEmail = newEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Địa chỉ email mới không hợp lệ" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: "Tài khoản đăng nhập bằng Google/Mạng xã hội không thể đổi email theo cách này",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Mật khẩu hiện tại không chính xác" });
    }

    // Kiểm tra trùng email
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing && existing.id !== userId) {
      return res.status(400).json({ success: false, error: "Địa chỉ email này đã có người sử dụng" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: cleanEmail, updated_at: new Date() },
    });

    return res.json({
      success: true,
      message: "Thay đổi email thành công!",
      email: updated.email,
    });
  } catch (error) {
    console.error("changeEmail error:", error);
    return res.status(500).json({ success: false, error: "Lỗi hệ thống khi thay đổi email" });
  }
};

/**
 * PUT /api/users/me/password
 * Thay đổi mật khẩu
 */
export const changePassword = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập mật khẩu cũ và mật khẩu mới",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Xác nhận mật khẩu mới không khớp",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: "Tài khoản liên kết Google/Mạng xã hội chưa có mật khẩu",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Mật khẩu cũ không chính xác" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword, updated_at: new Date() },
    });

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ success: false, error: "Lỗi hệ thống khi thay đổi mật khẩu" });
  }
};

/**
 * POST /api/users/me/avatar
 * Cập nhật avatar URL
 */
export const updateAvatar = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ success: false, error: "Vui lòng cung cấp link ảnh avatar" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl, updated_at: new Date() },
    });

    return res.json({
      success: true,
      message: "Cập nhật ảnh đại diện thành công!",
      avatar: updated.avatar_url,
    });
  } catch (error) {
    console.error("updateAvatar error:", error);
    return res.status(500).json({ success: false, error: "Lỗi khi cập nhật ảnh đại diện" });
  }
};

/**
 * GET /api/users/me/stats
 * Thống kê hoạt động của người dùng hiện tại
 */
export const getMyStats = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { created_at: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
    }

    const [totalFavorites, totalLocationsExplored, totalViews] = await Promise.all([
      prisma.favorites.count({ where: { user_id: userId } }),
      prisma.user_explored_locations.count({ where: { user_id: userId } }),
      prisma.species_views.count({ where: { user_id: userId } }),
    ]);

    const memberDays = calculateMemberDays(user.created_at);

    return res.json({
      success: true,
      stats: {
        totalCreaturesDiscovered: totalFavorites + totalViews,
        totalLocationsExplored,
        totalFavorites,
        memberDays,
      },
    });
  } catch (error) {
    console.error("getMyStats error:", error);
    return res.status(500).json({ success: false, error: "Lỗi khi lấy thống kê hoạt động" });
  }
};

/**
 * GET /api/users/me/favorites
 * Danh sách sinh vật yêu thích cá nhân có phân trang
 */
export const getMyFavorites = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const [total, favorites] = await Promise.all([
      prisma.favorites.count({ where: { user_id: userId } }),
      prisma.favorites.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          species: {
            select: {
              id: true,
              code: true,
              scientificName: true,
              common_name: true,
              slug: true,
              description: true,
              model_3d_url: true,
              species_media: {
                where: { is_primary: true },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const items = favorites.map((f) => ({
      creatureId: f.species.id.toString(),
      code: f.species.code,
      name: f.species.common_name || f.species.scientificName,
      scientificName: f.species.scientificName,
      slug: f.species.slug,
      description: f.species.description,
      image: f.species.species_media?.[0]?.url || "/assets/default_creature.png",
      favoritedDate: f.created_at,
    }));

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("getMyFavorites error:", error);
    return res.status(500).json({ success: false, error: "Lỗi khi tải danh sách yêu thích" });
  }
};

/**
 * GET /api/users/me/explored
 * Danh sách địa điểm đã khám phá cá nhân có phân trang
 */
export const getMyExplored = async (req, res) => {
  try {
    const userId = BigInt(req.user.userId);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const [total, explored] = await Promise.all([
      prisma.user_explored_locations.count({ where: { user_id: userId } }),
      prisma.user_explored_locations.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { explored_at: "desc" },
        include: {
          locations: true,
        },
      }),
    ]);

    const items = explored.map((e) => ({
      locationId: e.locations.id.toString(),
      name: e.locations.name,
      slug: e.locations.slug,
      description: e.locations.description,
      image: e.locations.image_url || "/assets/default_location.png",
      exploredDate: e.explored_at,
    }));

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("getMyExplored error:", error);
    return res.status(500).json({ success: false, error: "Lỗi khi tải danh sách địa điểm khám phá" });
  }
};

/**
 * GET /api/users/:username
 * Hồ sơ công khai cho cộng đồng (CHỈ HIỂN THỊ THÔNG TIN PUBLIC, ẨN HOÀN TOÀN FULLNAME, EMAIL, SĐT, NGÀY SINH)
 */
export const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ success: false, error: "Thiếu username" });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        bio: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

    if (!user || user.status === "locked") {
      return res.status(404).json({ success: false, error: "Không tìm thấy hồ sơ người dùng này" });
    }

    const [totalFavorites, totalLocationsExplored] = await Promise.all([
      prisma.favorites.count({ where: { user_id: user.id } }),
      prisma.user_explored_locations.count({ where: { user_id: user.id } }),
    ]);

    const memberDays = calculateMemberDays(user.created_at);

    // Lấy top 8 sinh vật yêu thích công khai
    const topFavorites = await prisma.favorites.findMany({
      where: { user_id: user.id },
      take: 8,
      orderBy: { created_at: "desc" },
      include: {
        species: {
          select: {
            id: true,
            code: true,
            scientificName: true,
            common_name: true,
            slug: true,
            species_media: {
              where: { is_primary: true },
              take: 1,
            },
          },
        },
      },
    });

    const publicCollection = topFavorites.map((f) => ({
      id: f.species.id.toString(),
      name: f.species.common_name || f.species.scientificName,
      scientificName: f.species.scientificName,
      slug: f.species.slug,
      image: f.species.species_media?.[0]?.url || "/assets/default_creature.png",
    }));

    return res.json({
      success: true,
      user: {
        username: user.username,
        avatar: user.avatar_url || "",
        bio: user.bio || "",
        role: user.role,
        joinedDate: user.created_at,
        stats: {
          totalFavorites,
          totalLocationsExplored,
          totalCreaturesDiscovered: totalFavorites,
          memberDays,
        },
        collection: publicCollection,
      },
    });
  } catch (error) {
    console.error("getPublicProfile error:", error);
    return res.status(500).json({ success: false, error: "Lỗi hệ thống khi tải hồ sơ công khai" });
  }
};
