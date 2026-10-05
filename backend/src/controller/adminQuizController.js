import prisma from "../lib/prisma.js";

const SETTING_KEY = "QUIZ_QUESTIONS_BANK";
const SETTING_GROUP = "QUIZ";

// Bộ câu hỏi mẫu chất lượng cao về sinh vật học đại dương
const DEFAULT_QUESTIONS = [
  {
    id: "quiz-1",
    question: "Loài động vật nào có kích thước và khối lượng lớn nhất từng tồn tại trên Trái Đất?",
    options: ["Cá voi sát thủ (Orca)", "Cá voi xanh (Balaenoptera musculus)", "Mực khổng lồ (Architeuthis dux)", "Cá mập voi (Rhincodon typus)"],
    correctAnswerIndex: 1,
    category: "Sinh vật biển",
    difficulty: "easy",
    explanation: "Cá voi xanh có thể dài tới 30 mét và nặng gần 200 tấn, là loài động vật lớn nhất từng được ghi nhận trong lịch sử Trái Đất.",
    isActive: true,
    timesAnswered: 342,
    timesCorrect: 310,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-2",
    question: "Vùng đại dương nào nằm ở độ sâu từ 1.000m đến 4.000m và hoàn toàn không có ánh sáng mặt trời?",
    options: ["Vùng ánh sáng (Sunlight Zone)", "Vùng hoàng hôn (Twilight Zone)", "Vùng nửa đêm (Midnight Zone)", "Vùng rãnh vực (Hadal Zone)"],
    correctAnswerIndex: 2,
    category: "Vùng đại dương",
    difficulty: "medium",
    explanation: "Vùng nửa đêm (Midnight hay Bathypelagic Zone) trải dài từ 1.000m đến 4.000m dưới mặt biển, nơi bóng tối bao trùm hoàn toàn và áp suất nước rất lớn.",
    isActive: true,
    timesAnswered: 228,
    timesCorrect: 175,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-3",
    question: "Độ sâu lớn nhất được đo tại rãnh Mariana (Vực sâu Challenger) là khoảng bao nhiêu?",
    options: ["Khoảng 6.500 mét", "Khoảng 8.848 mét", "Khoảng 10.994 mét", "Khoảng 15.000 mét"],
    correctAnswerIndex: 2,
    category: "Độ sâu & Áp suất",
    difficulty: "medium",
    explanation: "Vực sâu Challenger ở rãnh Mariana là điểm sâu nhất từng được biết đến trong đại dương thế giới, với độ sâu xấp xỉ 10.994 mét.",
    isActive: true,
    timesAnswered: 195,
    timesCorrect: 142,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-4",
    question: "Rạn san hô Great Barrier Reef nằm ở vùng biển của quốc gia nào?",
    options: ["Indonesia", "Úc (Australia)", "Philippines", "Madagascar"],
    correctAnswerIndex: 1,
    category: "Rạn san hô",
    difficulty: "easy",
    explanation: "Great Barrier Reef nằm ngoài khơi bang Queensland, Úc, là hệ thống rạn san hô lớn nhất thế giới bao gồm gần 3.000 rạn san hô riêng rẽ.",
    isActive: true,
    timesAnswered: 412,
    timesCorrect: 388,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-5",
    question: "Loài sinh vật biển nào có khả năng phát quang sinh học (bioluminescence) để săn mồi hoặc phòng vệ?",
    options: ["Cá vây chân (Anglerfish)", "Rùa biển xanh", "Cá hồi Thái Bình Dương", "Hải mã"],
    correctAnswerIndex: 0,
    category: "Sinh vật biển",
    difficulty: "easy",
    explanation: "Cá cần câu (Anglerfish) sở hữu phần mồi phát quang sinh học trên đỉnh đầu để thu hút con mồi trong vùng nước tối tăm dưới biển sâu.",
    isActive: true,
    timesAnswered: 260,
    timesCorrect: 230,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-6",
    question: "Hiện tượng nào sau đây là nguyên nhân chính dẫn đến hiện tượng 'tẩy trắng san hô' (coral bleaching)?",
    options: ["Nước biển giảm độ mặn đột ngột", "Nhiệt độ nước biển tăng cao do biến đổi khí hậu", "Sóng thần ngầm", "Mật độ cá tăng quá mức"],
    correctAnswerIndex: 1,
    category: "Bảo tồn & Sinh thái",
    difficulty: "medium",
    explanation: "Khi nhiệt độ nước biển tăng cao, san hô bị căng thẳng nhiệt và trục xuất tảo cộng sinh zooxanthellae, khiến mô san hô chuyển sang màu trắng và có nguy cơ chết.",
    isActive: true,
    timesAnswered: 184,
    timesCorrect: 155,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-7",
    question: "Mực khổng lồ Colossal Squid sở hữu đặc điểm độc nhất nào so với mực ống thông thường?",
    options: ["Không có mắt", "Có móc xoay sắc nhọn trên các giác hút của xúc tu", "Có mai cứng như rùa", "Có thể sống trên cạn 24 giờ"],
    correctAnswerIndex: 1,
    category: "Sinh vật biển",
    difficulty: "hard",
    explanation: "Mực khổng lồ Colossal Squid sống ở Nam Đại Dương có các móc xoay cực kỳ sắc bén ở đầu xúc tu để kẹp chặt con mồi trong điều kiện khắc nghiệt.",
    isActive: true,
    timesAnswered: 145,
    timesCorrect: 68,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "quiz-8",
    question: "Tình trạng bảo tồn của loài cá voi đầu cong (Bowhead Whale) theo phân hạng của IUCN hiện nay là gì?",
    options: ["Cực kỳ nguy cấp (CR)", "Ít lo ngại (LC)", "Nguy cấp (EN)", "Tuyệt chủng trong tự nhiên (EW)"],
    correctAnswerIndex: 1,
    category: "Bảo tồn & Sinh thái",
    difficulty: "hard",
    explanation: "Nhờ các nỗ lực bảo tồn và hạn chế săn bắt thương mại, quần thể cá voi đầu cong đã phục hồi tốt và hiện được xếp ở mức Ít lo ngại (Least Concern).",
    isActive: true,
    timesAnswered: 110,
    timesCorrect: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

class AdminQuizController {
  /**
   * Helper: Lấy toàn bộ danh sách câu hỏi từ PostgreSQL
   */
  async getRawQuestions() {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { setting_key: SETTING_KEY },
      });

      if (setting && setting.setting_value) {
        let parsed = setting.setting_value;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = DEFAULT_QUESTIONS;
          }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      // Seed mặc định
      await this.saveQuestions(DEFAULT_QUESTIONS);
      return DEFAULT_QUESTIONS;
    } catch (err) {
      console.warn("Lỗi đọc danh sách câu hỏi từ DB, dùng mặc định:", err.message);
      return DEFAULT_QUESTIONS;
    }
  }

  /**
   * Helper: Lưu danh sách câu hỏi vào PostgreSQL
   */
  async saveQuestions(questions, adminId = null) {
    await prisma.system_settings.upsert({
      where: { setting_key: SETTING_KEY },
      update: {
        setting_value: questions,
        setting_group: SETTING_GROUP,
        updated_by: adminId ? BigInt(adminId) : null,
        updated_at: new Date(),
      },
      create: {
        setting_key: SETTING_KEY,
        setting_value: questions,
        setting_group: SETTING_GROUP,
        updated_by: adminId ? BigInt(adminId) : null,
        updated_at: new Date(),
      },
    });
  }

  /**
   * GET /api/admin/quiz
   * Danh sách câu hỏi kèm lọc, tìm kiếm, phân trang và thống kê
   */
  async getQuizList(req, res) {
    try {
      const {
        search = "",
        category = "all",
        difficulty = "all",
        status = "all",
        page = 1,
        limit = 10,
      } = req.query;

      const all = await this.getRawQuestions();

      // Filter
      let filtered = all.filter((q) => {
        const matchesSearch =
          !search ||
          q.question.toLowerCase().includes(search.toLowerCase()) ||
          q.category.toLowerCase().includes(search.toLowerCase());

        const matchesCat = category === "all" || q.category === category;
        const matchesDiff = difficulty === "all" || q.difficulty === difficulty;
        const matchesStatus =
          status === "all" ||
          (status === "active" && q.isActive) ||
          (status === "inactive" && !q.isActive);

        return matchesSearch && matchesCat && matchesDiff && matchesStatus;
      });

      // Stats
      const total = all.length;
      const activeCount = all.filter((q) => q.isActive).length;
      const totalAnswers = all.reduce((sum, q) => sum + (q.timesAnswered || 0), 0);
      const totalCorrect = all.reduce((sum, q) => sum + (q.timesCorrect || 0), 0);
      const correctRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

      const categories = Array.from(new Set(all.map((q) => q.category).filter(Boolean)));

      // Pagination
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, parseInt(limit, 10));
      const totalPages = Math.ceil(filtered.length / limitNum) || 1;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedItems = filtered.slice(startIndex, startIndex + limitNum);

      return res.status(200).json({
        success: true,
        data: paginatedItems,
        pagination: {
          total: filtered.length,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
        stats: {
          total,
          activeCount,
          inactiveCount: total - activeCount,
          totalAnswers,
          correctRate,
          categories,
        },
      });
    } catch (error) {
      console.error("Lỗi getQuizList:", error);
      return res.status(500).json({ success: false, error: "Lỗi tải danh sách câu hỏi" });
    }
  }

  /**
   * POST /api/admin/quiz
   * Tạo câu hỏi mới
   */
  async createQuestion(req, res) {
    try {
      const {
        question,
        options,
        correctAnswerIndex,
        category,
        difficulty,
        explanation,
        isActive,
      } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({ success: false, error: "Nội dung câu hỏi không được để trống" });
      }

      if (!Array.isArray(options) || options.length < 2 || options.some((o) => !o || !o.trim())) {
        return res.status(400).json({ success: false, error: "Cần tối thiểu 2 phương án trả lời hợp lệ" });
      }

      const correctIdx = parseInt(correctAnswerIndex, 10);
      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) {
        return res.status(400).json({ success: false, error: "Đáp án đúng không hợp lệ" });
      }

      const all = await this.getRawQuestions();
      const newQuestion = {
        id: `quiz-${Date.now()}`,
        question: question.trim(),
        options: options.map((o) => o.trim()),
        correctAnswerIndex: correctIdx,
        category: category?.trim() || "Chung",
        difficulty: difficulty || "medium",
        explanation: explanation?.trim() || "",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        timesAnswered: 0,
        timesCorrect: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      all.unshift(newQuestion);
      await this.saveQuestions(all, req.user?.userId);

      return res.status(201).json({
        success: true,
        message: "Tạo câu hỏi mới thành công",
        data: newQuestion,
      });
    } catch (error) {
      console.error("Lỗi createQuestion:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi tạo câu hỏi" });
    }
  }

  /**
   * PUT /api/admin/quiz/:id
   * Cập nhật câu hỏi
   */
  async updateQuestion(req, res) {
    try {
      const { id } = req.params;
      const {
        question,
        options,
        correctAnswerIndex,
        category,
        difficulty,
        explanation,
        isActive,
      } = req.body;

      const all = await this.getRawQuestions();
      const index = all.findIndex((q) => q.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi" });
      }

      if (question !== undefined && !question.trim()) {
        return res.status(400).json({ success: false, error: "Nội dung câu hỏi không được để trống" });
      }

      if (options !== undefined) {
        if (!Array.isArray(options) || options.length < 2 || options.some((o) => !o || !o.trim())) {
          return res.status(400).json({ success: false, error: "Cần tối thiểu 2 phương án trả lời hợp lệ" });
        }
      }

      const current = all[index];
      const updatedOptions = options ? options.map((o) => o.trim()) : current.options;

      let correctIdx = current.correctAnswerIndex;
      if (correctAnswerIndex !== undefined) {
        correctIdx = parseInt(correctAnswerIndex, 10);
        if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= updatedOptions.length) {
          return res.status(400).json({ success: false, error: "Đáp án đúng không hợp lệ" });
        }
      }

      const updated = {
        ...current,
        question: question !== undefined ? question.trim() : current.question,
        options: updatedOptions,
        correctAnswerIndex: correctIdx,
        category: category !== undefined ? category.trim() : current.category,
        difficulty: difficulty !== undefined ? difficulty : current.difficulty,
        explanation: explanation !== undefined ? explanation.trim() : current.explanation,
        isActive: isActive !== undefined ? Boolean(isActive) : current.isActive,
        updatedAt: new Date().toISOString(),
      };

      all[index] = updated;
      await this.saveQuestions(all, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: "Cập nhật câu hỏi thành công",
        data: updated,
      });
    } catch (error) {
      console.error("Lỗi updateQuestion:", error);
      return res.status(500).json({ success: false, error: "Lỗi cập nhật câu hỏi" });
    }
  }

  /**
   * DELETE /api/admin/quiz/:id
   * Xóa câu hỏi
   */
  async deleteQuestion(req, res) {
    try {
      const { id } = req.params;
      const all = await this.getRawQuestions();
      const filtered = all.filter((q) => q.id !== id);

      if (filtered.length === all.length) {
        return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi để xóa" });
      }

      await this.saveQuestions(filtered, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: "Xóa câu hỏi thành công",
      });
    } catch (error) {
      console.error("Lỗi deleteQuestion:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi xóa câu hỏi" });
    }
  }

  /**
   * PATCH /api/admin/quiz/:id/toggle
   * Bật / Tắt trạng thái kích hoạt câu hỏi
   */
  async toggleQuestion(req, res) {
    try {
      const { id } = req.params;
      const all = await this.getRawQuestions();
      const target = all.find((q) => q.id === id);

      if (!target) {
        return res.status(404).json({ success: false, error: "Không tìm thấy câu hỏi" });
      }

      target.isActive = !target.isActive;
      target.updatedAt = new Date().toISOString();

      await this.saveQuestions(all, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: `Đã ${target.isActive ? "kích hoạt" : "tạm tắt"} câu hỏi`,
        data: target,
      });
    } catch (error) {
      console.error("Lỗi toggleQuestion:", error);
      return res.status(500).json({ success: false, error: "Lỗi khi đổi trạng thái câu hỏi" });
    }
  }
}

export default new AdminQuizController();
