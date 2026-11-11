/**
 * newsHelper.js
 * Tiện ích xử lý slug, nguồn chính thống và metadata nâng cao cho tin tức & bài viết đại dương
 */

export const OFFICIAL_NEWS_SOURCES = [
  {
    name: "Viện Hải dương học Nha Trang",
    slug: "vien-hai-duong-hoc",
    url: "https://vnio.org.vn",
  },
  {
    name: "WWF Việt Nam",
    slug: "wwf-viet-nam",
    url: "https://vietnam.panda.org",
  },
  {
    name: "Báo Tuổi Trẻ",
    slug: "bao-tuoi-tre",
    url: "https://tuoitre.vn",
  },
  {
    name: "VnExpress Khoa học",
    slug: "vnexpress-khoa-hoc",
    url: "https://vnexpress.net/khoa-hoc",
  },
  {
    name: "National Geographic",
    slug: "national-geographic",
    url: "https://www.nationalgeographic.com",
  },
  {
    name: "NOAA Ocean Service",
    slug: "noaa-ocean-service",
    url: "https://oceanservice.noaa.gov",
  },
  {
    name: "IUCN Red List",
    slug: "iucn-red-list",
    url: "https://www.iucnredlist.org",
  },
];

export function createSlug(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Trích xuất metadata (badge, stat_val, stat_title, gallery) được đóng gói
 * trong nội dung bài viết dưới dạng comment HTML
 */
export function parseArticleMetadata(article) {
  if (!article) return article;

  let badge = null;
  let stat_val = null;
  let stat_title = null;
  let gallery = [];
  let cleanContent = article.content || "";

  // Sửa lại ảnh mẫu bị trỏ nhầm (ảnh lâu đài) thành ảnh rùa biển thật từ kho tài nguyên
  let coverUrl = article.cover_url;
  if (coverUrl && coverUrl.includes("photo-1518709268805-4e9042af9f23")) {
    coverUrl = "http://localhost:3000/uploads/turtle-hatchlings.jpg";
  }

  // Tìm kiếm comment PACIFIC_META
  const match = cleanContent.match(/<!--\s*PACIFIC_META:\s*({[\s\S]*?})\s*-->/);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.badge) badge = meta.badge;
      if (meta.stat_val) stat_val = meta.stat_val;
      if (meta.stat_title) stat_title = meta.stat_title;
      if (Array.isArray(meta.gallery)) {
        gallery = meta.gallery.filter(Boolean);
      }
      cleanContent = cleanContent.replace(match[0], "").trim();
    } catch (e) {
      console.warn("Lỗi phân tích cú pháp PACIFIC_META:", e.message);
    }
  }

  // Dữ liệu mặc định cho 3 bài viết kỳ thú "Có thể bạn chưa biết" đã có sẵn
  const catSlug = article.category?.slug || "";
  const catName = article.category?.name || "";
  const isFunFacts = catSlug === "fun-facts" || catName.includes("chưa biết");

  if (!stat_val && isFunFacts) {
    const slug = article.slug || "";
    const title = article.title || "";
    if (slug.includes("bien-dong") || title.includes("Biển Đông")) {
      badge = badge || "Địa lý";
      stat_val = "3.5 triệu km²";
      stat_title = "DIỆN TÍCH BIỂN ĐÔNG";
    } else if (slug.includes("point-nemo") || title.includes("Point Nemo")) {
      badge = badge || "Bí ẩn";
      stat_val = "2,688 km";
      stat_title = "KHOẢNG CÁCH TỚI ĐẤT LIỀN GẦN NHẤT";
    } else if (slug.includes("vanh-dai-lua") || title.includes("Vành đai Lửa")) {
      badge = badge || "Địa chất";
      stat_val = "90%";
      stat_title = "ĐỘNG ĐẤT MẠNH XẢY RA TẠI ĐÂY";
    }
  }

  // Định dạng thành HTML sạch nếu nội dung hiện tại đang ở dạng văn bản thuần
  let formattedContent = cleanContent;
  if (
    cleanContent &&
    !/<(p|h[1-6]|div|figure|blockquote|ul|ol|img)\b/i.test(cleanContent)
  ) {
    formattedContent = cleanContent
      .split(/\n{2,}/)
      .map((para) => `<p>${para.trim().replace(/\n/g, "<br/>")}</p>`)
      .join("\n");
  }

  return {
    ...article,
    cover_url: coverUrl,
    content: formattedContent,
    clean_content: cleanContent,
    badge,
    stat_val,
    stat_title,
    gallery,
  };
}

/**
 * Đóng gói metadata vào chuỗi content trước khi lưu vào cơ sở dữ liệu
 */
export function serializeArticleContent(rawContent, { badge, stat_val, stat_title, gallery } = {}) {
  let contentWithoutMeta = (rawContent || "").replace(/<!--\s*PACIFIC_META:\s*({[\s\S]*?})\s*-->/g, "").trim();
  const hasMeta = Boolean(
    (badge && String(badge).trim()) ||
    (stat_val && String(stat_val).trim()) ||
    (stat_title && String(stat_title).trim()) ||
    (Array.isArray(gallery) && gallery.length > 0)
  );

  if (!hasMeta) return contentWithoutMeta;

  const metaJson = JSON.stringify({
    badge: badge ? String(badge).trim() : null,
    stat_val: stat_val ? String(stat_val).trim() : null,
    stat_title: stat_title ? String(stat_title).trim() : null,
    gallery: Array.isArray(gallery) ? gallery.filter(Boolean) : [],
  });

  return `<!-- PACIFIC_META: ${metaJson} -->\n${contentWithoutMeta}`;
}
