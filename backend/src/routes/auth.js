import { Router } from "express";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  res.json({ message: "Register endpoint - coming soon" });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  res.json({ message: "Login endpoint - coming soon" });
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  res.json({ message: "Logout endpoint - coming soon" });
});

export default router;
