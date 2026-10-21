"use strict";

const bcrypt = require("bcryptjs");
const db = require("../config/database");

function audit(user, accion, entidad_id, detalle) {
  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, user || "Sistema", accion, "users", entidad_id, detalle);
}

// GET /api/users
exports.list = (req, res) => {
  const rows = db.prepare(
    "SELECT id, nombre, apellido, email, rol, area, activo, created_at FROM users ORDER BY nombre"
  ).all();
  return res.json(rows);
};

// GET /api/users/:id
exports.getOne = (req, res) => {
  const row = db.prepare(
    "SELECT id, nombre, apellido, email, rol, area, activo, created_at FROM users WHERE id = ?"
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Usuario no encontrado." });
  return res.json(row);
};

// PUT /api/users/:id  (admin or self)
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Usuario no encontrado." });

  // Non-admin can only update themselves and cannot change rol
  const isSelf = req.user.id === req.params.id;
  const isAdmin = req.user.rol === "Administrador";
  if (!isSelf && !isAdmin) return res.status(403).json({ error: "No autorizado." });

  const { nombre, apellido, area, rol, activo, password } = req.body || {};
  const fields = [];
  const params = [];

  if (nombre    !== undefined) { fields.push("nombre = ?");    params.push(nombre.trim()); }
  if (apellido  !== undefined) { fields.push("apellido = ?");  params.push(apellido.trim()); }
  if (area      !== undefined) { fields.push("area = ?");      params.push(area); }
  if (isAdmin && rol !== undefined) { fields.push("rol = ?"); params.push(rol); }
  if (isAdmin && activo !== undefined) { fields.push("activo = ?"); params.push(activo ? 1 : 0); }
  if (password) { fields.push("password = ?"); params.push(bcrypt.hashSync(password, 10)); }

  if (fields.length === 0) return res.status(400).json({ error: "Nada para actualizar." });
  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...params);

  audit(req.user?.nombre, "Edición", req.params.id, `Usuario ${req.params.id} actualizado.`);
  return res.json(db.prepare("SELECT id, nombre, apellido, email, rol, area, activo FROM users WHERE id = ?").get(req.params.id));
};

// DELETE /api/users/:id  (admin only, cannot delete themselves)
exports.remove = (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Usuario no encontrado." });

  db.prepare("UPDATE users SET activo = 0 WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Baja", req.params.id, `Usuario ${row.email} desactivado.`);
  return res.json({ message: "Usuario desactivado." });
};
