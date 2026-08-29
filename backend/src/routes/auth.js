import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import prisma from "../lib/prisma.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/mailer.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


/**
 * POST /api/auth/register
 * Đăng ký tài khoản người dùng mới
 */
router.post("/register", async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ Email và Mật khẩu!" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự!" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Kiểm tra xem email đã tồn tại trong DB chưa
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Địa chỉ email này đã được sử dụng!" });
    }

// Helper chuyển đổi tên Tiếng Việt có dấu thành Username sạch không dấu (VD: "Đinh Thành Lợi" -> "dinhthanhloi")
function slugifyVietnamese(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

    // Tạo username duy nhất
    let baseUsername =
      username ||
      slugifyVietnamese(fullName) ||
      cleanEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "");

    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = "user_" + Math.floor(1000 + Math.random() * 9000);
    }

    let finalUsername = baseUsername;
    const existingUsername = await prisma.user.findUnique({
      where: { username: finalUsername },
    });

    if (existingUsername) {
      finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Hash mật khẩu bằng bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Lưu User mới vào CSDL
    const newUser = await prisma.user.create({
      data: {
        username: finalUsername,
        full_name: fullName,
        email: cleanEmail,
        password_hash: hashedPassword,
        status: "active", // Hoặc "pending" nếu bắt buộc kích hoạt qua mail
        role: "user",
      },
    });

    // Tạo JWT Token cho tự động đăng nhập sau khi đăng ký
    const jwtSecret = process.env.JWT_SECRET || "pacific_secret_key";
    const token = jwt.sign(
      {
        userId: newUser.id.toString(),
        email: newUser.email,
        role: newUser.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Gửi email chào mừng/xác nhận chạy ngầm (không await để phản hồi cực nhanh)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verifyUrl = `${frontendUrl}/verify-email?email=${encodeURIComponent(newUser.email)}`;
    sendVerificationEmail(newUser.email, verifyUrl).catch((mailErr) => {
      console.warn("Chưa gửi được mail chào mừng (không ảnh hưởng đăng ký):", mailErr.message);
    });


    return res.status(201).json({
      message: "Đăng ký tài khoản thành công!",
      token,
      user: {
        id: newUser.id.toString(),
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra từ hệ thống khi đăng ký!" });
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập người dùng và tạo JWT Token
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập Email và Mật khẩu!" });
    }

    const cleanInput = email.trim();

    // Tìm người dùng theo Email hoặc Username (Khớp chính xác 100% từng chữ hoa/thường)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { username: cleanInput },
        ],
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Email hoặc mật khẩu không chính xác!" });
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status === "locked") {
      return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa! Vui lòng liên hệ quản trị viên." });
    }

    // So sánh mật khẩu bằng bcryptjs
    if (!user.password_hash) {
      return res.status(400).json({ message: "Tài khoản này được đăng nhập bằng Google/Mạng xã hội." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Email hoặc mật khẩu không chính xác!" });
    }

    // Tạo JWT Token
    const jwtSecret = process.env.JWT_SECRET || "pacific_secret_key";
    const token = jwt.sign(
      {
        userId: user.id.toString(),
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Cập nhật last_login_at
    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_active_at: new Date(),
      },
    });

    return res.json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra từ máy chủ khi đăng nhập!" });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", async (req, res) => {
  return res.json({ message: "Đăng xuất thành công!" });
});

/**
 * GET /api/auth/me
 * Lấy thông tin tài khoản hiện tại thông qua JWT Token
 */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Chưa đăng nhập!" });
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET || "pacific_secret_key";
    const decoded = jwt.verify(token, jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng!" });
    }

    return res.json({
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
  }
});

/**
 * POST /api/auth/google
 * Đăng nhập / Đăng ký bằng Google ID Token hoặc Access Token
 */
router.post("/google", async (req, res) => {
  try {
    const { credential, idToken, accessToken } = req.body;
    const tokenToVerify = credential || idToken;

    let googlePayload = null;

    if (tokenToVerify) {
      try {
        if (process.env.GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken: tokenToVerify,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          googlePayload = ticket.getPayload();
        } else {
          const infoRes = await axios.get(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`
          );
          googlePayload = infoRes.data;
        }
      } catch (err) {
        console.warn("Token verification fallback to Google tokeninfo:", err.message);
        const infoRes = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${tokenToVerify}`
        );
        googlePayload = infoRes.data;
      }
    } else if (accessToken) {
      const userinfoRes = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      googlePayload = userinfoRes.data;
    }

    if (!googlePayload || !googlePayload.email) {
      return res.status(400).json({ message: "Dữ liệu xác thực Google không hợp lệ!" });
    }

    const googleId = googlePayload.sub || googlePayload.id;
    const email = googlePayload.email.toLowerCase().trim();
    const name = googlePayload.name || googlePayload.given_name || email.split("@")[0];
    const picture = googlePayload.picture || googlePayload.avatar;

    // Tìm xem user đã tồn tại theo google_id hoặc email chưa
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ google_id: googleId }, { email: email }],
      },
    });

    if (user) {
      // Cập nhật thông tin nếu cần
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          google_id: googleId,
          avatar_url: user.avatar_url || picture,
          last_login_at: new Date(),
          last_active_at: new Date(),
        },
      });
    } else {
      // Tạo user mới từ tài khoản Google
      let baseUsername = name ? name.toLowerCase().replace(/[^a-z0-9]/g, "") : email.split("@")[0];
      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = "guser_" + Math.floor(1000 + Math.random() * 9000);
      }

      let finalUsername = baseUsername;
      const existingUserWithUsername = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      if (existingUserWithUsername) {
        finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await prisma.user.create({
        data: {
          google_id: googleId,
          email: email,
          username: finalUsername,
          avatar_url: picture,
          status: "active",
          role: "user",
          email_verified_at: new Date(),
        },
      });
    }

    // Tạo JWT Token hệ thống
    const jwtSecret = process.env.JWT_SECRET || "pacific_secret_key";
    const token = jwt.sign(
      {
        userId: user.id.toString(),
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      message: "Đăng nhập Google thành công!",
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi xử lý đăng nhập bằng Google!" });
  }
});

/**
 * POST /api/auth/github
 * Đăng nhập / Đăng ký bằng GitHub (OAuth2 Authorization Code)
 */
router.post("/github", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Thiếu mã xác thực từ GitHub!" });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    // 1. Đổi code lấy access_token với GitHub API
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      return res.status(400).json({
        message: "Xác thực GitHub không thành công hoặc Mã Code đã hết hạn!",
      });
    }

    // 2. Lấy thông tin user từ GitHub API
    const ghUserRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Pacific-App",
      },
    });

    const ghData = ghUserRes.data;
    let email = ghData.email;

    // Nếu email riêng tư (private), lấy email chính từ danh sách email của user
    if (!email) {
      try {
        const emailsRes = await axios.get("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "Pacific-App",
          },
        });
        const primaryEmailObj = emailsRes.data?.find((e) => e.primary) || emailsRes.data?.[0];
        if (primaryEmailObj) email = primaryEmailObj.email;
      } catch (e) {
        console.warn("Chưa lấy được email riêng tư từ GitHub:", e.message);
      }
    }

    if (!email) {
      email = `${ghData.login || ghData.id}@github.pacific.com`;
    }

    const cleanEmail = email.toLowerCase().trim();
    const name = ghData.name || ghData.login || "GitHub User";
    const picture = ghData.avatar_url;

    // 3. Tìm hoặc tạo user trong CSDL
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: ghData.login }],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar_url: user.avatar_url || picture,
          last_login_at: new Date(),
          last_active_at: new Date(),
        },
      });
    } else {
      let baseUsername = ghData.login ? ghData.login.toLowerCase().replace(/[^a-z0-9]/g, "") : "ghuser";
      if (baseUsername.length < 3) baseUsername = "ghuser_" + Math.floor(1000 + Math.random() * 9000);

      let finalUsername = baseUsername;
      const existingUserWithUsername = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      if (existingUserWithUsername) {
        finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          username: finalUsername,
          avatar_url: picture,
          status: "active",
          role: "user",
          email_verified_at: new Date(),
        },
      });
    }

    // 4. Sinh JWT Token hệ thống
    const jwtSecret = process.env.JWT_SECRET || "pacific_secret_key";
    const token = jwt.sign(
      {
        userId: user.id.toString(),
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      message: "Đăng nhập bằng GitHub thành công!",
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("GitHub Auth Error:", error?.response?.data || error.message);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi xử lý đăng nhập bằng GitHub!" });
  }
});




/**
 * POST /api/auth/forgot-password
 * Nhận email, tạo token 15 phút, gửi email khôi phục mật khẩu
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập địa chỉ email!" });
    }

    // Tìm người dùng trong DB
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Vì lý do bảo mật, trả về thông báo chung để tránh dò email
      return res.json({
        message: "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
      });
    }

    // Tạo token ngẫu nhiên
    const token = crypto.randomBytes(32).toString("hex");

    // Token hết hạn sau 15 phút
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Lưu vào DB (bảng password_reset_tokens)
    await prisma.password_reset_tokens.create({
      data: {
        user_id: user.id,
        token: token,
        expires_at: expiresAt,
      },
    });

    // Tạo liên kết reset mật khẩu
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    // Gửi email khôi phục qua Nodemailer (SMTP Gmail)
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      console.error("Lỗi gửi email:", mailError);
      return res.status(500).json({
        message: "Không thể gửi email lúc này. Vui lòng kiểm tra lại cấu hình SMTP Gmail trong backend .env",
      });
    }

    return res.json({
      message: "Đã gửi hướng dẫn khôi phục tới email của bạn! Vui lòng kiểm tra hộp thư (bao gồm cả thư rác).",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra từ máy chủ!" });
  }
});

/**
 * POST /api/auth/reset-password
 * Nhận token + mật khẩu mới, xác thực token và cập nhật mật khẩu đã hash
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Thiếu thông tin token hoặc mật khẩu mới!" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự!" });
    }

    // Tìm record token trong DB
    const resetTokenRecord = await prisma.password_reset_tokens.findUnique({
      where: { token },
    });

    if (!resetTokenRecord) {
      return res.status(400).json({ message: "Mã khôi phục không hợp lệ!" });
    }

    // Kiểm tra xem đã sử dụng chưa
    if (resetTokenRecord.used_at !== null) {
      return res.status(400).json({ message: "Mã khôi phục này đã được sử dụng trước đó!" });
    }

    // Kiểm tra xem đã hết hạn chưa (15 phút)
    if (new Date() > new Date(resetTokenRecord.expires_at)) {
      return res.status(400).json({ message: "Mã khôi phục đã hết hạn! Vui lòng gửi lại yêu cầu mới." });
    }

    // Hash mật khẩu mới bằng bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Cập nhật mật khẩu mới cho User và đánh dấu used_at cho token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetTokenRecord.user_id },
        data: {
          password_hash: hashedPassword,
          updated_at: new Date(),
        },
      }),
      prisma.password_reset_tokens.update({
        where: { id: resetTokenRecord.id },
        data: {
          used_at: new Date(),
        },
      }),
    ]);

    return res.json({
      message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi đặt lại mật khẩu!" });
  }
});

/**
 * POST /api/auth/verify-email
 * Xác nhận email sau khi đăng ký
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Địa chỉ email không được để trống!" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản người dùng!" });
    }

    // Cập nhật email_verified_at và status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified_at: new Date(),
        status: "active",
        updated_at: new Date(),
      },
    });

    return res.json({
      message: "Xác thực email thành công! Tài khoản của bạn đã được kích hoạt.",
    });
  } catch (error) {
    console.error("Verify Email Error:", error);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi xác thực email!" });
  }
});

export default router;

