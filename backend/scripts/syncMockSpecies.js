import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../src/lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = path.resolve(__dirname, "../../../Pacific-FE/frontend/src/mocks/speciesMock.js");

const SLUGS = [
  "ca-map-dau-bua-lon",
  "ca-nham-bao",
  "ca-duoi-o-dai-bang",
  "ca-duoi-dien-thai-binh-duong",
  "ca-mat-quy-san-ho",
  "ca-mao-tien-canh-quat",
  "ca-dao-rang-nhon",
  "ca-buom-yen-ngua",
  "ca-rong-bien-la",
  "ca-he-lua",
  "ca-bap-ne-xanh",
  "ca-ngua-lun-pygmy",
  "ca-phu-thuy-bien-sau",
  "bach-tuoc-dom-xanh-lon",
  "oc-non-dia-ly",
  "sen-bien-tho-bien",
  "sen-bien-vu-cong-tay-ban-nha",
  "cau-gai-lua-hoa-phan",
  "cua-khong-lo-tasmania",
  "hai-quy-tham-san-ho",
];

async function sync() {
  if (!fs.existsSync(MOCK_FILE)) {
    console.error("❌ Không tìm thấy file:", MOCK_FILE);
    return;
  }

  let content = fs.readFileSync(MOCK_FILE, "utf-8");

  const species = await prisma.species.findMany({
    where: { slug: { in: SLUGS } },
    include: {
      species_media: { orderBy: { is_primary: "desc" } },
      species_translations: true,
      conservation_statuses: true,
      species_groups: true,
    },
  });

  const catMap = {
    "ca-bien": { cat: "cartilage-fish", vi: "Cá biển", en: "Marine Fish" },
    "dong-vat-co-vu-bien": { cat: "mammal", vi: "Động vật có vú", en: "Mammals" },
    "bo-sat-bien": { cat: "turtle", vi: "Bò sát biển", en: "Reptiles" },
    "than-mem-khong-xuong-song": { cat: "mollusk", vi: "Thân mềm", en: "Mollusks" },
    "san-ho-thuc-vat-bien": { cat: "shellfish", vi: "San hô & TV biển", en: "Corals & Plants" },
    "sinh-vat-bien-sau": { cat: "cartilage-fish", vi: "Biển sâu", en: "Deep Sea" },
  };

  const targetIndex = content.indexOf("/* Fun Facts Ocean Data */");
  const insertPos = content.lastIndexOf("];", targetIndex);

  let newEntries = "";
  for (const sp of species) {
    if (content.includes(`"${sp.slug}"`) || content.includes(`'${sp.slug}'`)) {
      console.log(`⏩ Đã tồn tại: ${sp.common_name}`);
      continue;
    }

    const trVi = sp.species_translations.find((t) => t.language_code === "vi");
    const trEn = sp.species_translations.find((t) => t.language_code === "en");
    const groupSlug = sp.species_groups?.slug || "ca-bien";
    const cInfo = catMap[groupSlug] || { cat: "bony-fish", vi: "Cá biển", en: "Marine Fish" };
    const statusCode = sp.conservation_statuses?.code || "LC";
    const statusType = ["CR", "EN"].includes(statusCode)
      ? "danger"
      : ["VU", "NT"].includes(statusCode)
      ? "warning"
      : "safe";

    const mediaUrls = sp.species_media.map((m) => m.url);
    const mainImg = mediaUrls[0] || "";

    newEntries += `  {
    id: "${sp.slug}",
    slug: "${sp.slug}",
    category: "${cInfo.cat}",
    categoryVi: "${cInfo.vi}",
    categoryEn: "${cInfo.en}",
    statusVi: "${sp.conservation_statuses?.name_vi || statusCode}",
    statusEn: "${sp.conservation_statuses?.name_en || statusCode}",
    statusType: "${statusType}",
    nameVi: "${sp.common_name}",
    nameEn: "${trEn?.common_name || sp.common_name}",
    sciName: "${sp.scientificName}",
    descVi: "${(trVi?.description || sp.description || "").slice(0, 180)}...",
    descEn: "${(trEn?.description || "").slice(0, 180)}...",
    depth: "${sp.depth_min_m ?? 0} - ${sp.depth_max_m ?? 50}m",
    size: "${sp.size_min_cm ?? 0}cm - ${sp.size_max_cm ?? 0}cm",
    sizeEn: "${sp.size_min_cm ?? 0}cm - ${sp.size_max_cm ?? 0}cm",
    image: "${mainImg}",
    gallery: ${JSON.stringify(mediaUrls, null, 6)},
    isFeatured: false,
  },
`;
  }

  if (newEntries) {
    content = content.slice(0, insertPos) + newEntries + content.slice(insertPos);
    fs.writeFileSync(MOCK_FILE, content, "utf-8");
    console.log("✅ Đã ghi thành công các loài mới vào speciesMock.js!");
  } else {
    console.log("ℹ️ Tất cả loài đã có trong speciesMock.js.");
  }

  await prisma.$disconnect();
}

sync();

