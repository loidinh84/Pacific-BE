import { Router } from "express";
import newsController from "../controller/newsController.js";

const router = Router();

// Lấy danh sách tin tức đã xuất bản
router.get("/", newsController.getNews);

// Lấy danh sách tin tức nổi bật
router.get("/featured", newsController.getFeaturedNews);

// Lấy danh sách chuyên mục tin tức
router.get("/categories", newsController.getCategories);

// Lấy chi tiết 1 bài viết theo slug
router.get("/:slug", newsController.getNewsBySlug);

export default router;
