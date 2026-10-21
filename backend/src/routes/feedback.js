import { Router } from "express";
import feedbackController from "../controller/feedbackController.js";

const router = Router();

// POST /api/feedback - Tiếp nhận ý kiến đóng góp từ người dùng
router.post("/", (req, res) => feedbackController.createFeedback(req, res));

export default router;
