import { Router } from "express";
import authenticateToken from "../middleware/auth.js";
import {
  getMyProfile,
  updateMyProfile,
  changeEmail,
  changePassword,
  updateAvatar,
  getMyStats,
  getMyFavorites,
  getMyExplored,
} from "../controller/userController.js";

const router = Router();

// Toàn bộ các endpoints đều yêu cầu JWT Token (Private Profile)
router.use(authenticateToken);

router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.put("/me/email", changeEmail);
router.put("/me/password", changePassword);
router.post("/me/avatar", updateAvatar);
router.get("/me/stats", getMyStats);
router.get("/me/favorites", getMyFavorites);
router.get("/me/explored", getMyExplored);

export default router;
