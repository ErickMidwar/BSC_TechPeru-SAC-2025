"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { audit } = require("../utils/audit");
const { newId } = require("../utils/ids");
const { parse, loginSchema, registerSchema } = require("../utils/validate");
const { requireJwtSecret } = require("../middleware/auth");

const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: `${user.nombre} ${user.apellido}`.trim() },
    requireJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  );
}

exports.login = (req, res) => {
  try {
    const { email, password } = parse(loginSchema, req.body || {});
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email.trim().toLowerCase());
    if (!user) return res.status(401).json({ error: "Credenciales incorrectas." });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Credenciales incorrectas." });
    }

    audit(`${user.nombre} ${user.apellido}`.trim(), "Login", "users", user.id, "Inicio de sesión exitoso.");
    const { password: _pw, ...safeUser } = user;
    return res.json({ token: makeToken(user), user: safeUser });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

exports.register = (req, res) => {
  try {
    const data = parse(registerSchema, req.body || {});
    const email = data.email.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "El email ya está registrado." });

    const id = newId("u");
    const hashed = bcrypt.hashSync(data.password, 10);

    db.prepare(`
      INSERT INTO users (id, nombre, apellido, email, password, rol, area, activo)
      VALUES (?,?,?,?,?,?,?,1)
    `).run(id, data.nombre.trim(), data.apellido.trim(), email, hashed, data.rol, data.area);

    audit(req.user?.nombre || "Admin", "Creación", "users", id, `Usuario ${email} registrado.`);
    return res.status(201).json({ message: "Usuario registrado correctamente.", id });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

exports.me = (req, res) => {
  const user = db.prepare(
    "SELECT id, nombre, apellido, email, rol, area, activo, created_at FROM users WHERE id = ?"
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  return res.json(user);
};
