"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const { requireJwtSecret } = require("./middleware/auth");

// Fail fast if JWT is missing
try {
  requireJwtSecret();
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({
  origin: corsOrigin === "*" ? false : corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de acceso. Intenta de nuevo en 15 minutos." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

// ── Static frontend only (never expose backend/) ──────────────────────────────
const allowStatic = new Set(["index.html", "favicon.ico"]);
const allowDirs = ["css", "js", "shared", "vendor", "html"];

app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "index.html")));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const rel = req.path.replace(/^\/+/, "");
  const top = rel.split("/")[0];
  if (allowStatic.has(rel) || allowDirs.includes(top)) {
    const file = path.join(ROOT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return res.sendFile(file);
    }
  }
  return next();
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", loginLimiter, require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/trabajadores", require("./routes/trabajadores"));
app.use("/api/recursos", require("./routes/recursos"));
app.use("/api/objetivos", require("./routes/objetivos"));
app.use("/api/kpis", require("./routes/kpis"));
app.use("/api/mediciones", require("./routes/mediciones"));
app.use("/api/iniciativas", require("./routes/iniciativas"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", env: process.env.NODE_ENV || "development", ts: new Date().toISOString() })
);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (!isProd) console.error("[ERROR]", err.message);
  res.status(status).json({ error: err.message || "Error interno del servidor." });
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

app.listen(PORT, () => {
  console.log(`\n🚀  BSC TechPeru API en http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}/`);
  console.log(`   Health:   http://localhost:${PORT}/api/health\n`);
});
