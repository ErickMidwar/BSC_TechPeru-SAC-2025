"use strict";

const db = require("../config/database");

function newId(prefix) { return `${prefix}-${Date.now()}`; }

const { audit: writeAudit } = require("../utils/audit");
function audit(user, accion, entidad_id, detalle) {
  writeAudit(user, accion, "recursos", entidad_id, detalle);
}

// ── RECURSOS ──────────────────────────────────────────────────────────────────

// GET /api/recursos
exports.list = (req, res) => {
  const rows = db.prepare("SELECT * FROM recursos ORDER BY tipo, nombre").all();
  return res.json(rows);
};

// GET /api/recursos/:id
exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM recursos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Recurso no encontrado." });
  // Include asignaciones
  const asignaciones = db.prepare(`
    SELECT ra.*, i.nombre as iniciativa_nombre
    FROM recurso_asignaciones ra
    LEFT JOIN iniciativas i ON i.id = ra.iniciativa_id
    WHERE ra.recurso_id = ?
  `).all(req.params.id);
  return res.json({ ...row, asignaciones });
};

// POST /api/recursos
exports.create = (req, res) => {
  const { nombre, tipo = "Financiero", descripcion = "", monto_total = 0, moneda = "PEN", estado = "Disponible" } = req.body || {};
  if (!nombre) return res.status(400).json({ error: "nombre es requerido." });

  const id = newId("REC");
  db.prepare(`
    INSERT INTO recursos (id, nombre, tipo, descripcion, monto_total, moneda, estado)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, nombre.trim(), tipo, descripcion, Number(monto_total), moneda, estado);

  audit(req.user?.nombre, "Creación", id, `Recurso "${nombre}" creado.`);
  return res.status(201).json(db.prepare("SELECT * FROM recursos WHERE id = ?").get(id));
};

// PUT /api/recursos/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT id FROM recursos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Recurso no encontrado." });

  const { nombre, tipo, descripcion, monto_total, moneda, estado } = req.body || {};
  db.prepare(`
    UPDATE recursos SET
      nombre      = COALESCE(?, nombre),
      tipo        = COALESCE(?, tipo),
      descripcion = COALESCE(?, descripcion),
      monto_total = COALESCE(?, monto_total),
      moneda      = COALESCE(?, moneda),
      estado      = COALESCE(?, estado),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(nombre ?? null, tipo ?? null, descripcion ?? null,
         monto_total !== undefined ? Number(monto_total) : null,
         moneda ?? null, estado ?? null, req.params.id);

  audit(req.user?.nombre, "Edición", req.params.id, `Recurso ${req.params.id} actualizado.`);
  return res.json(db.prepare("SELECT * FROM recursos WHERE id = ?").get(req.params.id));
};

// DELETE /api/recursos/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT id FROM recursos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Recurso no encontrado." });
  db.prepare("DELETE FROM recursos WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Eliminación", req.params.id, `Recurso ${req.params.id} eliminado.`);
  return res.json({ message: "Recurso eliminado." });
};

// ── ASIGNACIONES ──────────────────────────────────────────────────────────────

// GET /api/recursos/asignaciones  (all)
exports.listAsignaciones = (req, res) => {
  const rows = db.prepare(`
    SELECT ra.*, r.nombre as recurso_nombre, r.tipo as recurso_tipo,
           i.nombre as iniciativa_nombre
    FROM recurso_asignaciones ra
    LEFT JOIN recursos r    ON r.id = ra.recurso_id
    LEFT JOIN iniciativas i ON i.id = ra.iniciativa_id
    ORDER BY ra.created_at DESC
  `).all();
  return res.json(rows);
};

// POST /api/recursos/asignaciones
exports.createAsignacion = (req, res) => {
  const { iniciativa_id, recurso_id, monto_asignado = 0, monto_ejecutado = 0, notas = "" } = req.body || {};
  if (!iniciativa_id || !recurso_id) {
    return res.status(400).json({ error: "iniciativa_id y recurso_id son requeridos." });
  }

  const id = newId("ASG");
  db.prepare(`
    INSERT INTO recurso_asignaciones (id, iniciativa_id, recurso_id, monto_asignado, monto_ejecutado, notas)
    VALUES (?,?,?,?,?,?)
  `).run(id, iniciativa_id, recurso_id, Number(monto_asignado), Number(monto_ejecutado), notas);

  audit(req.user?.nombre, "Asignación", id, `Recurso ${recurso_id} asignado a iniciativa ${iniciativa_id}.`);
  return res.status(201).json(db.prepare("SELECT * FROM recurso_asignaciones WHERE id = ?").get(id));
};

// PUT /api/recursos/asignaciones/:id
exports.updateAsignacion = (req, res) => {
  const row = db.prepare("SELECT id FROM recurso_asignaciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Asignación no encontrada." });

  const { monto_asignado, monto_ejecutado, notas } = req.body || {};
  db.prepare(`
    UPDATE recurso_asignaciones SET
      monto_asignado  = COALESCE(?, monto_asignado),
      monto_ejecutado = COALESCE(?, monto_ejecutado),
      notas           = COALESCE(?, notas)
    WHERE id = ?
  `).run(
    monto_asignado !== undefined ? Number(monto_asignado) : null,
    monto_ejecutado !== undefined ? Number(monto_ejecutado) : null,
    notas ?? null, req.params.id
  );

  return res.json(db.prepare("SELECT * FROM recurso_asignaciones WHERE id = ?").get(req.params.id));
};

// DELETE /api/recursos/asignaciones/:id
exports.removeAsignacion = (req, res) => {
  const row = db.prepare("SELECT id FROM recurso_asignaciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Asignación no encontrada." });
  db.prepare("DELETE FROM recurso_asignaciones WHERE id = ?").run(req.params.id);
  return res.json({ message: "Asignación eliminada." });
};
