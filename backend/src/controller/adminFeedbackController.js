import prisma from "../lib/prisma.js";

/**
 * AdminFeedbackController - Quản lý ý kiến đóng góp từ người dùng
 */
class AdminFeedbackController {
  /**
   * GET /api/admin/feedback
   * Lấy danh sách ý kiến đóng góp kèm phân trang, tìm kiếm và lọc
   */
  async getFeedbackList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const rating = req.query.rating ? parseInt(req.query.rating, 10) : null;
      const userType = req.query.userType || "all"; // 'all' | 'user' | 'guest'

      const where = {};

      // Lọc theo đánh giá rating
      if (rating && rating >= 1 && rating <= 5) {
        where.rating = rating;
      }

      // Lọc theo loại người gửi
      if (userType === "user") {
        where.user_id = { not: null };
      } else if (userType === "guest") {
        where.user_id = null;
      }

      // Tìm kiếm theo nội dung hoặc thông tin người dùng
      if (search) {
        where.OR = [
          { content: { contains: search, mode: "insensitive" } },
          { users: { full_name: { contains: search, mode: "insensitive" } } },
          { users: { username: { contains: search, mode: "insensitive" } } },
          { users: { email: { contains: search, mode: "insensitive" } } },
        ];
      }

      // Đếm dữ liệu tổng quan
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [totalCount, filteredCount, todayCount, guestCount, userCount, allReviewsForAvg] =
        await Promise.all([
          prisma.site_reviews.count(),
          prisma.site_reviews.count({ where }),
          prisma.site_reviews.count({ where: { created_at: { gte: startOfToday } } }),
          prisma.site_reviews.count({ where: { user_id: null } }),
          prisma.site_reviews.count({ where: { user_id: { not: null } } }),
          prisma.site_reviews.aggregate({
            _avg: { rating: true },
          }),
        ]);

      // Lấy danh sách phân trang
      const reviews = await prisma.site_reviews.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true,
              avatar_url: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const avgRating = allReviewsForAvg._avg.rating
        ? parseFloat(allReviewsForAvg._avg.rating.toFixed(1))
        : 5.0;

      return res.status(200).json({
        success: true,
        data: {
          items: reviews,
          pagination: {
            page,
            limit,
            total: filteredCount,
            totalPages: Math.ceil(filteredCount / limit) || 1,
          },
          stats: {
            total: totalCount,
            today: todayCount,
            guest: guestCount,
            user: userCount,
            avgRating,
          },
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách ý kiến đóng góp:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách ý kiến đóng góp",
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/admin/feedback/:id
   * Xóa một ý kiến đóng góp
   */
  async deleteFeedback(req, res) {
    try {
      const { id } = req.params;
      const reviewId = BigInt(id);

      const existing = await prisma.site_reviews.findUnique({
        where: { id: reviewId },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy ý kiến đóng góp để xóa",
        });
      }

      await prisma.site_reviews.delete({
        where: { id: reviewId },
      });

      return res.status(200).json({
        success: true,
        message: "Đã xóa ý kiến đóng góp thành công",
      });
    } catch (error) {
      console.error("Lỗi khi xóa ý kiến đóng góp:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi xóa ý kiến đóng góp",
        error: error.message,
      });
    }
  }
}

export default new AdminFeedbackController();
