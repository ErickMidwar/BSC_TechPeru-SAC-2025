"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "bsc_techperu_secret_2025";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: `${user.nombre} ${user.apellido}`.trim() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// POST /api/auth/login
exports.login = (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: "Credenciales incorrectas." });

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return res.status(401).json({ error: "Credenciales incorrectas." });

  // Audit
  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, `${user.nombre} ${user.apellido}`.trim(), "Login", "users", user.id, "Inicio de sesión exitoso.");

  const { password: _pw, ...safeUser } = user;
  return res.json({ token: makeToken(user), user: safeUser });
};

// POST /api/auth/register  (admin only — protected by route middleware)
exports.register = (req, res) => {
  const { nombre, apellido = "", email, password, rol = "Responsable", area = "" } = req.body || {};
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "nombre, email y password son requeridos." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: "El email ya está registrado." });

  const id = "u" + Date.now();
  const hashed = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, nombre, apellido, email, password, rol, area, activo)
    VALUES (?,?,?,?,?,?,?,1)
  `).run(id, nombre.trim(), apellido.trim(), email.trim().toLowerCase(), hashed, rol, area);

  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, req.user?.nombre || "Admin", "Creación", "users", id, `Usuario ${email} registrado.`);

  return res.status(201).json({ message: "Usuario registrado correctamente.", id });
};

// GET /api/auth/me
exports.me = (req, res) => {
  const user = db.prepare("SELECT id, nombre, apellido, email, rol, area, activo, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  return res.json(user);
};
