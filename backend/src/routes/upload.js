import { Router } from "express";
import uploadController from "../controller/uploadController.js";

const router = Router();

// POST /api/upload - Upload file từ máy tính (ảnh, video, 3d model .glb, audio .mp3)
router.post("/", (req, res) => uploadController.uploadFile(req, res));

export default router;
