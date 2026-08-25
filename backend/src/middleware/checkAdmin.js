import jwt from "jsonwebtoken";

/**
 * Middleware checkAdmin - Kiểm tra authentication & role admin trong JWT payload
 */
export const checkAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu mã xác thực JWT (Authorization token required)",
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "pacific_secret_key_2026";

    const decoded = jwt.verify(token, secret);

    // Kiểm tra role trong JWT payload
    if (!decoded || (decoded.role !== "admin" && decoded.role !== "super_admin")) {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập bị từ chối. Cần quyền Admin (Admin role required)",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Mã xác thực không hợp lệ hoặc đã hết hạn (Invalid or expired token)",
      error: error.message,
    });
  }
};

export default checkAdmin;
