"use strict";

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static frontend files from the project root
app.use(express.static(path.join(__dirname, "..")));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/users",       require("./routes/users"));
app.use("/api/trabajadores",require("./routes/trabajadores"));
app.use("/api/recursos",    require("./routes/recursos"));
app.use("/api/objetivos",   require("./routes/objetivos"));
app.use("/api/kpis",        require("./routes/kpis"));
app.use("/api/mediciones",  require("./routes/mediciones"));
app.use("/api/iniciativas", require("./routes/iniciativas"));
app.use("/api/dashboard",   require("./routes/dashboard"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor." });
});

// ── Auto-seed if DB is empty ──────────────────────────────────────────────────
const db = require("./config/database");
const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
if (userCount === 0) {
  console.log("⚡  Base de datos vacía — ejecutando seed inicial...");
  try {
    require("./seed/seed.js");
  } catch (e) {
    console.error("Error en seed automático:", e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  BSC TechPeru API corriendo en http://localhost:${PORT}`);
  console.log(`   Frontend:  http://localhost:${PORT}/index.html`);
  console.log(`   API Docs:  http://localhost:${PORT}/api/health\n`);
});
