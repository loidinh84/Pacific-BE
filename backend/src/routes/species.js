import { Router } from "express";

const router = Router();

// GET /api/species
router.get("/", async (req, res) => {
  res.json({ message: "Get all species - coming soon" });
});

// GET /api/species/:id
router.get("/:id", async (req, res) => {
  res.json({ message: `Get species ${req.params.id} - coming soon` });
});

// POST /api/species
router.post("/", async (req, res) => {
  res.json({ message: "Create species - coming soon" });
});

export default router;
