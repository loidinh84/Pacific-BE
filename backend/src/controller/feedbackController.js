import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import aiModerationService from "../services/aiModerationService.js";

// Cache lưu thời gian gửi gần nhất để chống spam (Rate Limiting)
const feedbackCooldowns = new Map();
const DEFAULT_COOLDOWN_SECONDS = 60; // Thời gian chờ mặc định giữa 2 lần gửi: 60 giây

// Tự động dọn dẹp cache sau mỗi 10 phút
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of feedbackCooldowns.entries()) {
    if (now - timestamp > DEFAULT_COOLDOWN_SECONDS * 2 * 1000) {
      feedbackCooldowns.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Kiểm tra nội dung dựa theo danh sách từ cấm tùy chỉnh từ Cấu hình Hệ thống (System Settings)
 */
function checkBannedWords(text, bannedWords = []) {
  if (!text) return { isFlagged: false, reason: "" };
  const normalized = text.toLowerCase();

  // 1. Kiểm tra chuỗi ký tự spam lặp lại liên tục vô nghĩa (vd: aaaaaaaaa, 1111111111)
  if (/(.)\1{7,}/.test(normalized)) {
    return {
      isFlagged: true,
      reason: "Nội dung chứa chuỗi ký tự lặp lại vô nghĩa (Spam)",
    };
  }

  // 2. Kiểm tra danh sách từ khóa cấm cấu hình từ trang Quản trị (Admin System Settings)
  if (Array.isArray(bannedWords) && bannedWords.length > 0) {
    for (const rawWord of bannedWords) {
      if (!rawWord || typeof rawWord !== "string" || !rawWord.trim()) continue;
      const word = rawWord.trim().toLowerCase();

      // Với từ ngắn (<= 3 ký tự), sử dụng word boundary để tránh khớp nhầm từ bình thường
      if (word.length <= 3) {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(normalized)) {
          return {
            isFlagged: true,
            reason: "Nội dung chứa từ khóa bị hạn chế theo quy định cộng đồng",
          };
        }
      } else {
        if (normalized.includes(word)) {
          return {
            isFlagged: true,
            reason: "Nội dung chứa từ khóa bị hạn chế theo quy định cộng đồng",
          };
        }
      }
    }
  }

  return { isFlagged: false, reason: "" };
}

class FeedbackController {
  /**
   * POST /api/feedback
   * Tiếp nhận ý kiến đóng góp từ người dùng kèm bộ lọc lấy từ Thiết lập hệ thống & chống spam
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
      if (trimmedContent.length < 5) {
        return res.status(400).json({
          success: false,
          message: "Nội dung ý kiến đóng góp quá ngắn (tối thiểu 5 ký tự)",
        });
      }

      if (trimmedContent.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Nội dung ý kiến đóng góp không được vượt quá 2000 ký tự",
        });
      }

      // Xử lý điểm đánh giá (mặc định 5)
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
          userId = null;
        }
      }

      // ── TẢI CẤU HÌNH TỪ THIẾT LẬP HỆ THỐNG (SYSTEM SETTINGS) ──
      let contentSettings = {};
      try {
        const settingRecord = await prisma.system_settings.findFirst({
          where: { setting_key: "general_config" },
        });
        if (settingRecord?.setting_value) {
          const parsed =
            typeof settingRecord.setting_value === "string"
              ? JSON.parse(settingRecord.setting_value)
              : settingRecord.setting_value;
          contentSettings = parsed?.content || {};
        }
      } catch (err) {
        console.warn("Không thể tải cấu hình system_settings:", err.message);
      }

      // ── BẢO VỆ 1: CHỐNG SPAM (RATE LIMIT / COOLDOWN) ──
      const cooldownSec = Number(contentSettings.commentCooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);
      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "anonymous_ip";
      const rateLimitKey = userId ? `user_${userId}` : `ip_${clientIp}`;

      if (cooldownSec > 0 && feedbackCooldowns.has(rateLimitKey)) {
        const lastSentTime = feedbackCooldowns.get(rateLimitKey);
        const elapsedSec = (Date.now() - lastSentTime) / 1000;
        if (elapsedSec < cooldownSec) {
          const waitSec = Math.ceil(cooldownSec - elapsedSec);
          return res.status(429).json({
            success: false,
            message: `Bạn đang gửi ý kiến quá nhanh. Vui lòng đợi ${waitSec} giây trước khi gửi tiếp.`,
          });
        }
      }

      // ── BẢO VỆ 2: KIỂM TRA BỘ LỌC TỪ CẤM TỪ THIẾT LẬP HỆ THỐNG ──
      if (contentSettings.filterProfanity !== false) {
        const bannedWords = Array.isArray(contentSettings.customBannedWords)
          ? contentSettings.customBannedWords
          : ["scam", "lừa đảo", "chửi bậy", "xúc phạm", "hack"];

        const bannedCheck = checkBannedWords(trimmedContent, bannedWords);
        if (bannedCheck.isFlagged) {
          return res.status(400).json({
            success: false,
            message: "Nội dung đóng góp chứa từ khóa bị hạn chế theo quy định cộng đồng. Vui lòng kiểm tra và chỉnh sửa lại.",
            reason: bannedCheck.reason,
          });
        }
      }

      // ── BẢO VỆ 3: KIỂM DUYỆT TỰ ĐỘNG BẰNG AI (NẾU ĐƯỢC BẬT TRONG THIẾT LẬP HỆ THỐNG) ──
      if (contentSettings.autoModeration !== false) {
        try {
          if (aiModerationService && typeof aiModerationService.moderateComment === "function") {
            const sensitivity = contentSettings.aiSensitivity || "medium";
            const aiCheck = await aiModerationService.moderateComment(trimmedContent, sensitivity);
            if (aiCheck?.isFlagged) {
              return res.status(400).json({
                success: false,
                message: "Nội dung đóng góp vi phạm tiêu chuẩn cộng đồng hoặc mang tính công kích tiêu cực. Vui lòng diễn đạt tích cực hơn.",
                reason: aiCheck.reason,
              });
            }
          }
        } catch (aiErr) {
          console.warn("[Feedback AI Moderation check skipped]:", aiErr.message);
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

      // Cập nhật mốc thời gian rate limit
      if (cooldownSec > 0) {
        feedbackCooldowns.set(rateLimitKey, Date.now());
      }

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
