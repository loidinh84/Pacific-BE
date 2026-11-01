import prisma from "../lib/prisma.js";

class NewsController {
  /**
   * GET /api/news
   * Lấy danh sách bài viết đã xuất bản có phân trang, lọc và tìm kiếm
   */
  async getNews(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
      const skip = (page - 1) * limit;

      const { category, search, lang, source_type } = req.query;

      const where = {
        status: "published",
        deleted_at: null,
      };

      // Lọc theo ngôn ngữ
      if (lang) {
        where.language = lang;
      }

      // Lọc theo loại nguồn (internal / external)
      if (source_type && ["internal", "external"].includes(source_type)) {
        where.source_type = source_type;
      }

      // Lọc theo chuyên mục (slug)
      if (category && category !== "all") {
        where.category = {
          slug: category,
          is_active: true,
        };
      }

      // Tìm kiếm theo từ khóa trong tiêu đề, tóm tắt hoặc slug (hỗ trợ cả gõ không dấu)
      if (search && search.trim()) {
        const keyword = search.trim();
        const slugKeyword = keyword
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        where.OR = [
          { title: { contains: keyword, mode: "insensitive" } },
          { excerpt: { contains: keyword, mode: "insensitive" } },
          ...(slugKeyword ? [{ slug: { contains: slugKeyword, mode: "insensitive" } }] : []),
        ];
      }

      // Đếm tổng số bài viết thỏa điều kiện
      const total = await prisma.news_articles.count({ where });

      // Lấy danh sách bài viết
      const articles = await prisma.news_articles.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { published_at: "desc" },
          { created_at: "desc" },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          cover_url: true,
          cover_caption: true,
          language: true,
          source_type: true,
          external_url: true,
          is_featured: true,
          view_count: true,
          published_at: true,
          created_at: true,
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
              logo_url: true,
            },
          },
          author: {
            select: {
              id: true,
              full_name: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: articles,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách tin tức:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách tin tức",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/news/featured
   * Lấy danh sách bài viết nổi bật cho banner/carousel
   */
  async getFeaturedNews(req, res) {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 10);

      const articles = await prisma.news_articles.findMany({
        where: {
          status: "published",
          is_featured: true,
          deleted_at: null,
        },
        take: limit,
        orderBy: [
          { published_at: "desc" },
          { created_at: "desc" },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          cover_url: true,
          cover_caption: true,
          language: true,
          source_type: true,
          external_url: true,
          is_featured: true,
          view_count: true,
          published_at: true,
          created_at: true,
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
              logo_url: true,
            },
          },
          author: {
            select: {
              id: true,
              full_name: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: articles,
      });
    } catch (error) {
      console.error("Lỗi khi lấy tin nổi bật:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách tin nổi bật",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/news/categories
   * Lấy danh sách chuyên mục kèm số lượng bài viết đã xuất bản
   */
  async getCategories(req, res) {
    try {
      const categories = await prisma.news_categories.findMany({
        where: { is_active: true },
        orderBy: [
          { sort_order: "asc" },
          { id: "asc" },
        ],
        include: {
          _count: {
            select: {
              articles: {
                where: {
                  status: "published",
                  deleted_at: null,
                },
              },
            },
          },
        },
      });

      const formatted = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        sort_order: cat.sort_order,
        article_count: cat._count.articles,
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh mục tin tức:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách danh mục tin tức",
        error: error.message,
      });
    }
  }

  /**
   * GET /api/news/:slug
   * Lấy chi tiết 1 bài viết theo slug, tự động tăng lượt xem và lấy bài viết liên quan
   */
  async getNewsBySlug(req, res) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp slug bài viết",
        });
      }

      // Tìm bài viết theo slug hoặc id
      const isNumeric = /^\d+$/.test(slug);
      const article = await prisma.news_articles.findFirst({
        where: {
          OR: [
            { slug },
            ...(isNumeric ? [{ id: BigInt(slug) }] : []),
          ],
          deleted_at: null,
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
              logo_url: true,
            },
          },
          author: {
            select: {
              id: true,
              full_name: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      });

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết yêu cầu",
        });
      }

      // Tự động tăng lượt xem (atomic increment)
      await prisma.news_articles.update({
        where: { id: article.id },
        data: {
          view_count: {
            increment: 1n,
          },
        },
      });
      article.view_count = (article.view_count || 0n) + 1n;

      // Lấy tối đa 3 bài viết liên quan cùng chuyên mục
      let relatedArticles = [];
      if (article.category_id) {
        relatedArticles = await prisma.news_articles.findMany({
          where: {
            category_id: article.category_id,
            status: "published",
            deleted_at: null,
            id: { not: article.id },
          },
          take: 3,
          orderBy: [
            { published_at: "desc" },
            { created_at: "desc" },
          ],
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            cover_url: true,
            cover_caption: true,
            language: true,
            source_type: true,
            external_url: true,
            view_count: true,
            published_at: true,
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
                logo_url: true,
              },
            },
            author: {
              select: {
                id: true,
                full_name: true,
                username: true,
                avatar_url: true,
              },
            },
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: article,
        related_articles: relatedArticles,
      });
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết bài viết:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy chi tiết bài viết",
        error: error.message,
      });
    }
  }
}

export default new NewsController();
