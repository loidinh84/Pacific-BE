import { Router } from "express";
import taxonomyService from "../services/taxonomyService.js";
import oceanAudioService from "../services/oceanAudioService.js";
import authenticateToken from "../middleware/auth.js";

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

// GET /api/species/:idOrSlug/comments - Danh sách bình luận công khai của loài sinh vật
router.get("/:idOrSlug/comments", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    // Tìm loài sinh vật theo id (nếu là số) hoặc slug/code/common_name
    let species = null;
    const isNum = /^\d+$/.test(idOrSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(idOrSlug) },
        select: { id: true, slug: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(200).json({ success: true, data: [] });
    }

    const comments = await prisma.comments.findMany({
      where: {
        species_id: species.id,
        deleted_at: null,
        status: "visible",
      },
      orderBy: { created_at: "desc" },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
      },
    });

    const formatted = comments.map((c) => ({
      id: c.id.toString(),
      content: c.content,
      createdAt: c.created_at,
      user: c.users
        ? {
            id: c.users.id.toString(),
            username: c.users.username,
            fullName: c.users.full_name || c.users.username,
            avatarUrl: c.users.avatar_url || "",
            role: c.users.role,
          }
        : {
            id: "0",
            username: "Người dùng ẩn danh",
            fullName: "Người dùng ẩn danh",
            avatarUrl: "",
            role: "user",
          },
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Lỗi lấy danh sách bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/:idOrSlug/comments - Gửi bình luận mới cho loài sinh vật
router.post("/:idOrSlug/comments", authenticateToken, async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Nội dung bình luận không được để trống" });
    }

    const { default: prisma } = await import("../lib/prisma.js");

    let species = null;
    const isNum = /^\d+$/.test(idOrSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(idOrSlug) },
        select: { id: true, slug: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    const newComment = await prisma.comments.create({
      data: {
        species_id: species.id,
        user_id: BigInt(userId),
        content: content.trim(),
        status: "visible",
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
            role: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Bình luận thành công",
      data: {
        id: newComment.id.toString(),
        content: newComment.content,
        createdAt: newComment.created_at,
        user: newComment.users
          ? {
              id: newComment.users.id.toString(),
              username: newComment.users.username,
              fullName: newComment.users.full_name || newComment.users.username,
              avatarUrl: newComment.users.avatar_url || "",
              role: newComment.users.role,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/species/comments/:commentId - Xóa bình luận của chính mình hoặc admin xóa
router.delete("/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { default: prisma } = await import("../lib/prisma.js");

    const comment = await prisma.comments.findUnique({
      where: { id: BigInt(commentId) },
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận" });
    }

    // Kiểm tra quyền: Admin / Super Admin hoặc chính người tạo
    if (role !== "admin" && role !== "super_admin" && comment.user_id.toString() !== userId?.toString()) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bình luận này" });
    }

    await prisma.comments.update({
      where: { id: BigInt(commentId) },
      data: {
        deleted_at: new Date(),
        status: "deleted",
      },
    });

    return res.status(200).json({ success: true, message: "Đã xóa bình luận thành công" });
  } catch (error) {
    console.error("Lỗi xóa bình luận:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/species/:idOrSlug/view - Ghi nhận lượt xem sinh vật (tự động loại trừ Admin để tránh làm sai lệch số liệu)
router.post("/:idOrSlug/view", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const authHeader = req.headers.authorization;
    let currentUser = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const jwtSecret = process.env.JWT_SECRET || "dinhthanhloi08042005&nguyentranlebao23012005";
        const decoded = (await import("jsonwebtoken")).default.verify(token, jwtSecret);
        currentUser = decoded;
      } catch {
        // Token không hợp lệ hoặc hết hạn -> xử lý như khách vãng lai
      }
    }

    // Nếu người xem là Admin hoặc Super Admin -> BỎ QUA không ghi nhận lượt xem
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "super_admin")) {
      return res.status(200).json({
        success: true,
        message: "Lượt xem của quản trị viên được bỏ qua để giữ độ chính xác của số liệu phân tích.",
        ignored: true,
      });
    }

    const { default: prisma } = await import("../lib/prisma.js");

    let species = null;
    const isNum = /^\d+$/.test(idOrSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(idOrSlug) },
        select: { id: true, view_count: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, view_count: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    // Tăng view_count trên bảng species
    await prisma.species.update({
      where: { id: species.id },
      data: {
        view_count: { increment: 1 },
      },
    });

    // Ghi log vào bảng species_views nếu có thể
    try {
      await prisma.species_views.create({
        data: {
          species_id: species.id,
          user_id: currentUser?.userId ? BigInt(currentUser.userId) : null,
        },
      });
    } catch {
      // Bỏ qua lỗi log phụ
    }

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận lượt xem",
      ignored: false,
    });
  } catch (error) {
    console.error("Lỗi ghi nhận view:", error);
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
