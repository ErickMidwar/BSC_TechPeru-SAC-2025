"use strict";

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "bsc_techperu_secret_2025";

/**
 * Verifies the JWT token sent in the Authorization header.
 * Attaches the decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token de autenticación requerido." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, rol, nombre }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

/**
 * Requires Administrador or Gerente role.
 */
function requireEditor(req, res, next) {
  if (!req.user || !["Administrador", "Gerente"].includes(req.user.rol)) {
    return res.status(403).json({ error: "Acción no permitida para tu rol." });
  }
  next();
}

/**
 * Requires Administrador role only.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== "Administrador") {
    return res.status(403).json({ error: "Se requiere rol Administrador." });
  }
  next();
}

module.exports = { authenticate, requireEditor, requireAdmin };
