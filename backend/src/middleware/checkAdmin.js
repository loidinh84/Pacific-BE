import jwt from "jsonwebtoken";

/**
 * Middleware kiểm tra quyền admin qua JWT token
 */
export const checkAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập lại!",
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;

    const decoded = jwt.verify(token, secret);

    // Kiểm tra vai trò tài khoản
    if (!decoded || (decoded.role !== "admin" && decoded.role !== "super_admin")) {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập bị từ chối. Cần quyền Admin",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Mã xác thực không hợp lệ hoặc đã hết hạn",
      error: error.message,
    });
  }
};

export default checkAdmin;
