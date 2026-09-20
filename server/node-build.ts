import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "./index.js";

const app = createServer();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../spa");

// Serve the built React SPA
app.use(express.static(distPath));

// All non-API routes → serve index.html (React Router handles the rest)
app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`✅ ShopShield running → http://localhost:${port}`);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT",  () => process.exit(0));
