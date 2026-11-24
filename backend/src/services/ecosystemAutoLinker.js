import prisma from "../lib/prisma.js";

/**
 * ecosystemAutoLinker.js
 * Hệ thống tự động suy luận và thiết lập mắt xích sinh thái học (Food Web Auto-Linker)
 * Tự động phân tích chế độ ăn (diet), tập tính, độ sâu và sinh cảnh để tạo liên kết
 * mà không cần phải viết code tay thủ công cho từng sinh vật.
 */

// Hàm chuẩn hóa chuỗi tiếng Việt không dấu để so khớp
function normalizeStr(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

export class EcosystemAutoLinker {
  /**
   * Suy luận các liên kết sinh thái khả dĩ cho một loài dựa trên hồ sơ sinh học
   * @param {Object} sp - Loài cần suy luận
   * @param {Array} allSpecies - Danh sách tất cả các loài trong hệ thống
   * @returns {Array} Danh sách các liên kết { sourceId, targetId, type, description, strength, ecologicalImpact }
   */
  inferRelationships(sp, allSpecies) {
    const relationships = [];
    const spId = sp.id.toString();
    const gId = Number(sp.group_id || 1);
    const diet = normalizeStr(sp.diet || "");
    const desc = normalizeStr(sp.description || "");
    const name = normalizeStr(sp.common_name || "");
    const depthMin = sp.depth_min_m ?? 0;
    const depthMax = sp.depth_max_m ?? 100;
    const sizeMax = Number(sp.size_max_cm || 30);

    // Tập hợp ID đã liên kết để tránh trùng lặp
    const linkedTargets = new Set();

    // Hệ số dung sai độ sâu: ở tầng biển sâu (> 200m) khoảng cách sinh cảnh rộng hơn rất nhiều
    const isDeepSeaSp = gId === 6 || depthMin >= 200 || depthMax >= 500;
    const depthTolerance = isDeepSeaSp ? 800 : 60;

    // ─── 1. SUY LUẬN CON MỒI / NGUỒN THỨC ĂN (sp là kẻ săn/tiêu thụ, candidate là thức ăn) ───
    for (const other of allSpecies) {
      const otherId = other.id.toString();
      if (otherId === spId || linkedTargets.has(otherId)) continue;

      const otherGId = Number(other.group_id || 1);
      const otherName = normalizeStr(other.common_name || "");
      const otherDesc = normalizeStr(other.description || "");
      const otherDepthMin = other.depth_min_m ?? 0;
      const otherDepthMax = other.depth_max_m ?? 100;
      const otherSize = Number(other.size_max_cm || 20);

      // Điều kiện độ sâu: Hai loài phải có tầng nước tương thích
      const depthOverlap = Math.max(depthMin, otherDepthMin) <= Math.min(depthMax, otherDepthMax) + depthTolerance;
      if (!depthOverlap) continue;

      // A. Ăn thực vật / Rong / Tảo / Cỏ biển (Herbivory)
      const isHerbivoreDiet =
        diet.includes("tao") ||
        diet.includes("rong") ||
        diet.includes("co bien") ||
        diet.includes("thuc vat") ||
        diet.includes("co xoan");

      if (isHerbivoreDiet && otherGId === 5) {
        relationships.push({
          source_species_id: BigInt(sp.id),
          target_species_id: BigInt(other.id),
          relationship_type: "herbivory",
          description: `${sp.common_name} gặm tỉa và tiêu thụ ${other.common_name} làm nguồn năng lượng dinh dưỡng sơ cấp.`,
          strength: 0.9,
          ecological_impact: `Hạn chế sự phát triển quá mức của rong tảo, giúp hệ sinh thái rạn và đáy biển thông thoáng.`,
        });
        linkedTargets.add(otherId);
        continue;
      }

      // B. Ăn Động vật không xương sống / Giáp xác / Thân mềm (Mollusks / Crustaceans)
      const eatsInvertebrates =
        diet.includes("cua") ||
        diet.includes("tom") ||
        diet.includes("giap xac") ||
        diet.includes("oc") ||
        diet.includes("so") ||
        diet.includes("than mem") ||
        diet.includes("muc") ||
        diet.includes("bach tuoc") ||
        diet.includes("nhim bien") ||
        diet.includes("nhuyen the") ||
        diet.includes("sao bien");

      if (eatsInvertebrates && (otherGId === 4 || (otherGId === 6 && (otherName.includes("tom") || otherName.includes("cua") || otherName.includes("muc"))))) {
        // Kiểm tra khớp từ khóa cụ thể
        const matchesSpecific =
          (diet.includes("cua") && (otherName.includes("cua") || otherDesc.includes("cua"))) ||
          (diet.includes("tom") && (otherName.includes("tom") || otherDesc.includes("tom"))) ||
          (diet.includes("muc") && (otherName.includes("muc") || otherDesc.includes("muc"))) ||
          (diet.includes("oc") && (otherName.includes("oc") || otherDesc.includes("oc"))) ||
          (diet.includes("nhim") && otherName.includes("nhim")) ||
          (diet.includes("sao bien") && otherName.includes("sao bien")) ||
          diet.includes("nhuyen the") ||
          diet.includes("giap xac");

        if (matchesSpecific || (eatsInvertebrates && otherSize < sizeMax * 0.9)) {
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(other.id),
            relationship_type: "predator_prey",
            description: `${sp.common_name} săn bắt ${other.common_name} tại tầng nước ${Math.max(depthMin, otherDepthMin)}m - ${Math.min(depthMax, otherDepthMax)}m.`,
            strength: 0.85,
            ecological_impact: `Kiểm soát mật độ quần thể động vật không xương sống, duy trì cân bằng chuỗi thức ăn.`,
          });
          linkedTargets.add(otherId);
          continue;
        }
      }

      // C. Ăn Cá / Cá nhỏ / Lươn / Cá chình (Piscivory)
      const eatsFish =
        diet.includes("ca") ||
        diet.includes("luon") ||
        diet.includes("chinh") ||
        diet.includes("moi") ||
        diet.includes("dong vat phu du") ||
        diet.includes("sinh vat phu du");

      if (eatsFish && otherGId === 1 && otherSize < sizeMax * 0.85) {
        relationships.push({
          source_species_id: BigInt(sp.id),
          target_species_id: BigInt(other.id),
          relationship_type: "predator_prey",
          description: `${sp.common_name} săn bắt ${other.common_name} làm nguồn thức ăn cung cấp năng lượng sinh khối.`,
          strength: 0.88,
          ecological_impact: `Điều hòa số lượng đàn cá tầng nước, duy trì cân bằng tháp dinh dưỡng.`,
        });
        linkedTargets.add(otherId);
        continue;
      }

      // D. Động vật ăn thịt đỉnh bảng (Apex Predators: Cá mập, Cá voi sát thủ, Cá sấu nước mặn)
      const isApex =
        name.includes("ca map") ||
        name.includes("ca nham") ||
        name.includes("sat thu") ||
        name.includes("ho kinh") ||
        name.includes("ca sau");

      if (isApex) {
        const canPreyOn =
          (otherGId === 1 && otherSize < sizeMax) ||
          (otherGId === 3 && otherSize < sizeMax) ||
          (otherGId === 2 && sizeMax >= 400 && otherSize < sizeMax * 0.8) ||
          (name.includes("ca sau") && (otherName.includes("rua") || otherGId === 1));

        if (canPreyOn) {
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(other.id),
            relationship_type: "predator_prey",
            description: `${sp.common_name} săn mồi đỉnh bảng, kiểm soát số lượng quần thể ${other.common_name}.`,
            strength: 0.95,
            ecological_impact: `Điều hòa cấu trúc quần xã từ trên xuống (Top-down control), giữ hệ sinh thái khỏe mạnh.`,
          });
          linkedTargets.add(otherId);
          continue;
        }
      }

      // E. Sinh vật biển sâu ăn mùn bã / xác động vật chìm / tuyết biển (Deep Sea Scavengers)
      const isScavenger =
        diet.includes("xac") ||
        diet.includes("tuyet bien") ||
        diet.includes("mun ba") ||
        diet.includes("loc vi khuan");

      if (isScavenger && otherGId === 6 && otherDepthMax >= 200) {
        relationships.push({
          source_species_id: BigInt(sp.id),
          target_species_id: BigInt(other.id),
          relationship_type: "commensalism",
          description: `${sp.common_name} và ${other.common_name} đồng hiện diện, tái chế sinh khối hữu cơ tại đáy biển sâu.`,
          strength: 0.8,
          ecological_impact: `Thúc đẩy tuần hoàn vật chất và dòng năng lượng ở tầng đáy thiếu hụt ánh sáng mặt trời.`,
        });
        linkedTargets.add(otherId);
        continue;
      }
    }

    // ─── 2. SUY LUẬN THIÊN ĐỊCH (candidate là kẻ săn, sp là con mồi) ───
    const isApexSp =
      name.includes("ca map") ||
      name.includes("ca nham") ||
      name.includes("sat thu") ||
      name.includes("ho kinh") ||
      (gId === 2 && sizeMax > 300);

    // Chỉ tìm thiên địch nếu loài hiện tại không phải là đỉnh bảng
    if (!isApexSp) {
      for (const predator of allSpecies) {
        const predId = predator.id.toString();
        if (predId === spId || linkedTargets.has(predId)) continue;

        const predGId = Number(predator.group_id || 1);
        const predDiet = normalizeStr(predator.diet || "");
        const predName = normalizeStr(predator.common_name || "");
        const predSize = Number(predator.size_max_cm || 50);
        const predDepthMin = predator.depth_min_m ?? 0;
        const predDepthMax = predator.depth_max_m ?? 100;

        const depthOverlap = Math.max(depthMin, predDepthMin) <= Math.min(depthMax, predDepthMax) + 40;
        if (!depthOverlap) continue;

        // Nếu sp là thân mềm/giáp xác (Group 4) và pred thích ăn thân mềm/giáp xác
        if (gId === 4 && (predDiet.includes("giap xac") || predDiet.includes("cua") || predDiet.includes("tom") || predDiet.includes("than mem") || predDiet.includes("muc"))) {
          relationships.push({
            source_species_id: BigInt(predator.id),
            target_species_id: BigInt(sp.id),
            relationship_type: "predator_prey",
            description: `${predator.common_name} săn bắt ${sp.common_name} làm thức ăn.`,
            strength: 0.85,
            ecological_impact: `Khống chế mật độ sinh khối động vật đáy.`,
          });
          linkedTargets.add(predId);
          if (relationships.filter(r => r.target_species_id === BigInt(sp.id)).length >= 3) break;
          continue;
        }

        // Nếu sp là cá nhỏ (Group 1, size < 40) và pred là cá ăn thịt lớn
        if (gId === 1 && sizeMax < 40 && predSize > sizeMax * 1.5 && (predGId === 1 || predGId === 2)) {
          if (predName.includes("map") || predName.includes("ngu") || predName.includes("mu") || predName.includes("thu") || predName.includes("heo")) {
            relationships.push({
              source_species_id: BigInt(predator.id),
              target_species_id: BigInt(sp.id),
              relationship_type: "predator_prey",
              description: `${predator.common_name} săn bắt đàn cá ${sp.common_name}.`,
              strength: 0.88,
              ecological_impact: `Chuyển hóa năng lượng từ cá rạn nhỏ lên các loài cá dữ biển khơi.`,
            });
            linkedTargets.add(predId);
            if (relationships.filter(r => r.target_species_id === BigInt(sp.id)).length >= 3) break;
            continue;
          }
        }
      }
    }

    // ─── 3. SUY LUẬN SINH CẢNH & CỘNG SINH (Habitat / Symbiosis) ───
    // Nếu sp là San hô / Cỏ biển (Group 5) -> Kiến tạo sinh cảnh cho cá con
    if (gId === 5) {
      for (const smallFauna of allSpecies) {
        const faunaId = smallFauna.id.toString();
        if (faunaId === spId || linkedTargets.has(faunaId)) continue;
        const faunaGId = Number(smallFauna.group_id || 1);
        const faunaSize = Number(smallFauna.size_max_cm || 30);

        if ((faunaGId === 1 && faunaSize < 30) || faunaGId === 4) {
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(smallFauna.id),
            relationship_type: "habitat_provider",
            description: `${sp.common_name} cung cấp nền giá thể và bãi ươm giống an toàn cho ${smallFauna.common_name}.`,
            strength: 0.92,
            ecological_impact: `Tăng tỷ lệ sống sót của ấu trùng và cá rạn non, gia tăng đa dạng sinh học biển.`,
          });
          linkedTargets.add(faunaId);
          if (relationships.filter(r => r.relationship_type === "habitat_provider").length >= 4) break;
        }
      }
    }

    // ─── 4. LỚP ĐẢM BẢO SINH THÁI (UNIVERSAL ECOLOGICAL FALLBACK) ───
    // Nếu sau tất cả các bước trên loài vẫn chưa có bất kỳ liên kết nào,
    // tự động kết nối theo ngách sinh thái và tầng nước để đảm bảo không loài nào bị cô lập.
    if (relationships.length === 0) {
      const candidates = allSpecies
        .filter((o) => o.id.toString() !== spId)
        .map((o) => {
          const oDepthMin = o.depth_min_m ?? 0;
          const oDepthMax = o.depth_max_m ?? 100;
          const diff = Math.abs(depthMin - oDepthMin) + Math.abs(depthMax - oDepthMax);
          return { species: o, diff };
        })
        .sort((a, b) => a.diff - b.diff);

      for (const { species: candidate } of candidates.slice(0, 3)) {
        const cGId = Number(candidate.group_id || 1);
        const cSize = Number(candidate.size_max_cm || 20);

        if (gId === 3) {
          // Bò sát biển: ăn cá nhỏ / giáp xác tầng rạn
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(candidate.id),
            relationship_type: "predator_prey",
            description: `${sp.common_name} săn bắt ${candidate.common_name} tại vùng nước ven đảo và rạn đá.`,
            strength: 0.82,
            ecological_impact: `Kiểm soát sinh khối động vật tầng nước ven rạn san hô.`,
          });
        } else if (gId === 6 || cGId === 6) {
          // Biển sâu: cộng cư / chuỗi thức ăn đáy sâu
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(candidate.id),
            relationship_type: "commensalism",
            description: `${sp.common_name} và ${candidate.common_name} cùng tương tác trong chuỗi chuyển hóa sinh thái đáy biển sâu.`,
            strength: 0.8,
            ecological_impact: `Duy trì mắt xích chuyển hóa dinh dưỡng tầng nước sâu Biển Đông.`,
          });
        } else if (sizeMax >= cSize) {
          relationships.push({
            source_species_id: BigInt(sp.id),
            target_species_id: BigInt(candidate.id),
            relationship_type: "predator_prey",
            description: `${sp.common_name} săn bắt ${candidate.common_name} trong vùng sinh cảnh chung.`,
            strength: 0.8,
            ecological_impact: `Cân bằng chuỗi thức ăn địa phương.`,
          });
        } else {
          relationships.push({
            source_species_id: BigInt(candidate.id),
            target_species_id: BigInt(sp.id),
            relationship_type: "predator_prey",
            description: `${candidate.common_name} săn bắt ${sp.common_name} làm thức ăn.`,
            strength: 0.8,
            ecological_impact: `Chuyển hóa sinh khối lên bậc dinh dưỡng cao hơn.`,
          });
        }
      }
    }

    // Giới hạn số lượng mối liên kết hợp lý cho 1 loài (tối đa 4-6 liên kết) để không bị loãng
    return relationships.slice(0, 6);
  }

  /**
   * Tự động liên kết cho một sinh vật cụ thể vào cơ sở dữ liệu
   */
  async autoLinkSingleSpecies(speciesId) {
    const sp = await prisma.species.findUnique({
      where: { id: BigInt(speciesId) },
    });
    if (!sp) return { success: false, reason: "Không tìm thấy loài" };

    const allSpecies = await prisma.species.findMany({
      select: {
        id: true,
        common_name: true,
        scientificName: true,
        group_id: true,
        diet: true,
        description: true,
        depth_min_m: true,
        depth_max_m: true,
        size_max_cm: true,
        east_sea_zone: true,
      },
    });

    const candidateRels = this.inferRelationships(sp, allSpecies);
    if (candidateRels.length === 0) return { success: true, createdCount: 0 };

    let createdCount = 0;
    for (const rel of candidateRels) {
      // Kiểm tra tránh trùng lặp
      const existing = await prisma.species_relationships.findFirst({
        where: {
          source_species_id: rel.source_species_id,
          target_species_id: rel.target_species_id,
          relationship_type: rel.relationship_type,
        },
      });

      if (!existing) {
        await prisma.species_relationships.create({
          data: rel,
        });
        createdCount++;
      }
    }

    console.log(`[AutoLinker] Đã tự động tạo ${createdCount} mối liên kết cho loài ${sp.common_name} (ID: ${speciesId})`);
    return { success: true, createdCount };
  }

  /**
   * Quét toàn bộ hệ thống và tự động thiết lập liên kết cho tất cả các loài chưa có quan hệ
   */
  async autoLinkAllUnlinkedSpecies() {
    console.log(`[AutoLinker] Bắt đầu quét tự động toàn bộ cơ sở dữ liệu sinh vật biển...`);

    const allSpecies = await prisma.species.findMany({
      select: {
        id: true,
        common_name: true,
        scientificName: true,
        group_id: true,
        diet: true,
        description: true,
        depth_min_m: true,
        depth_max_m: true,
        size_max_cm: true,
        east_sea_zone: true,
      },
    });

    // Lấy tất cả các loài đã có quan hệ
    const existingRels = await prisma.species_relationships.findMany({
      select: { source_species_id: true, target_species_id: true },
    });

    const connectedIds = new Set();
    existingRels.forEach((r) => {
      connectedIds.add(r.source_species_id.toString());
      connectedIds.add(r.target_species_id.toString());
    });

    const unlinkedSpecies = allSpecies.filter((s) => !connectedIds.has(s.id.toString()));
    console.log(`[AutoLinker] Phát hiện ${unlinkedSpecies.length} loài chưa có mắt xích sinh thái.`);

    let totalCreated = 0;
    for (const sp of unlinkedSpecies) {
      const rels = this.inferRelationships(sp, allSpecies);
      for (const rel of rels) {
        const exists = await prisma.species_relationships.findFirst({
          where: {
            source_species_id: rel.source_species_id,
            target_species_id: rel.target_species_id,
            relationship_type: rel.relationship_type,
          },
        });

        if (!exists) {
          await prisma.species_relationships.create({ data: rel });
          totalCreated++;
        }
      }
    }

    console.log(`[AutoLinker] Hoàn tất quét tự động! Đã tạo mới ${totalCreated} mối liên kết sinh thái.`);
    return {
      success: true,
      unlinkedProcessed: unlinkedSpecies.length,
      relationshipsCreated: totalCreated,
    };
  }
}

const ecosystemAutoLinker = new EcosystemAutoLinker();
export default ecosystemAutoLinker;
