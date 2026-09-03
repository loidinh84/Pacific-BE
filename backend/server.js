import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import "./src/utils/bigint.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Support up to 50mb for 3D models & audio files)
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static uploads & ocean sounds
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/sounds", express.static(path.join(process.cwd(), "public", "sounds")));

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
