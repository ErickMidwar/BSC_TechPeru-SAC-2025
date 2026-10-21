"use strict";

const db = require("../config/database");

function newId() {
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(id,5) AS INTEGER)) as m FROM objetivos").get().m || 0;
  return "OBJ-" + String(max + 1).padStart(2, "0");
}

function audit(user, accion, entidad_id, detalle) {
  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, user || "Sistema", accion, "objetivos", entidad_id, detalle);
}

function enrichObjetivo(obj) {
  if (!obj) return null;
  const kpis = db.prepare("SELECT id, nombre, resultado_actual, meta, direccion, umbral_alerta, umbral_critico, peso FROM kpis WHERE objetivo_id = ?").all(obj.id);
  const trabajador = obj.trabajador_id
    ? db.prepare("SELECT id, nombre, apellido, cargo, area FROM trabajadores WHERE id = ?").get(obj.trabajador_id)
    : null;
  return { ...obj, kpis, trabajador };
}

// GET /api/objetivos
exports.list = (req, res) => {
  const { perspectiva, estado, prioridad, q } = req.query;
  let sql = "SELECT * FROM objetivos WHERE 1=1";
  const params = [];

  if (perspectiva) { sql += " AND perspectiva = ?"; params.push(perspectiva); }
  if (estado)      { sql += " AND estado = ?";      params.push(estado); }
  if (prioridad)   { sql += " AND prioridad = ?";   params.push(prioridad); }
  if (q) {
    sql += " AND (nombre LIKE ? OR descripcion LIKE ? OR responsable LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY perspectiva, id";

  const rows = db.prepare(sql).all(...params).map(o => {
    const kpis = db.prepare("SELECT id FROM kpis WHERE objetivo_id = ?").all(o.id);
    return { ...o, kpi_count: kpis.length };
  });
  return res.json(rows);
};

// GET /api/objetivos/:id
exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Objetivo no encontrado." });
  return res.json(enrichObjetivo(row));
};

// POST /api/objetivos
exports.create = (req, res) => {
  const {
    nombre, perspectiva, descripcion = "", responsable = "",
    trabajador_id = null, prioridad = "Media", peso = 100, estado = "Activo"
  } = req.body || {};

  if (!nombre || !perspectiva) return res.status(400).json({ error: "nombre y perspectiva son requeridos." });
  const validPers = ["financiera", "clientes", "procesos", "aprendizaje"];
  if (!validPers.includes(perspectiva)) return res.status(400).json({ error: "Perspectiva inválida." });

  const id = newId();
  db.prepare(`
    INSERT INTO objetivos (id, nombre, perspectiva, descripcion, responsable, trabajador_id, prioridad, peso, estado)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, nombre.trim(), perspectiva, descripcion, responsable, trabajador_id || null,
         prioridad, Number(peso), estado);

  audit(req.user?.nombre, "Creación", id, `Objetivo ${id}: ${nombre}`);
  return res.status(201).json(enrichObjetivo(db.prepare("SELECT * FROM objetivos WHERE id = ?").get(id)));
};

// PUT /api/objetivos/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Objetivo no encontrado." });

  const { nombre, perspectiva, descripcion, responsable, trabajador_id, prioridad, peso, estado } = req.body || {};
  db.prepare(`
    UPDATE objetivos SET
      nombre        = COALESCE(?, nombre),
      perspectiva   = COALESCE(?, perspectiva),
      descripcion   = COALESCE(?, descripcion),
      responsable   = COALESCE(?, responsable),
      trabajador_id = COALESCE(?, trabajador_id),
      prioridad     = COALESCE(?, prioridad),
      peso          = COALESCE(?, peso),
      estado        = COALESCE(?, estado)
    WHERE id = ?
  `).run(
    nombre ?? null, perspectiva ?? null, descripcion ?? null, responsable ?? null,
    trabajador_id !== undefined ? (trabajador_id || null) : null,
    prioridad ?? null, peso !== undefined ? Number(peso) : null, estado ?? null,
    req.params.id
  );

  audit(req.user?.nombre, "Edición", req.params.id, `Objetivo ${req.params.id} actualizado.`);
  return res.json(enrichObjetivo(db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id)));
};

// DELETE /api/objetivos/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Objetivo no encontrado." });

  const kpiCount = db.prepare("SELECT COUNT(*) as c FROM kpis WHERE objetivo_id = ?").get(req.params.id).c;
  if (kpiCount > 0) {
    return res.status(409).json({ error: `No se puede eliminar: el objetivo tiene ${kpiCount} KPI(s) asociados.` });
  }

  db.prepare("DELETE FROM objetivos WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Eliminación", req.params.id, `Objetivo ${row.nombre} eliminado.`);
  return res.json({ message: "Objetivo eliminado." });
};
