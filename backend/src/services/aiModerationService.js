import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/**
 * Service kiểm duyệt bình luận bằng Google Gemini AI (Miễn phí)
 * Hỗ trợ fallback an toàn (fail-open) nếu API gặp sự cố hoặc timeout
 */
class AIModerationService {
  constructor() {
    this.model = "gemini-3.5-flash-lite";
  }

  get apiKey() {
    return process.env.GEMINI_API_KEY || "";
  }

  /**
   * Phân tích nội dung bình luận qua Gemini
   * @param {string} content - Nội dung bình luận
   * @param {string} sensitivity - 'low' | 'medium' | 'high'
   * @returns {Promise<{ isFlagged: boolean, reason: string }>}
   */
  async moderateComment(content, sensitivity = "medium") {
    if (!this.apiKey) {
      return { isFlagged: false, reason: "No API Key configured" };
    }

    if (!content || !content.trim()) {
      return { isFlagged: false, reason: "" };
    }

    const sensitivityDesc = {
      low: "Chỉ gắn cờ nếu có nội dung vi phạm cực kỳ nghiêm trọng, phát ngôn thù địch rõ rệt hoặc lừa đảo nguy hiểm.",
      medium: "Tiêu chuẩn kiểm duyệt: Gắn cờ nếu có từ ngữ xúc phạm danh dự, quấy rối, chửi bới thô tục, lừa đảo hoặc spam độc hại.",
      high: "Nghiêm ngặt: Gắn cờ cả những câu nói châm chọc tiêu cực, ngôn từ gây hấn hoặc nghi vấn độc hại.",
    }[sensitivity] || "Tiêu chuẩn kiểm duyệt cộng đồng.";

    const prompt = `Bạn là hệ thống kiểm duyệt bình luận tiếng Việt tự động cho website bảo tồn sinh vật biển Pacific.
Nhiệm vụ: Phân tích bình luận sau xem có vi phạm tiêu chuẩn cộng đồng không.
Mức độ nhạy: ${sensitivity} (${sensitivityDesc})

Bình luận cần kiểm tra:
"""${content}"""

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ không kèm Markdown, định dạng sau:
{
  "isFlagged": true hoặc false,
  "reason": "Lý do ngắn gọn bằng tiếng Việt nếu vi phạm, hoặc để trống nếu hợp lệ"
}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 4000, // Timeout 4s để tránh làm chậm trải nghiệm người dùng
        }
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      // Làm sạch text nếu AI bọc trong ```json ```
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        isFlagged: Boolean(parsed.isFlagged),
        reason: parsed.reason || (parsed.isFlagged ? "Vi phạm tiêu chuẩn cộng đồng" : ""),
      };
    } catch (err) {
      console.warn("⚠️ [AI Moderation Service Error / Timeout]:", err.message);
      // Fallback: Cho phép bình luận đi tiếp để không chặn người dùng
      return { isFlagged: false, reason: "Fallback - error" };
    }
  }
}

export default new AIModerationService();
