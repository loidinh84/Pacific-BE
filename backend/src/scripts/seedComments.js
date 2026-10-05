import prisma from "../lib/prisma.js";

async function seedComments() {
  console.log("Checking database for comments...");
  const count = await prisma.comments.count();
  if (count > 0) {
    console.log(`Database already has ${count} comments. Skipping seed.`);
    process.exit(0);
  }

  // Lấy các user và loài sinh vật sẵn có
  const users = await prisma.user.findMany({ take: 5 });
  const speciesList = await prisma.species.findMany({ take: 5 });

  if (!users.length || !speciesList.length) {
    console.log("Not enough users or species to seed comments.");
    process.exit(0);
  }

  const userA = users[0];
  const userB = users[1] || users[0];
  const userC = users[2] || users[0];
  const sp1 = speciesList[0];
  const sp2 = speciesList[1] || speciesList[0];

  console.log(`Seeding sample comments for testing Figma mockup matching...`);

  // 1. Bình luận bình thường
  const normalComment1 = await prisma.comments.create({
    data: {
      user_id: userA.id,
      species_id: sp1.id,
      content: "Không ngờ loài này có thể sống đến 70 năm! Thông tin này thật sự rất bổ ích cho tôi. Cảm ơn trang Pacific",
      status: "visible",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });

  const normalComment2 = await prisma.comments.create({
    data: {
      user_id: userB.id,
      species_id: sp2.id,
      content: "Mô hình 3D nhìn rất sống động và chi tiết, góc quay trực quan dễ quan sát cấu tạo vây!",
      status: "visible",
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
  });

  // 2. Bình luận bị báo cáo (Reported comments matching Figma Image 2)
  const reported1 = await prisma.comments.create({
    data: {
      user_id: userA.id,
      species_id: sp1.id,
      content: "Thông tin sai hoàn toàn!! Website này không đáng tin cậy!!",
      status: "visible",
      report_count: 4,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  });

  await prisma.comment_reports.createMany({
    data: [
      {
        comment_id: reported1.id,
        reported_by: userB.id,
        reason: "Bình luận spam, không có căn cứ, gây hiểu nhầm",
        status: "pending",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        comment_id: reported1.id,
        reported_by: userC.id,
        reason: "Bình luận spam, không có căn cứ, gây hiểu nhầm",
        status: "pending",
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    ],
  });

  const reported2 = await prisma.comments.create({
    data: {
      user_id: userB.id,
      species_id: sp2.id,
      content: "Quảng cáo tour lặn biển giá rẻ tại [link spam] xem ngay để nhận ưu đãi hot...",
      status: "visible",
      report_count: 4,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
  });

  await prisma.comment_reports.createMany({
    data: [
      {
        comment_id: reported2.id,
        reported_by: userA.id,
        reason: "Bình luận spam, không có căn cứ, gây hiểu nhầm",
        status: "pending",
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    ],
  });

  const reported3 = await prisma.comments.create({
    data: {
      user_id: userC.id,
      species_id: sp1.id,
      content: "Số liệu về trọng lượng trong bài không khớp với Wikipedia",
      status: "visible",
      report_count: 2,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  });

  await prisma.comment_reports.createMany({
    data: [
      {
        comment_id: reported3.id,
        reported_by: userA.id,
        reason: "Thông tin có thể sai - Cần kiểm tra lại dữ liệu API",
        status: "pending",
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
    ],
  });

  // 3. Bình luận đã xóa (Deleted comments matching Figma Image 3)
  await prisma.comments.create({
    data: {
      user_id: userA.id,
      species_id: sp1.id,
      content: "Bình luận này đã bị xóa do chứa từ ngữ không phù hợp với quy tắc văn hóa thảo luận.",
      status: "deleted",
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
      deleted_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Deleted 1 day ago
    },
  });

  await prisma.comments.create({
    data: {
      user_id: userB.id,
      species_id: sp2.id,
      content: "Bài viết trước đó đã bị người dùng chủ động gỡ bỏ.",
      status: "deleted",
      created_at: new Date(Date.now() - 72 * 60 * 60 * 1000),
      deleted_at: new Date(Date.now() - 48 * 60 * 60 * 1000), // Deleted 2 days ago
    },
  });

  console.log("Seeding completed successfully!");
  process.exit(0);
}

seedComments().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
