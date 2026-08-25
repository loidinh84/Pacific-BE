import { Router } from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";
import adminController from "../controller/adminController.js";
import speciesAdminController from "../controller/speciesAdminController.js";

const router = Router();

// Áp dụng middleware checkAdmin cho tất cả các endpoint thuộc /api/admin/*
router.use(checkAdmin);

/**
 * ── 1. THỐNG KÊ DASHBOARD ──
 */
router.get("/stats/overview", (req, res) => adminController.getOverviewStats(req, res));

/**
 * ── 2. QUẢN LÝ SINH VẬT ──
 */
// GET /api/admin/species - Danh sách sinh vật (cả bị ẩn) có phân trang & filter
router.get("/species", (req, res) => speciesAdminController.getSpeciesList(req, res));

// POST /api/admin/species/sync - Đồng bộ tự động từ API ngoài (Phải đặt trước /:id)
router.post("/species/sync", (req, res) => speciesAdminController.syncFromExternalAPI(req, res));

// GET /api/admin/species/:id - Chi tiết 1 sinh vật
router.get("/species/:id", (req, res) => speciesAdminController.getSpeciesById(req, res));

// POST /api/admin/species - Thêm sinh vật mới (Mã FISH-XXXX tự sinh)
router.post("/species", (req, res) => speciesAdminController.createSpecies(req, res));

// PUT /api/admin/species/:id - Cập nhật thông tin sinh vật
router.put("/species/:id", (req, res) => speciesAdminController.updateSpecies(req, res));

// PATCH /api/admin/species/:id/visibility - Bật / tắt ẩn hiển thị
router.patch("/species/:id/visibility", (req, res) => speciesAdminController.toggleVisibility(req, res));

// DELETE /api/admin/species/:id - Xóa mềm (soft delete)
router.delete("/species/:id", (req, res) => speciesAdminController.deleteSpecies(req, res));

export default router;

