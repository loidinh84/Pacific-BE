import { Router } from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";
import adminController from "../controller/adminController.js";
import speciesAdminController from "../controller/speciesAdminController.js";
import speciesGroupsAdminController from "../controller/speciesGroupsAdminController.js";

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
// GET /api/admin/species - Danh sách sinh vật có phân trang & filter
router.get("/species", (req, res) => speciesAdminController.getSpeciesList(req, res));

// GET /api/admin/species/taxonomy-search - Tra cứu phân loại học đại dương từ Backend Proxy
router.get("/species/taxonomy-search", (req, res) => speciesAdminController.searchTaxonomy(req, res));

// GET /api/admin/species/sync-status - Lấy trạng thái sức khỏe 3 API ngoài & sinh vật lỗi
router.get("/species/sync-status", (req, res) => speciesAdminController.getSyncStatus(req, res));

// POST /api/admin/species/sync-item/:id - Thử lại đồng bộ 1 sinh vật
router.post("/species/sync-item/:id", (req, res) => speciesAdminController.retrySyncItem(req, res));

// POST /api/admin/species/sync-all - Đồng bộ tất cả sinh vật lỗi
router.post("/species/sync-all", (req, res) => speciesAdminController.syncAllIncomplete(req, res));

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

/**
 * ── 3. QUẢN LÝ NHÓM SINH VẬT ──
 */
// GET /api/admin/species-groups - Danh sách nhóm kèm số lượng sinh vật
router.get("/species-groups", (req, res) => speciesGroupsAdminController.getSpeciesGroups(req, res));

// POST /api/admin/species-groups - Tạo nhóm sinh vật mới
router.post("/species-groups", (req, res) => speciesGroupsAdminController.createSpeciesGroup(req, res));

// PUT /api/admin/species-groups/:id - Cập nhật nhóm sinh vật
router.put("/species-groups/:id", (req, res) => speciesGroupsAdminController.updateSpeciesGroup(req, res));

// DELETE /api/admin/species-groups/:id - Xóa nhóm sinh vật (gỡ liên kết sinh vật)
router.delete("/species-groups/:id", (req, res) => speciesGroupsAdminController.deleteSpeciesGroup(req, res));

// POST /api/admin/species-groups/:id/species - Gán hàng loạt sinh vật vào nhóm
router.post("/species-groups/:id/species", (req, res) => speciesGroupsAdminController.assignSpeciesToGroup(req, res));

// DELETE /api/admin/species-groups/:id/species/:speciesId - Gỡ sinh vật khỏi nhóm
router.delete("/species-groups/:id/species/:speciesId", (req, res) => speciesGroupsAdminController.removeSpeciesFromGroup(req, res));

// GET /api/admin/species-groups/:id/species - Lấy danh sách sinh vật của 1 nhóm
router.get("/species-groups/:id/species", (req, res) => speciesGroupsAdminController.getGroupSpecies(req, res));

export default router;
