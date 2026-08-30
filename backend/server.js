import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import "./src/utils/bigint.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Support up to 50mb for 3D models & audio files)
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// Routes 
import authRoutes from "./src/routes/auth.js";
import speciesRoutes from "./src/routes/species.js";
import adminRoutes from "./src/routes/admin.js";
import userRoutes from "./src/routes/users.js";
import uploadRoutes from "./src/routes/upload.js";

app.use("/api/auth", authRoutes);
app.use("/api/species", speciesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
