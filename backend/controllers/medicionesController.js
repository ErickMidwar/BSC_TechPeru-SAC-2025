"use strict";

const db = require("../config/database");
const { achievement } = require("./kpisController");

function newId(kpi_id, periodo) { return `M-${kpi_id}-${periodo}`; }

function audit(user, accion, entidad_id, detalle) {
  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, user || "Sistema", accion, "mediciones", entidad_id, detalle);
}

/**
 * After saving a measurement, update kpi.resultado_actual with the
 * latest measurement value (most recent period).
 */
function recalcKpi(kpi_id) {
  const latest = db.prepare(
    "SELECT valor FROM mediciones WHERE kpi_id = ? ORDER BY periodo DESC, fecha DESC LIMIT 1"
  ).get(kpi_id);

  if (latest) {
    db.prepare("UPDATE kpis SET resultado_actual = ? WHERE id = ?").run(latest.valor, kpi_id);
  }
}

// GET /api/mediciones
exports.list = (req, res) => {
  const { kpi_id, periodo, q } = req.query;
  let sql = `
    SELECT m.*, k.nombre as kpi_nombre, k.perspectiva, k.unidad,
           k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m
    LEFT JOIN kpis k ON k.id = m.kpi_id
    WHERE 1=1
  `;
  const params = [];

  if (kpi_id)  { sql += " AND m.kpi_id = ?";      params.push(kpi_id); }
  if (periodo) { sql += " AND m.periodo = ?";      params.push(periodo); }
  if (q) {
    sql += " AND (k.nombre LIKE ? OR m.responsable LIKE ? OR m.notas LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY m.periodo DESC, m.fecha DESC";

  const rows = db.prepare(sql).all(...params).map(m => {
    const pct = achievement(m, m.valor);
    return { ...m, cumplimiento: pct };
  });
  return res.json(rows);
};

// GET /api/mediciones/:id
exports.getOne = (req, res) => {
  const row = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });
  return res.json({ ...row, cumplimiento: achievement(row, row.valor) });
};

// POST /api/mediciones
exports.create = (req, res) => {
  const { kpi_id, periodo, fecha, valor, responsable = "", notas = "" } = req.body || {};
  if (!kpi_id || !periodo || !fecha || valor === undefined) {
    return res.status(400).json({ error: "kpi_id, periodo, fecha y valor son requeridos." });
  }

  const kpi = db.prepare("SELECT id FROM kpis WHERE id = ?").get(kpi_id);
  if (!kpi) return res.status(404).json({ error: "KPI no encontrado." });

  // Each kpi-periodo combination is unique; upsert via replace
  const id = `M-${kpi_id}-${periodo}-${Date.now()}`;
  db.prepare(`
    INSERT INTO mediciones (id, kpi_id, periodo, fecha, valor, responsable, notas)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, kpi_id, periodo, fecha, Number(valor), responsable, notas);

  recalcKpi(kpi_id);
  audit(req.user?.nombre, "Creación", id, `Medición ${kpi_id} período ${periodo}: ${valor}`);

  const full = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id WHERE m.id = ?
  `).get(id);
  return res.status(201).json({ ...full, cumplimiento: achievement(full, full.valor) });
};

// PUT /api/mediciones/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM mediciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });

  const { valor, periodo, fecha, responsable, notas } = req.body || {};
  db.prepare(`
    UPDATE mediciones SET
      valor       = COALESCE(?, valor),
      periodo     = COALESCE(?, periodo),
      fecha       = COALESCE(?, fecha),
      responsable = COALESCE(?, responsable),
      notas       = COALESCE(?, notas)
    WHERE id = ?
  `).run(
    valor !== undefined ? Number(valor) : null,
    periodo ?? null, fecha ?? null, responsable ?? null, notas ?? null,
    req.params.id
  );

  recalcKpi(row.kpi_id);
  audit(req.user?.nombre, "Edición", req.params.id, `Medición ${req.params.id} actualizada.`);

  const updated = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id WHERE m.id = ?
  `).get(req.params.id);
  return res.json({ ...updated, cumplimiento: achievement(updated, updated.valor) });
};

// DELETE /api/mediciones/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM mediciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });
  db.prepare("DELETE FROM mediciones WHERE id = ?").run(req.params.id);
  recalcKpi(row.kpi_id);
  audit(req.user?.nombre, "Eliminación", req.params.id, `Medición eliminada del KPI ${row.kpi_id}.`);
  return res.json({ message: "Medición eliminada." });
};
