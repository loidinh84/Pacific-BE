import prisma from "../src/lib/prisma.js";

async function addMolaMola() {
  console.log("🐟 Đang kiểm tra và bổ sung Cá Mặt Trăng (Mola mola)...");

  const existing = await prisma.species.findFirst({
    where: {
      OR: [
        { slug: "ca-mat-trang-mola-mola" },
        { scientificName: "Mola mola" },
      ],
    },
  });

  if (existing) {
    console.log("✅ Cá Mặt Trăng đã tồn tại trong database (ID:", existing.id, ")");
    return;
  }

  // Lấy nhóm cá biển
  const group = await prisma.species_groups.findFirst({
    where: { name: { contains: "Cá" } },
  });

  // Lấy trạng thái bảo tồn
  const status = await prisma.conservation_statuses.findFirst({
    where: { code: "VU" },
  });

  const created = await prisma.species.create({
    data: {
      code: "FSH-VU-0036",
      common_name: "Cá Mặt Trăng (Cá mặt trời / Mola mola)",
      scientificName: "Mola mola",
      slug: "ca-mat-trang-mola-mola",
      group_id: group ? group.id : 1,
      conservation_status_id: status ? status.id : 3,
      vietnam_red_list_status: "VU",
      vietnam_protection_group: "Nhóm II - Hạn chế khai thác",
      east_sea_zone: "Vùng biển khơi Trung Bộ & Hoàng Sa",
      local_distribution: "Vùng biển xa bờ Nghệ An, Quảng Bình, Thừa Thiên Huế, Bình Định và quần đảo Hoàng Sa",
      description: "Cá mặt trăng (Mola mola) là loài cá xương lớn nhất thế giới, nổi tiếng với thân hình tròn dẹt đặc trưng như một chiếc đĩa khổng lồ, cụt đuôi và thường bơi nghiêng phơi mình dưới ánh nắng tầng mặt.",
      diet: "Thức ăn chính là sứa biển, động vật phù du và mực nhỏ.",
      depth_min_m: 0,
      depth_max_m: 600,
      ocean_zone_id: 1,
      size_min_cm: 180,
      size_max_cm: 330,
      weight_min_kg: 500,
      weight_max_kg: 2000,
      lifespan_years: 25,
      is_visible: true,
      species_media: {
        create: [
          {
            type: "image",
            url: "https://upload.wikimedia.org/wikipedia/commons/8/84/Mola_mola.jpg",
            is_primary: true,
            caption: "Cá Mặt Trăng (Mola mola) bơi tại vùng biển khơi Biển Đông",
          },
        ],
      },
    },
  });

  console.log("🎉 Đã thêm thành công Cá Mặt Trăng vào database với ID:", created.id);
}

addMolaMola()
  .catch((e) => console.error("Lỗi khi thêm:", e))
  .finally(() => prisma.$disconnect());
