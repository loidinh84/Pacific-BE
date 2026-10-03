import { Router } from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";
import adminController from "../controller/adminController.js";
import speciesAdminController from "../controller/speciesAdminController.js";
import speciesGroupsAdminController from "../controller/speciesGroupsAdminController.js";
import adminProfileController from "../controller/adminProfileController.js";
import apiProviderController from "../controller/apiProviderController.js";
import adminUserController from "../controller/adminUserController.js";
import adminLocationsController from "../controller/adminLocationsController.js";

const router = Router();

// Áp dụng middleware checkAdmin cho tất cả các endpoint thuộc /api/admin/*
router.use(checkAdmin);

/**
 * ── 1. THỐNG KÊ DASHBOARD ──
 */
router.get("/stats/overview", (req, res) => adminController.getOverviewStats(req, res));
router.get("/stats/charts", (req, res) => adminController.getChartStats(req, res));
router.get("/stats/rankings", (req, res) => adminController.getRankingsStats(req, res));
router.get("/stats/full", (req, res) => adminController.getFullDashboard(req, res));

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


/**
 * ── 4. HỒ SƠ ADMIN (ADMIN PROFILE) ──
 */
// GET /api/admin/me - Lấy thông tin admin
router.get("/me", (req, res) => adminProfileController.getAdminProfile(req, res));

// PUT /api/admin/me - Cập nhật thông tin admin
router.put("/me", (req, res) => adminProfileController.updateAdminProfile(req, res));

// POST /api/admin/me/avatar - Cập nhật avatar
router.post("/me/avatar", (req, res) => adminProfileController.updateAdminAvatar(req, res));

// GET /api/admin/me/stats - Thống kê quản trị viên
router.get("/me/stats", (req, res) => adminProfileController.getAdminStats(req, res));

// GET /api/admin/me/activity - Lịch sử hoạt động của admin
router.get("/me/activity", (req, res) => adminProfileController.getAdminActivity(req, res));

// GET /api/admin/me/permissions - Danh sách quyền
router.get("/me/permissions", (req, res) => adminProfileController.getAdminPermissions(req, res));

// POST /api/admin/me/change-password - Đổi mật khẩu
router.post("/me/change-password", (req, res) => adminProfileController.changeAdminPassword(req, res));

// PUT /api/admin/me/settings - Tùy chọn cài đặt
router.put("/me/settings", (req, res) => adminProfileController.updateAdminSettings(req, res));

/**
 * ── 5. QUẢN LÝ NGUỒN API ĐỒNG BỘ (API PROVIDERS HUB) ──
 */
// GET /api/admin/api-providers - Danh sách tất cả API Providers
router.get("/api-providers", (req, res) => apiProviderController.getProviders(req, res));

// POST /api/admin/api-providers - Thêm nguồn API mới
router.post("/api-providers", (req, res) => apiProviderController.createProvider(req, res));

// PUT /api/admin/api-providers/:id - Cập nhật / Bật / Tắt nguồn API
router.put("/api-providers/:id", (req, res) => apiProviderController.updateProvider(req, res));

// DELETE /api/admin/api-providers/:id - Xóa nguồn API
router.delete("/api-providers/:id", (req, res) => apiProviderController.deleteProvider(req, res));

// POST /api/admin/api-providers/:id/test - Kiểm tra kết nối / Ping test
router.post("/api-providers/:id/test", (req, res) => apiProviderController.testProvider(req, res));

/**
 * ── 6. QUẢN LÝ NGƯỜI DÙNG ──
 */
// GET /api/admin/users - Danh sách người dùng có phân trang, tìm kiếm, lọc theo role/status
router.get("/users", (req, res) => adminUserController.getUserList(req, res));

// GET /api/admin/users/:id - Chi tiết 1 người dùng
router.get("/users/:id", (req, res) => adminUserController.getUserById(req, res));

// PATCH /api/admin/users/:id/status - Cập nhật trạng thái (active/locked/pending)
router.patch("/users/:id/status", (req, res) => adminUserController.updateUserStatus(req, res));

// PATCH /api/admin/users/:id/role - Cập nhật vai trò (user/admin)
router.patch("/users/:id/role", (req, res) => adminUserController.updateUserRole(req, res));

// POST /api/admin/users/:id/reset-password - Đặt lại mật khẩu (admin)
router.post("/users/:id/reset-password", (req, res) => adminUserController.resetUserPassword(req, res));

/**
 * ── 7. QUẢN LÝ ĐỊA ĐIỂM ──
 */
// GET /api/admin/locations - Danh sách địa điểm có phân trang, tìm kiếm, lọc
router.get("/locations", (req, res) => adminLocationsController.getLocationList(req, res));

// GET /api/admin/locations/:id - Chi tiết 1 địa điểm
router.get("/locations/:id", (req, res) => adminLocationsController.getLocationById(req, res));

// POST /api/admin/locations - Tạo địa điểm mới
router.post("/locations", (req, res) => adminLocationsController.createLocation(req, res));

// PUT /api/admin/locations/:id - Cập nhật địa điểm
router.put("/locations/:id", (req, res) => adminLocationsController.updateLocation(req, res));

// DELETE /api/admin/locations/:id - Xóa địa điểm
router.delete("/locations/:id", (req, res) => adminLocationsController.deleteLocation(req, res));

// PATCH /api/admin/locations/:id/featured - Bật/tắt nổi bật
router.patch("/locations/:id/featured", (req, res) => adminLocationsController.toggleFeatured(req, res));

export default router;
