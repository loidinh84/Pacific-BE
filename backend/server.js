import express from "express";
import cors from "cors";
import "dotenv/config";
import "./src/utils/bigint.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Routes 
import authRoutes from "./src/routes/auth.js";
import speciesRoutes from "./src/routes/species.js";
import adminRoutes from "./src/routes/admin.js";
import userRoutes from "./src/routes/users.js";

app.use("/api/auth", authRoutes);
app.use("/api/species", speciesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

