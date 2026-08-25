import { Router } from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";
import adminController from "../controller/adminController.js";

const router = Router();

// Áp dụng middleware checkAdmin cho tất cả các endpoint thuộc /api/admin/*
router.use(checkAdmin);

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Số liệu tổng quan cho dashboard
 * @access  Private (Admin / Super Admin)
 */
router.get("/stats/overview", (req, res) => adminController.getOverviewStats(req, res));

export default router;
