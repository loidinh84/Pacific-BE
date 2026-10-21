import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";

class FeedbackController {
  /**
   * POST /api/feedback
   * Tiếp nhận ý kiến đóng góp từ người dùng (cả khách vãng lai hoặc thành viên đã đăng nhập)
   */
  async createFeedback(req, res) {
    try {
      const { content, rating } = req.body;

      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập nội dung ý kiến đóng góp",
        });
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Nội dung ý kiến đóng góp quá ngắn (tối thiểu 3 ký tự)",
        });
      }

      if (trimmedContent.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Nội dung ý kiến đóng góp không được vượt quá 2000 ký tự",
        });
      }

      // Xử lý rating (mặc định là 5 sao nếu không chọn, giới hạn 1 - 5)
      let parsedRating = parseInt(rating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        parsedRating = 5;
      }

      // Nhận diện người dùng nếu có token xác thực gửi kèm
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const secret = process.env.JWT_SECRET || "dinhthanhloi08042005&nguyentranlebao23012005";
          const decoded = jwt.verify(token, secret);
          const rawUserId = decoded?.userId || decoded?.id;
          if (rawUserId) {
            const checkId = BigInt(rawUserId);
            const userExists = await prisma.user.findUnique({
              where: { id: checkId },
              select: { id: true },
            });
            if (userExists) {
              userId = checkId;
            }
          }
        } catch {
          // Token không hợp lệ hoặc đã hết hạn -> Tiếp tục dưới dạng Khách vãng lai
          userId = null;
        }
      }

      // Lưu vào database
      const review = await prisma.site_reviews.create({
        data: {
          content: trimmedContent,
          rating: parsedRating,
          user_id: userId,
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true,
              avatar_url: true,
              email: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: "Cảm ơn bạn đã gửi ý kiến đóng góp quý báu!",
        data: review,
      });
    } catch (error) {
      console.error("Lỗi khi gửi ý kiến đóng góp:", error);
      return res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi lưu ý kiến đóng góp, vui lòng thử lại sau.",
        error: error.message,
      });
    }
  }
}

export default new FeedbackController();
