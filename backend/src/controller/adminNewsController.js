import prisma from "../lib/prisma.js";
import {
  createSlug,
  parseArticleMetadata,
  serializeArticleContent,
  OFFICIAL_NEWS_SOURCES,
} from "../utils/newsHelper.js";

class AdminNewsController {
  // GET /api/admin/news - Danh sách tin tức có phân trang & lọc
  async getNewsList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      const { search, category_id, status, is_featured, sort_by = "created_at", order = "desc" } = req.query;

      const where = {
        deleted_at: null,
      };

      if (category_id && category_id !== "all") {
        where.category_id = parseInt(category_id, 10);
      }

      if (status && status !== "all") {
        where.status = status;
      }

      if (is_featured === "true") {
        where.is_featured = true;
      } else if (is_featured === "false") {
        where.is_featured = false;
      }

      if (search && search.trim()) {
        const keyword = search.trim();
        where.OR = [
          { title: { contains: keyword, mode: "insensitive" } },
          { excerpt: { contains: keyword, mode: "insensitive" } },
          { slug: { contains: keyword, mode: "insensitive" } },
        ];
      }

      const [total, articles] = await Promise.all([
        prisma.news_articles.count({ where }),
        prisma.news_articles.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sort_by]: order.toLowerCase() === "asc" ? "asc" : "desc",
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
            source: {
              select: {
                id: true,
                name: true,
                slug: true,
                url: true,
              },
            },
            author: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      return res.status(200).json({
        success: true,
        data: articles.map(parseArticleMetadata),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách tin tức admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách tin tức",
        error: error.message,
      });
    }
  }

  // GET /api/admin/news/categories - Danh sách chuyên mục cho dropdown
  async getCategories(req, res) {
    try {
      const categories = await prisma.news_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
      });
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("Lỗi lấy danh mục tin tức admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách chuyên mục",
        error: error.message,
      });
    }
  }

  // GET /api/admin/news/sources - Danh sách nguồn tin chính thống đã kiểm duyệt
  async getSources(req, res) {
    try {
      let sources = await prisma.news_sources.findMany({
        where: { is_active: true },
        orderBy: { name: "asc" },
      });

      // Tự động khởi tạo danh sách nguồn tin chính thống nếu bảng chưa có dữ liệu
      if (sources.length === 0) {
        for (const src of OFFICIAL_NEWS_SOURCES) {
          await prisma.news_sources.upsert({
            where: { slug: src.slug },
            update: { name: src.name, url: src.url, is_active: true },
            create: { name: src.name, slug: src.slug, url: src.url, is_active: true },
          });
        }
        sources = await prisma.news_sources.findMany({
          where: { is_active: true },
          orderBy: { name: "asc" },
        });
      }

      return res.status(200).json({
        success: true,
        data: sources,
      });
    } catch (error) {
      console.error("Lỗi lấy danh sách nguồn tin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách nguồn tin",
        error: error.message,
      });
    }
  }

  // GET /api/admin/news/:id - Chi tiết 1 bài viết
  async getNewsById(req, res) {
    try {
      const id = BigInt(req.params.id);
      const article = await prisma.news_articles.findUnique({
        where: { id },
        include: {
          category: true,
          source: true,
          author: {
            select: {
              id: true,
              username: true,
              full_name: true,
            },
          },
        },
      });

      if (!article || article.deleted_at) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      return res.status(200).json({
        success: true,
        data: parseArticleMetadata(article),
      });
    } catch (error) {
      console.error("Lỗi lấy chi tiết bài viết admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy chi tiết bài viết",
        error: error.message,
      });
    }
  }

  // POST /api/admin/news - Tạo bài viết mới
  async createNews(req, res) {
    try {
      const {
        title,
        slug: userSlug,
        excerpt,
        content,
        cover_url,
        cover_caption,
        category_id,
        status = "draft",
        is_featured = false,
        language = "vi",
        source_type = "internal",
        source_id,
        external_url,
        badge,
        stat_val,
        stat_title,
        gallery,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Tiêu đề bài viết không được để trống",
        });
      }

      if (source_type === "external") {
        if (!source_id) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng chọn nguồn tin chính thống cho bài viết dẫn nguồn bên ngoài",
          });
        }
        if (!external_url || !/^https?:\/\/.+/i.test(external_url.trim())) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập đường dẫn bài báo gốc hợp lệ (bắt đầu bằng https:// hoặc http://)",
          });
        }
      }

      let slug = (userSlug && userSlug.trim()) ? createSlug(userSlug) : createSlug(title);
      if (!slug) slug = `bai-viet-${Date.now()}`;

      // Đảm bảo slug duy nhất
      let uniqueSlug = slug;
      let counter = 1;
      while (await prisma.news_articles.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      const published_at = status === "published" ? new Date() : null;
      const author_id = req.user?.id ? BigInt(req.user.id) : null;

      const finalContent = serializeArticleContent(content, {
        badge,
        stat_val,
        stat_title,
        gallery,
      });

      const created = await prisma.news_articles.create({
        data: {
          title: title.trim(),
          slug: uniqueSlug,
          excerpt: excerpt?.trim() || null,
          content: finalContent ? finalContent.trim() : null,
          cover_url: cover_url?.trim() || null,
          cover_caption: cover_caption?.trim() || null,
          language,
          source_type,
          source_id: source_type === "external" && source_id ? parseInt(source_id, 10) : null,
          external_url: source_type === "external" ? external_url?.trim() || null : null,
          status,
          is_featured: Boolean(is_featured),
          category_id: category_id ? parseInt(category_id, 10) : null,
          author_id,
          published_at,
        },
        include: {
          category: true,
          source: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Tạo bài viết mới thành công",
        data: parseArticleMetadata(created),
      });
    } catch (error) {
      console.error("Lỗi tạo bài viết admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể tạo bài viết mới",
        error: error.message,
      });
    }
  }

  // PUT /api/admin/news/:id - Cập nhật bài viết
  async updateNews(req, res) {
    try {
      const id = BigInt(req.params.id);
      const existing = await prisma.news_articles.findUnique({ where: { id } });

      if (!existing || existing.deleted_at) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết để cập nhật",
        });
      }

      const {
        title,
        slug: userSlug,
        excerpt,
        content,
        cover_url,
        cover_caption,
        category_id,
        status,
        is_featured,
        language,
        source_type,
        source_id,
        external_url,
        badge,
        stat_val,
        stat_title,
        gallery,
      } = req.body;

      if (source_type === "external") {
        if (!source_id) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng chọn nguồn tin chính thống cho bài viết dẫn nguồn bên ngoài",
          });
        }
        if (!external_url || !/^https?:\/\/.+/i.test(external_url.trim())) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập đường dẫn bài báo gốc hợp lệ (bắt đầu bằng https:// hoặc http://)",
          });
        }
      }

      let uniqueSlug = existing.slug;
      if (userSlug && userSlug.trim() && userSlug !== existing.slug) {
        let baseSlug = createSlug(userSlug);
        uniqueSlug = baseSlug;
        let counter = 1;
        while (true) {
          const check = await prisma.news_articles.findUnique({ where: { slug: uniqueSlug } });
          if (!check || check.id === id) break;
          uniqueSlug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      let published_at = existing.published_at;
      if (status === "published" && !published_at) {
        published_at = new Date();
      }

      let finalContent;
      if (
        content !== undefined ||
        badge !== undefined ||
        stat_val !== undefined ||
        stat_title !== undefined ||
        gallery !== undefined
      ) {
        const existingParsed = parseArticleMetadata(existing);
        const rawContent = content !== undefined ? content : existingParsed.clean_content;
        const effectiveBadge = badge !== undefined ? badge : existingParsed.badge;
        const effectiveStatVal = stat_val !== undefined ? stat_val : existingParsed.stat_val;
        const effectiveStatTitle = stat_title !== undefined ? stat_title : existingParsed.stat_title;
        const effectiveGallery = gallery !== undefined ? gallery : existingParsed.gallery;

        finalContent = serializeArticleContent(rawContent, {
          badge: effectiveBadge,
          stat_val: effectiveStatVal,
          stat_title: effectiveStatTitle,
          gallery: effectiveGallery,
        });
      }

      const updated = await prisma.news_articles.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          slug: uniqueSlug,
          ...(excerpt !== undefined && { excerpt: excerpt?.trim() || null }),
          ...(finalContent !== undefined && { content: finalContent ? finalContent.trim() : null }),
          ...(cover_url !== undefined && { cover_url: cover_url?.trim() || null }),
          ...(cover_caption !== undefined && { cover_caption: cover_caption?.trim() || null }),
          ...(category_id !== undefined && {
            category_id: category_id ? parseInt(category_id, 10) : null,
          }),
          ...(status !== undefined && { status }),
          ...(is_featured !== undefined && { is_featured: Boolean(is_featured) }),
          ...(language !== undefined && { language }),
          ...(source_type !== undefined && { source_type }),
          ...(source_id !== undefined && {
            source_id: source_type === "external" && source_id ? parseInt(source_id, 10) : null,
          }),
          ...(external_url !== undefined && {
            external_url: source_type === "external" ? external_url?.trim() || null : null,
          }),
          published_at,
          updated_at: new Date(),
        },
        include: {
          category: true,
          source: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Cập nhật bài viết thành công",
        data: parseArticleMetadata(updated),
      });
    } catch (error) {
      console.error("Lỗi cập nhật bài viết admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể cập nhật bài viết",
        error: error.message,
      });
    }
  }

  // PATCH /api/admin/news/:id/featured - Bật / tắt ghim nổi bật
  async toggleFeatured(req, res) {
    try {
      const id = BigInt(req.params.id);
      const article = await prisma.news_articles.findUnique({ where: { id } });

      if (!article || article.deleted_at) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      const updated = await prisma.news_articles.update({
        where: { id },
        data: {
          is_featured: !article.is_featured,
          updated_at: new Date(),
        },
        select: {
          id: true,
          title: true,
          is_featured: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: updated.is_featured ? "Đã ghim bài viết nổi bật" : "Đã bỏ ghim bài viết",
        data: updated,
      });
    } catch (error) {
      console.error("Lỗi toggle featured bài viết:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể thay đổi trạng thái nổi bật",
        error: error.message,
      });
    }
  }

  // DELETE /api/admin/news/:id - Xóa bài viết
  async deleteNews(req, res) {
    try {
      const id = BigInt(req.params.id);
      const article = await prisma.news_articles.findUnique({ where: { id } });

      if (!article || article.deleted_at) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      await prisma.news_articles.update({
        where: { id },
        data: {
          deleted_at: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Xóa bài viết thành công",
      });
    } catch (error) {
      console.error("Lỗi xóa bài viết admin:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể xóa bài viết",
        error: error.message,
      });
    }
  }
}

export default new AdminNewsController();

