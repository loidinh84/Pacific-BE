/**
 * uploadController.js
 * Backend File Upload Controller for Images, Videos, 3D Models (.glb/.gltf) & Ocean Audio (.mp3/.wav)
 */

import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class UploadController {
  /**
   * POST /api/upload
   * Accepts base64 encoded payload or file data and returns public HTTP URL
   */
  async uploadFile(req, res) {
    try {
      const { filename, fileData, mimeType } = req.body;

      if (!fileData) {
        return res.status(400).json({
          success: false,
          message: "No file data received",
        });
      }

      // Generate unique safe filename
      const ext = path.extname(filename || "") || ".bin";
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000);
      const safeName = `file_${timestamp}_${randomId}${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeName);

      // Convert Base64 data to Buffer
      const base64Clean = fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Clean, "base64");

      fs.writeFileSync(filePath, buffer);

      // Build public URL
      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const fileUrl = `${protocol}://${host}/uploads/${safeName}`;

      console.log(`📁 [FILE UPLOAD] Saved file: ${safeName} (${buffer.length} bytes) -> ${fileUrl}`);

      return res.status(200).json({
        success: true,
        message: "Upload file thành công",
        url: fileUrl,
        filename: safeName,
        size: buffer.length,
      });
    } catch (error) {
      console.error("Lỗi khi upload file:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi upload file",
      });
    }
  }
}

export default new UploadController();
