import { Router } from "express";
import taxonomyService from "../services/taxonomyService.js";
import oceanAudioService from "../services/oceanAudioService.js";

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

// GET /api/species/audio-library - Tải danh sách âm thanh đại dương (default catalog from Wikimedia)
router.get("/audio-library", async (req, res) => {
  try {
    const query = req.query.q || "";
    const category = req.query.category || "Tất cả";
    const result = await oceanAudioService.getAudioLibrary(query, category);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/audio-search - Tìm kiếm nâng cao âm thanh đại dương trực tiếp từ Wikimedia
router.get("/audio-search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const result = await oceanAudioService.searchAdvanced(query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/audio-proxy - Proxy âm thanh để bypass lỗi 403 Forbidden của CDNs
router.get("/audio-proxy", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("Missing target audio URL");
    }

    const audioRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://pixabay.com/",
        "Accept": "*/*",
      },
    });

    if (!audioRes.ok) {
      return res.status(audioRes.status).send(`Failed to stream audio (status: ${audioRes.status})`);
    }

    res.setHeader("Content-Type", audioRes.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const arrayBuffer = await audioRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Lỗi Audio Proxy Stream:", error.message);
    return res.status(500).send("Audio Proxy Error");
  }
});

// GET /api/species/groups - Danh sách nhóm sinh vật biển
router.get("/groups", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const groups = await prisma.species_groups.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      success: true,
      data: groups.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        slug: g.slug,
        description: g.description,
        image_url: g.image_url,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/zones - Danh sách 5 tầng nước đại dương
router.get("/zones", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const zones = await prisma.ocean_zones.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ success: true, data: zones });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/statuses - Danh sách tình trạng bảo tồn IUCN
router.get("/statuses", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const statuses = await prisma.conservation_statuses.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/locations - Danh sách địa điểm khám phá đại dương
router.get("/locations", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const locations = await prisma.locations.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({
      success: true,
      data: locations.map((loc) => ({
        id: loc.id.toString(),
        name: loc.name,
        slug: loc.slug,
        latitude: loc.latitude,
        longitude: loc.longitude,
        ocean_zone_id: loc.ocean_zone_id,
        is_featured: loc.is_featured,
        description: loc.description,
        image_url: loc.image_url,
      })),
    });
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
