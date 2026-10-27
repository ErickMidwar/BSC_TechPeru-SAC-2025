"use strict";

const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { canEditStrategy, canMeasure, canApproveMeasurement, canAdmin } = require("../../shared/compliance");

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET no configurado o demasiado corto. Copia backend/.env.example a backend/.env y define un secreto seguro."
    );
  }
  return secret;
}

/**
 * Verifies the JWT and re-checks that the user is still active in the DB.
 */
function authenticate(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token de autenticación requerido." });
  }

  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(token, secret);
    const user = db.prepare(
      "SELECT id, email, rol, nombre, apellido, activo FROM users WHERE id = ?"
    ).get(payload.id);

    if (!user || !user.activo) {
      return res.status(401).json({ error: "Usuario inactivo o no encontrado." });
    }

    req.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre: `${user.nombre} ${user.apellido}`.trim(),
    };
    next();
  } catch (err) {
    if (err.message && err.message.includes("JWT_SECRET")) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

function requireEditor(req, res, next) {
  if (!req.user || !canEditStrategy(req.user.rol)) {
    return res.status(403).json({ error: "Acción no permitida para tu rol." });
  }
  next();
}

/** Admin, Gerente o Responsable pueden registrar/editar mediciones. */
function requireMeasurer(req, res, next) {
  if (!req.user || !canMeasure(req.user.rol)) {
    return res.status(403).json({ error: "Tu rol no permite registrar mediciones." });
  }
  next();
}

function requireApprover(req, res, next) {
  if (!req.user || !canApproveMeasurement(req.user.rol)) {
    return res.status(403).json({ error: "Se requiere Gerente o Administrador para aprobar mediciones." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !canAdmin(req.user.rol)) {
    return res.status(403).json({ error: "Se requiere rol Administrador." });
  }
  next();
}

module.exports = {
  authenticate,
  requireEditor,
  requireMeasurer,
  requireApprover,
  requireAdmin,
  requireJwtSecret,
};
