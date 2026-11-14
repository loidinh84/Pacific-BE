import { Router } from "express";
import taxonomyService from "../services/taxonomyService.js";
import oceanAudioService from "../services/oceanAudioService.js";
import authenticateToken from "../middleware/auth.js";
import aiModerationService from "../services/aiModerationService.js";
import ecosystemService from "../services/ecosystemService.js";

const router = Router();

// Mapping các slug / id phổ biến từ mockup hoặc tiếng Anh sang slug chuẩn trong CSDL
const SLUG_ALIASES = {
  "giant-octopus-3": "bach-tuoc-khong-lo",
  "octopus": "bach-tuoc-khong-lo",
  "whale-shark": "ca-map-voi-nham-voi",
  "whale-shark-2": "ca-map-voi-nham-voi",
  "bluefin-tuna-1": "ca-ngu-vay-vang-dai-duong",
  "great-white-shark-1": "great-white-shark-1",
};

const resolveSpeciesSlug = (slugOrId = "") => {
  return SLUG_ALIASES[slugOrId] || slugOrId;
};

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

// GET /api/species/audio-library - Tải danh sách âm thanh đại dương
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

// GET /api/species/audio-proxy - Proxy âm thanh hợp lệ từ các nguồn khoa học / Freesound đã xác thực
router.get("/audio-proxy", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("Missing target audio URL");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).send("Invalid audio URL");
    }

    const allowedHosts = [
      "freesound.org",
      "cdn.freesound.org",
      "upload.wikimedia.org",
      "commons.wikimedia.org",
      "localhost",
    ];
    const isAllowed = allowedHosts.some(
      (h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`),
    );
    if (!isAllowed || !["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(403).send("Audio source domain is not permitted");
    }

    const audioRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "PacificOceanApp/1.0 (https://pacific.org; educational bioacoustics)",
        "Accept": "audio/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
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

// GET /api/species/ecosystem/graph - Đồ thị đa dạng sinh thái Biển Đông
router.get("/ecosystem/graph", async (req, res) => {
  try {
    const result = await ecosystemService.getKnowledgeGraph(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy đồ thị sinh thái:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/ecosystem/stats - Thống kê đa dạng sinh học & Sách Đỏ Biển Đông
router.get("/ecosystem/stats", async (req, res) => {
  try {
    const result = await ecosystemService.getEastSeaStats();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy thống kê Biển Đông:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/ecosystem - Hệ sinh thái và chuỗi thức ăn của loài
router.get("/:idOrSlug/ecosystem", async (req, res) => {
  try {
    const result = await ecosystemService.getSpeciesEcosystem(req.params.idOrSlug);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi lấy hệ sinh thái loài:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/search/semantic - Tìm kiếm Ngữ nghĩa Sinh thái Biển Đông
router.get("/search/semantic", async (req, res) => {
  try {
    const query = req.query.q || req.query.query || "";
    const result = await ecosystemService.searchSemantic(query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi tìm kiếm ngữ nghĩa:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/comments - Danh sách bình luận công khai của loài sinh vật
router.get("/:idOrSlug/comments", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    // Tìm sinh vật theo id hoặc slug
    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, slug: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
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

    // 1. Tải cấu hình kiểm duyệt từ bảng system_settings
    let settings = null;
    try {
      const settingRecord = await prisma.system_settings.findFirst({
        where: { setting_key: "general_config" },
      });
      if (settingRecord?.setting_value) {
        settings =
          typeof settingRecord.setting_value === "string"
            ? JSON.parse(settingRecord.setting_value)
            : settingRecord.setting_value;
      }
    } catch {}
    const contentSettings = settings?.content || {};

    // 2. Kiểm tra Cooldown thời gian chờ giữa 2 lần bình luận
    const cooldownSec = Number(contentSettings.commentCooldownSeconds ?? 0);
    if (cooldownSec > 0) {
      const lastComment = await prisma.comments.findFirst({
        where: { user_id: BigInt(userId) },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      });
      if (lastComment) {
        const diffSec = (Date.now() - new Date(lastComment.created_at).getTime()) / 1000;
        if (diffSec < cooldownSec) {
          const waitSec = Math.ceil(cooldownSec - diffSec);
          return res.status(429).json({
            success: false,
            message: `Bạn đang bình luận quá nhanh. Vui lòng đợi ${waitSec} giây trước khi gửi tiếp.`,
          });
        }
      }
    }

    let processedContent = content.trim();

    // 3. Kiểm tra danh sách từ khóa cấm
    if (contentSettings.filterProfanity !== false) {
      const bannedWords = Array.isArray(contentSettings.customBannedWords)
        ? contentSettings.customBannedWords
        : ["scam", "lừa đảo", "chửi bậy", "xúc phạm", "hack"];

      const profanityAction = contentSettings.profanityAction || "mask";

      for (const word of bannedWords) {
        if (!word) continue;
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        if (regex.test(processedContent)) {
          if (profanityAction === "reject") {
            return res.status(400).json({
              success: false,
              message: "Bình luận chứa từ ngữ không phù hợp theo quy định cộng đồng. Vui lòng chỉnh sửa trước khi đăng.",
            });
          } else {
            processedContent = processedContent.replace(regex, "*".repeat(word.length));
          }
        }
      }
    }

    // 4. Kiểm duyệt tự động nội dung bình luận
    let initialStatus = contentSettings.requireApprovalFirst ? "pending" : "visible";
    let aiFlagReason = "";

    if (contentSettings.autoModeration !== false) {
      try {
        const aiCheck = await aiModerationService.moderateComment(
          processedContent,
          contentSettings.aiSensitivity || "medium"
        );
        if (aiCheck?.isFlagged) {
          initialStatus = "hidden"; // Tự động tạm ẩn bình luận vi phạm
          aiFlagReason = aiCheck.reason || "AI phát hiện vi phạm tiêu chuẩn cộng đồng";
        }
      } catch (err) {
        console.warn("⚠️ [AI Moderation Check Skipped]:", err.message);
      }
    }

    const newComment = await prisma.comments.create({
      data: {
        species_id: species.id,
        user_id: BigInt(userId),
        content: processedContent,
        status: initialStatus,
        report_count: aiFlagReason ? 1 : 0,
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

    // Tạo phiếu báo cáo khi bình luận có dấu hiệu vi phạm
    if (aiFlagReason) {
      try {
        await prisma.comment_reports.create({
          data: {
            comment_id: newComment.id,
            reported_by: BigInt(userId),
            reason: `[AI Gemini Gắn Cờ]: ${aiFlagReason}`,
            status: "pending",
          },
        });
      } catch (e) {
        console.warn("Không thể ghi phiếu báo cáo AI:", e.message);
      }
    }

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

// POST /api/species/:idOrSlug/view - Ghi nhận lượt xem sinh vật
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

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, view_count: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
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

// POST /api/species/:idOrSlug/favorite - Toggle lưu hoặc bỏ lưu sinh vật yêu thích
router.post("/:idOrSlug/favorite", authenticateToken, async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const userId = BigInt(req.user.userId);
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true, common_name: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
          ],
        },
        select: { id: true, common_name: true },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    const existing = await prisma.favorites.findUnique({
      where: {
        user_id_species_id: {
          user_id: userId,
          species_id: species.id,
        },
      },
    });

    if (existing) {
      await prisma.favorites.delete({
        where: {
          user_id_species_id: {
            user_id: userId,
            species_id: species.id,
          },
        },
      });
      return res.status(200).json({
        success: true,
        isFavorited: false,
        message: "Đã xóa khỏi danh sách yêu thích",
      });
    } else {
      await prisma.favorites.create({
        data: {
          user_id: userId,
          species_id: species.id,
        },
      });
      return res.status(200).json({
        success: true,
        isFavorited: true,
        message: "Đã lưu vào danh sách yêu thích",
      });
    }
  } catch (error) {
    console.error("Lỗi toggle favorite:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/favorite-status - Kiểm tra trạng thái yêu thích
router.get("/:idOrSlug/favorite-status", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    let userId = null;
    try {
      const token = authHeader.split(" ")[1];
      const jwtSecret = process.env.JWT_SECRET || "dinhthanhloi08042005&nguyentranlebao23012005";
      const decoded = (await import("jsonwebtoken")).default.verify(token, jwtSecret);
      userId = decoded.userId;
    } catch {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    if (!userId) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    const { default: prisma } = await import("../lib/prisma.js");
    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);
    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        select: { id: true },
      });
    }
    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
          ],
        },
        select: { id: true },
      });
    }

    if (!species) {
      return res.status(200).json({ success: true, isFavorited: false });
    }

    const existing = await prisma.favorites.findUnique({
      where: {
        user_id_species_id: {
          user_id: BigInt(userId),
          species_id: species.id,
        },
      },
    });

    return res.status(200).json({
      success: true,
      isFavorited: !!existing,
    });
  } catch (error) {
    return res.status(200).json({ success: true, isFavorited: false });
  }
});

// GET /api/species - Lấy danh sách loài sinh vật biển
router.get("/", async (req, res) => {
  try {
    const { default: prisma } = await import("../lib/prisma.js");
    const {
      page = 1,
      limit = 20,
      search = "",
      zone = "",
      redList = "",
      groupId = "",
      category = "",
      sortBy = "az",
      featured = "",
    } = req.query;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(500, parseInt(limit, 10));
    const take = Math.min(500, parseInt(limit, 10));

    const where = {
      deleted_at: null,
      is_visible: true,
    };

    if (search && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { common_name: { contains: q, mode: "insensitive" } },
        { scientificName: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ];
    }

    if (zone && zone.trim() !== "") {
      where.east_sea_zone = { contains: zone.trim(), mode: "insensitive" };
    }

    if (redList && redList.trim() !== "") {
      where.vietnam_red_list_status = redList.trim();
    }

    if (groupId) {
      where.group_id = BigInt(groupId);
    } else if (category && category.trim() !== "") {
      const catTrim = category.trim();
      if (/^\d+$/.test(catTrim)) {
        where.group_id = BigInt(catTrim);
      } else {
        where.species_groups = {
          OR: [
            { slug: { equals: catTrim, mode: "insensitive" } },
            { name: { contains: catTrim, mode: "insensitive" } },
          ],
        };
      }
    }

    let orderBy = [{ id: "asc" }];
    if (sortBy === "az") {
      orderBy = [{ common_name: "asc" }];
    } else if (sortBy === "depth") {
      orderBy = [{ depth_max_m: "asc" }, { depth_min_m: "asc" }];
    } else if (sortBy === "status") {
      orderBy = [{ conservation_status_id: "desc" }, { common_name: "asc" }];
    } else if (sortBy === "views" || sortBy === "popular" || featured === "true") {
      orderBy = [{ view_count: "desc" }];
    } else if (sortBy === "newest") {
      orderBy = [{ created_at: "desc" }];
    }

    const [total, speciesList] = await Promise.all([
      prisma.species.count({ where }),
      prisma.species.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          species_groups: { select: { id: true, name: true, slug: true } },
          conservation_statuses: { select: { id: true, code: true, name: true } },
          ocean_zones: { select: { id: true, name: true } },
          species_media: {
            where: { is_primary: true },
            select: { url: true, caption: true },
            take: 1,
          },
        },
      }),
    ]);

    const formatted = speciesList.map((s) => ({
      id: s.id.toString(),
      code: s.code,
      commonName: s.common_name,
      scientificName: s.scientificName,
      slug: s.slug,
      description: s.description || "",
      group: s.species_groups
        ? {
            id: s.species_groups.id.toString(),
            name: s.species_groups.name,
            slug: s.species_groups.slug,
          }
        : null,
      conservationStatus: s.conservation_statuses ? s.conservation_statuses.code : null,
      vietnamRedListStatus: s.vietnam_red_list_status,
      vietnamProtectionGroup: s.vietnam_protection_group,
      citesAppendix: s.cites_appendix,
      eastSeaZone: s.east_sea_zone,
      localDistribution: s.local_distribution,
      oceanZone: s.ocean_zones ? s.ocean_zones.name : null,
      depthMin: s.depth_min_m,
      depthMax: s.depth_max_m,
      sizeMinCm: s.size_min_cm ? Number(s.size_min_cm) : null,
      sizeMaxCm: s.size_max_cm ? Number(s.size_max_cm) : null,
      weightMinKg: s.weight_min_kg ? Number(s.weight_min_kg) : null,
      weightMaxKg: s.weight_max_kg ? Number(s.weight_max_kg) : null,
      lifespanYears: s.lifespan_years,
      diet: s.diet,
      image: s.species_media?.[0]?.url || "",
      viewCount: Number(s.view_count || 0),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách sinh vật:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:id/anatomy - Lấy danh sách bộ phận giải phẫu sinh vật
router.get("/:id/anatomy", async (req, res) => {
  try {
    const { default: anatomyController } = await import("../controller/anatomyController.js");
    return anatomyController.getAnatomyBySpecies(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug/related - Lấy tối đa 4 loài sinh vật tương tự thực tế (cùng nhóm / cùng tầng nước)
router.get("/:idOrSlug/related", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    const isNum = /^\d+$/.test(targetSlug);

    const current = isNum
      ? await prisma.species.findUnique({
          where: { id: BigInt(targetSlug) },
          select: { id: true, group_id: true, ocean_zone_id: true, scientificName: true },
        })
      : await prisma.species.findFirst({
          where: { OR: [{ slug: targetSlug }, { slug: idOrSlug }, { code: idOrSlug }], deleted_at: null },
          select: { id: true, group_id: true, ocean_zone_id: true, scientificName: true },
        });

    if (!current) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sinh vật" });
    }

    const includeCfg = {
      species_groups: true,
      conservation_statuses: true,
      ocean_zones: true,
      species_media: {
        where: { type: "image" },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }, { id: "asc" }],
        take: 2,
      },
    };

    const baseNot = {
      deleted_at: null,
      id: { not: current.id },
      scientificName: { not: current.scientificName },
      species_media: { some: { type: "image" } },
    };

    // Truy vấn theo mức độ tương đồng: cùng nhóm & tầng -> cùng nhóm -> cùng tầng
    const [sameGroupAndZone, sameGroup, sameZone] = await Promise.all([
      current.group_id && current.ocean_zone_id
        ? prisma.species.findMany({
            where: { ...baseNot, group_id: current.group_id, ocean_zone_id: current.ocean_zone_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
      current.group_id
        ? prisma.species.findMany({
            where: { ...baseNot, group_id: current.group_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
      current.ocean_zone_id
        ? prisma.species.findMany({
            where: { ...baseNot, ocean_zone_id: current.ocean_zone_id },
            include: includeCfg,
            take: 8,
            orderBy: { view_count: "desc" },
          })
        : [],
    ]);

    const seenIds = new Set();
    const seenSciNames = new Set([String(current.scientificName || "").toLowerCase()]);
    const seenImages = new Set();
    const picked = [];

    for (const candidate of [...sameGroupAndZone, ...sameGroup, ...sameZone]) {
      const sid = candidate.id.toString();
      const sciLower = String(candidate.scientificName || "").toLowerCase();
      const imgUrl = candidate.species_media?.[0]?.url || null;

      if (!imgUrl || seenIds.has(sid) || seenSciNames.has(sciLower) || seenImages.has(imgUrl)) {
        continue;
      }
      seenIds.add(sid);
      seenSciNames.add(sciLower);
      seenImages.add(imgUrl);
      picked.push(candidate);
      if (picked.length >= 4) break;
    }

    return res.status(200).json({
      success: true,
      data: picked.map((sp) => ({
        id: sp.id.toString(),
        slug: sp.slug,
        commonName: sp.common_name,
        scientificName: sp.scientificName,
        image: sp.species_media?.[0]?.url || null,
        group: sp.species_groups
          ? { id: sp.species_groups.id.toString(), name: sp.species_groups.name, slug: sp.species_groups.slug }
          : null,
        oceanZone: sp.ocean_zones ? { id: sp.ocean_zones.id, name: sp.ocean_zones.name } : null,
        sizeMinCm: sp.size_min_cm,
        sizeMaxCm: sp.size_max_cm,
        depthMinM: sp.depth_min_m,
        depthMaxM: sp.depth_max_m,
        conservationStatus: sp.conservation_statuses
          ? { id: sp.conservation_statuses.id, code: sp.conservation_statuses.code, name: sp.conservation_statuses.name }
          : null,
        vietnamRedListStatus: sp.vietnam_red_list_status,
      })),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách sinh vật tương tự:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/species/:idOrSlug - Chi tiết một loài sinh vật biển
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { default: prisma } = await import("../lib/prisma.js");

    const targetSlug = resolveSpeciesSlug(idOrSlug);
    let species = null;
    const isNum = /^\d+$/.test(targetSlug);

    if (isNum) {
      species = await prisma.species.findUnique({
        where: { id: BigInt(targetSlug) },
        include: {
          species_groups: true,
          conservation_statuses: true,
          ocean_zones: true,
          species_media: true,
          species_facts: true,
        },
      });
    }

    if (!species) {
      species = await prisma.species.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { slug: idOrSlug },
            { code: idOrSlug },
            { common_name: { equals: idOrSlug, mode: "insensitive" } },
            { slug: { contains: idOrSlug, mode: "insensitive" } },
            { scientificName: { contains: idOrSlug, mode: "insensitive" } },
          ],
        },
        include: {
          species_groups: true,
          conservation_statuses: true,
          ocean_zones: true,
          species_media: true,
          species_facts: true,
        },
      });
    }

    if (!species) {
      return res.status(404).json({ success: false, message: "Không tìm thấy loài sinh vật" });
    }

    const taxonomy = await taxonomyService.getTaxonHierarchy(
      species.source_api_id,
      species.scientificName
    );

    return res.status(200).json({
      success: true,
      data: {
        id: species.id.toString(),
        code: species.code,
        commonName: species.common_name,
        scientificName: species.scientificName,
        slug: species.slug,
        description: species.description,
        diet: species.diet,
        sizeMinCm: species.size_min_cm,
        sizeMaxCm: species.size_max_cm,
        weightMinKg: species.weight_min_kg,
        weightMaxKg: species.weight_max_kg,
        depthMinM: species.depth_min_m,
        depthMaxM: species.depth_max_m,
        temperatureMinC: species.temperature_min_c,
        temperatureMaxC: species.temperature_max_c,
        lifespanYears: species.lifespan_years,
        sourceApiId: species.source_api_id,
        taxonomy,
        vietnamRedListStatus: species.vietnam_red_list_status,
        vietnamProtectionGroup: species.vietnam_protection_group,
        citesAppendix: species.cites_appendix,
        eastSeaZone: species.east_sea_zone,
        localDistribution: species.local_distribution,
        group: species.species_groups
          ? { id: species.species_groups.id.toString(), name: species.species_groups.name, slug: species.species_groups.slug }
          : null,
        conservationStatus: species.conservation_statuses
          ? { id: species.conservation_statuses.id, code: species.conservation_statuses.code, name: species.conservation_statuses.name }
          : null,
        oceanZone: species.ocean_zones
          ? { id: species.ocean_zones.id, name: species.ocean_zones.name }
          : null,
        media: species.species_media.map((m) => ({
          id: m.id.toString(),
          type: m.type,
          url: m.url,
          caption: m.caption,
          isPrimary: m.is_primary,
        })),
        facts: species.species_facts.map((f) => ({
          id: f.id.toString(),
          content: f.content,
        })),
        viewCount: Number(species.view_count || 0),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết loài:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

