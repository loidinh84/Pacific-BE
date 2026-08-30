import { Router } from "express";
import taxonomyService from "../services/taxonomyService.js";

const router = Router();

// GET /api/species/taxonomy-search - Tra cứu phân loại học đại dương
router.get("/taxonomy-search", async (req, res) => {
  try {
    const query = req.query.q || req.query.query || "";
    const provider = req.query.provider || "auto";
    const result = await taxonomyService.searchTaxonomy(query, provider);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

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
