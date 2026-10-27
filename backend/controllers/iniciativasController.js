"use strict";

const db = require("../config/database");

function newId() {
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(id,5) AS INTEGER)) as m FROM iniciativas").get().m || 0;
  return "INI-" + String(max + 1).padStart(2, "0");
}

const { audit: writeAudit } = require("../utils/audit");
function audit(user, accion, entidad_id, detalle) {
  writeAudit(user, accion, "iniciativas", entidad_id, detalle);
}

function enrichIniciativa(ini) {
  if (!ini) return null;
  const objetivo = db.prepare("SELECT id, nombre, perspectiva FROM objetivos WHERE id = ?").get(ini.objetivo_id);
  const kpi      = ini.kpi_id ? db.prepare("SELECT id, nombre FROM kpis WHERE id = ?").get(ini.kpi_id) : null;
  const trabajador = ini.trabajador_id
    ? db.prepare("SELECT id, nombre, apellido, cargo, area FROM trabajadores WHERE id = ?").get(ini.trabajador_id)
    : null;
  const asignaciones = db.prepare(`
    SELECT ra.*, r.nombre as recurso_nombre, r.tipo as recurso_tipo
    FROM recurso_asignaciones ra
    LEFT JOIN recursos r ON r.id = ra.recurso_id
    WHERE ra.iniciativa_id = ?
  `).all(ini.id);
  return { ...ini, objetivo, kpi, trabajador, asignaciones };
}

// GET /api/iniciativas
exports.list = (req, res) => {
  const { objetivo_id, estado, responsable, q } = req.query;
  let sql = "SELECT * FROM iniciativas WHERE 1=1";
  const params = [];

  if (objetivo_id) { sql += " AND objetivo_id = ?"; params.push(objetivo_id); }
  if (estado)      { sql += " AND estado = ?";      params.push(estado); }
  if (responsable) { sql += " AND responsable = ?"; params.push(responsable); }
  if (q) {
    sql += " AND (nombre LIKE ? OR descripcion LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += " ORDER BY estado, fecha_inicio";

  const rows = db.prepare(sql).all(...params).map(i => {
    // Calculate budget utilization
    const pctBudget = i.presupuesto > 0 ? (i.ejecutado / i.presupuesto) * 100 : 0;
    return { ...i, pct_presupuesto: +pctBudget.toFixed(1) };
  });
  return res.json(rows);
};

// GET /api/iniciativas/:id
exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM iniciativas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Iniciativa no encontrada." });
  return res.json(enrichIniciativa(row));
};

// POST /api/iniciativas
exports.create = (req, res) => {
  const {
    nombre, objetivo_id, kpi_id = null, responsable = "", trabajador_id = null, area = "",
    fecha_inicio, fecha_fin, presupuesto = 0, ejecutado = 0, avance = 0,
    estado = "Planificada", descripcion = ""
  } = req.body || {};

  if (!nombre || !objetivo_id || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: "nombre, objetivo_id, fecha_inicio y fecha_fin son requeridos." });
  }

  const id = newId();
  db.prepare(`
    INSERT INTO iniciativas (id, nombre, objetivo_id, kpi_id, responsable, trabajador_id, area,
      fecha_inicio, fecha_fin, presupuesto, ejecutado, avance, estado, descripcion)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, nombre.trim(), objetivo_id, kpi_id || null, responsable, trabajador_id || null,
         area, fecha_inicio, fecha_fin, Number(presupuesto), Number(ejecutado),
         Number(avance), estado, descripcion);

  audit(req.user?.nombre, "Creación", id, `Iniciativa ${id}: ${nombre}`);
  return res.status(201).json(enrichIniciativa(db.prepare("SELECT * FROM iniciativas WHERE id = ?").get(id)));
};

// PUT /api/iniciativas/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM iniciativas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Iniciativa no encontrada." });

  const fields = ["nombre","objetivo_id","kpi_id","responsable","trabajador_id","area",
                  "fecha_inicio","fecha_fin","presupuesto","ejecutado","avance","estado","descripcion"];
  const numFields = new Set(["presupuesto","ejecutado","avance"]);
  const setClauses = [];
  const params = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      setClauses.push(`${f} = ?`);
      let val = req.body[f];
      if (numFields.has(f)) val = Number(val);
      if (f === "kpi_id" || f === "trabajador_id") val = val || null;
      params.push(val);
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });
  params.push(req.params.id);
  db.prepare(`UPDATE iniciativas SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...params);

  audit(req.user?.nombre, "Edición", req.params.id, `Iniciativa ${req.params.id} actualizada.`);
  return res.json(enrichIniciativa(db.prepare("SELECT * FROM iniciativas WHERE id = ?").get(req.params.id)));
};

// DELETE /api/iniciativas/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM iniciativas WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Iniciativa no encontrada." });
  db.prepare("DELETE FROM iniciativas WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Eliminación", req.params.id, `Iniciativa ${row.nombre} eliminada.`);
  return res.json({ message: "Iniciativa eliminada." });
};
