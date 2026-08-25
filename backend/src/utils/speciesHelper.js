/**
 * @param {string|null} groupSlugOrName 
 * @returns {string} 
 */
export function getGroupPrefix(groupSlugOrName) {
  if (!groupSlugOrName || typeof groupSlugOrName !== "string") {
    return "SPC";
  }

  const str = groupSlugOrName.toLowerCase().trim();

  if (str.includes("ca") || str.includes("fish")) return "FSH";
  if (str.includes("vinh") || str.includes("vu") || str.includes("mam") || str.includes("voi") || str.includes("heo")) return "MAM";
  if (str.includes("rua") || str.includes("san") || str.includes("rep") || str.includes("bat")) return "REP";
  if (str.includes("than mem") || str.includes("khong xuong") || str.includes("inv") || str.includes("bach tuoc") || str.includes("sua") || str.includes("cua") || str.includes("tom")) return "INV";
  if (str.includes("thuc vat") || str.includes("tao") || str.includes("co") || str.includes("pln") || str.includes("plant")) return "PLN";

  const clean = str.replace(/[^a-z0-9]/g, "").toUpperCase();
  return clean.length >= 3 ? clean.substring(0, 3) : "SPC";
}

/**
 * Sinh mã sinh vật chuẩn [GROUP]-[STATUS]-[NUMBER] (Ví dụ: FSH-VU-0001, MAM-CR-0002)
 * @param {string|null} lastCode - Mã sinh vật mới nhất trong DB
 * @param {string} [groupPrefix="SPC"] - Mã nhóm sinh vật (VD: FSH, MAM, REP, INV, PLN)
 * @param {string} [statusPrefix="NE"] - Mã trạng thái bảo tồn (VD: CR, EN, VU, LC, DD, NE)
 * @returns {string} Mã mới (Ví dụ: FSH-VU-0001)
 */
export function generateNextSpeciesCode(lastCode, groupPrefix = "SPC", statusPrefix = "NE") {
  const group = (groupPrefix || "SPC").toUpperCase().trim();
  const status = (statusPrefix || "NE").toUpperCase().trim();
  const prefix = `${group}-${status}`;

  if (!lastCode || typeof lastCode !== "string") {
    return `${prefix}-0001`;
  }

  // Tìm dãy số nguyên ở cuối chuỗi mã
  const match = lastCode.match(/(\d+)$/);
  if (!match) {
    return `${prefix}-0001`;
  }

  const currentNum = parseInt(match[1], 10);
  const nextNum = currentNum + 1;
  const paddedNum = String(nextNum).padStart(4, "0");

  return `${prefix}-${paddedNum}`;
}

/**
 * Tạo slug chuẩn URL từ chuỗi văn bản
 * @param {string} text 
 * @returns {string}
 */
export function generateSlug(text) {
  if (!text) return "";
  
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Xóa dấu tiếng Việt
    .toLowerCase()
    .trim()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9 -]/g, "") // Bỏ ký tự đặc biệt
    .replace(/\s+/g, "-") // Thay khoảng trắng bằng dấu gạch ngang
    .replace(/-+/g, "-"); // Bỏ gạch ngang trùng lặp
}
