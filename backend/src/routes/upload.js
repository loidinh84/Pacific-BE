import { Router } from "express";
import uploadController from "../controller/uploadController.js";

const router = Router();

// POST /api/upload - Tải tệp lên hệ thống
router.post("/", (req, res) => uploadController.uploadFile(req, res));

export default router;
