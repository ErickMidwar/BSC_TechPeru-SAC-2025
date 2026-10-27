"use strict";

const db = require("../config/database");

function newId() { return "t" + Date.now(); }

const { audit: writeAudit } = require("../utils/audit");
function audit(user, accion, entidad_id, detalle) {
  writeAudit(user, accion, "trabajadores", entidad_id, detalle);
}

// GET /api/trabajadores
exports.list = (req, res) => {
  const { activo, area, q } = req.query;
  let sql = "SELECT * FROM trabajadores WHERE 1=1";
  const params = [];

  if (activo !== undefined) { sql += " AND activo = ?"; params.push(Number(activo)); }
  if (area)  { sql += " AND area = ?"; params.push(area); }
  if (q)     { sql += " AND (nombre LIKE ? OR apellido LIKE ? OR cargo LIKE ? OR dni LIKE ?)";
               const like = `%${q}%`; params.push(like, like, like, like); }

  sql += " ORDER BY apellido, nombre";
  const rows = db.prepare(sql).all(...params);
  return res.json(rows);
};

// GET /api/trabajadores/:id
exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Trabajador no encontrado." });
  return res.json(row);
};

// POST /api/trabajadores
exports.create = (req, res) => {
  const { dni = "", nombre, apellido, cargo = "", area = "", email = "", telefono = "", activo = 1 } = req.body || {};
  if (!nombre || !apellido) return res.status(400).json({ error: "nombre y apellido son requeridos." });

  const id = newId();
  db.prepare(`
    INSERT INTO trabajadores (id, dni, nombre, apellido, cargo, area, email, telefono, activo)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, dni, nombre.trim(), apellido.trim(), cargo, area, email, telefono, activo ? 1 : 0);

  audit(req.user?.nombre, "Creación", id, `Trabajador ${nombre} ${apellido} creado.`);
  const created = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(id);
  return res.status(201).json(created);
};

// PUT /api/trabajadores/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Trabajador no encontrado." });

  const { dni, nombre, apellido, cargo, area, email, telefono, activo } = req.body || {};
  db.prepare(`
    UPDATE trabajadores SET
      dni      = COALESCE(?, dni),
      nombre   = COALESCE(?, nombre),
      apellido = COALESCE(?, apellido),
      cargo    = COALESCE(?, cargo),
      area     = COALESCE(?, area),
      email    = COALESCE(?, email),
      telefono = COALESCE(?, telefono),
      activo   = COALESCE(?, activo),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    dni ?? null, nombre ?? null, apellido ?? null, cargo ?? null,
    area ?? null, email ?? null, telefono ?? null,
    activo !== undefined ? (activo ? 1 : 0) : null,
    req.params.id
  );

  audit(req.user?.nombre, "Edición", req.params.id, `Trabajador ${req.params.id} actualizado.`);
  return res.json(db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id));
};

// DELETE /api/trabajadores/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM trabajadores WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Trabajador no encontrado." });

  // Soft-delete: mark as inactive instead of hard delete to preserve FK references
  db.prepare("UPDATE trabajadores SET activo = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Baja", req.params.id, `Trabajador ${row.nombre} ${row.apellido} desactivado.`);
  return res.json({ message: "Trabajador desactivado correctamente." });
};
