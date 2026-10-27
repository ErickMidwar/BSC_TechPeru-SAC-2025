"use strict";

const db = require("../config/database");
const { achievement } = require("../../shared/compliance");
const { canApproveMeasurement } = require("../../shared/compliance");
const { audit } = require("../utils/audit");
const { newId } = require("../utils/ids");
const { parse, medicionSchema } = require("../utils/validate");

/**
 * Recalculate KPI resultado_actual from the latest *approved* measurement.
 */
function recalcKpi(kpi_id) {
  const latest = db.prepare(`
    SELECT valor FROM mediciones
    WHERE kpi_id = ? AND estado = 'aprobado'
    ORDER BY periodo DESC, fecha DESC LIMIT 1
  `).get(kpi_id);

  db.prepare("UPDATE kpis SET resultado_actual = ? WHERE id = ?").run(
    latest ? latest.valor : null,
    kpi_id
  );
}

function enrich(row) {
  if (!row) return null;
  return { ...row, cumplimiento: achievement(row, row.valor) };
}

exports.list = (req, res) => {
  const { kpi_id, periodo, estado, q, year } = req.query;
  let sql = `
    SELECT m.*, k.nombre as kpi_nombre, k.perspectiva, k.unidad,
           k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m
    LEFT JOIN kpis k ON k.id = m.kpi_id
    WHERE 1=1
  `;
  const params = [];

  if (kpi_id) { sql += " AND m.kpi_id = ?"; params.push(kpi_id); }
  if (periodo) { sql += " AND m.periodo = ?"; params.push(periodo); }
  if (estado) { sql += " AND m.estado = ?"; params.push(estado); }
  if (year) { sql += " AND m.periodo LIKE ?"; params.push(`${year}-%`); }
  if (q) {
    sql += " AND (k.nombre LIKE ? OR m.responsable LIKE ? OR m.notas LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY m.periodo DESC, m.fecha DESC";

  const rows = db.prepare(sql).all(...params).map(enrich);
  return res.json(rows);
};

exports.getOne = (req, res) => {
  const row = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });
  return res.json(enrich(row));
};

exports.create = (req, res) => {
  try {
    const data = parse(medicionSchema, req.body || {});
    const kpi = db.prepare("SELECT id FROM kpis WHERE id = ?").get(data.kpi_id);
    if (!kpi) return res.status(404).json({ error: "KPI no encontrado." });

    // Responsable creates as pendiente; editors may create as aprobado
    let estado = data.estado || "pendiente";
    if (!canApproveMeasurement(req.user?.rol) && estado === "aprobado") {
      estado = "pendiente";
    }
    if (canApproveMeasurement(req.user?.rol) && !req.body?.estado) {
      estado = "aprobado";
    }

    const existing = db.prepare(
      "SELECT id FROM mediciones WHERE kpi_id = ? AND periodo = ?"
    ).get(data.kpi_id, data.periodo);

    let id;
    if (existing) {
      id = existing.id;
      db.prepare(`
        UPDATE mediciones SET fecha=?, valor=?, responsable=?, notas=?, estado=?
        WHERE id=?
      `).run(data.fecha, Number(data.valor), data.responsable, data.notas, estado, id);
      audit(req.user?.nombre, "Edición", "mediciones", id, `Upsert medición ${data.kpi_id} ${data.periodo}`);
    } else {
      id = newId("med");
      db.prepare(`
        INSERT INTO mediciones (id, kpi_id, periodo, fecha, valor, responsable, notas, estado)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(id, data.kpi_id, data.periodo, data.fecha, Number(data.valor), data.responsable, data.notas, estado);
      audit(req.user?.nombre, "Creación", "mediciones", id, `Medición ${data.kpi_id} período ${data.periodo}: ${data.valor}`);
    }

    if (estado === "aprobado") recalcKpi(data.kpi_id);

    const full = db.prepare(`
      SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
      FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id WHERE m.id = ?
    `).get(id);
    return res.status(existing ? 200 : 201).json(enrich(full));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM mediciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });

  const { valor, periodo, fecha, responsable, notas, estado } = req.body || {};
  let nextEstado = estado ?? row.estado;
  if (estado && !canApproveMeasurement(req.user?.rol) && ["aprobado", "rechazado"].includes(estado)) {
    return res.status(403).json({ error: "No puedes aprobar o rechazar mediciones." });
  }

  db.prepare(`
    UPDATE mediciones SET
      valor       = COALESCE(?, valor),
      periodo     = COALESCE(?, periodo),
      fecha       = COALESCE(?, fecha),
      responsable = COALESCE(?, responsable),
      notas       = COALESCE(?, notas),
      estado      = ?
    WHERE id = ?
  `).run(
    valor !== undefined ? Number(valor) : null,
    periodo ?? null, fecha ?? null, responsable ?? null, notas ?? null,
    nextEstado,
    req.params.id
  );

  recalcKpi(row.kpi_id);
  audit(req.user?.nombre, "Edición", "mediciones", req.params.id, `Medición ${req.params.id} actualizada.`);

  const updated = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id WHERE m.id = ?
  `).get(req.params.id);
  return res.json(enrich(updated));
};

exports.approve = (req, res) => {
  const row = db.prepare("SELECT * FROM mediciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });

  const estado = req.body?.estado === "rechazado" ? "rechazado" : "aprobado";
  db.prepare("UPDATE mediciones SET estado = ? WHERE id = ?").run(estado, req.params.id);
  recalcKpi(row.kpi_id);
  audit(req.user?.nombre, estado === "aprobado" ? "Aprobación" : "Rechazo", "mediciones", req.params.id, `Medición ${estado}`);

  const updated = db.prepare(`
    SELECT m.*, k.nombre as kpi_nombre, k.unidad, k.meta, k.direccion, k.umbral_alerta, k.umbral_critico
    FROM mediciones m LEFT JOIN kpis k ON k.id = m.kpi_id WHERE m.id = ?
  `).get(req.params.id);
  return res.json(enrich(updated));
};

exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM mediciones WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Medición no encontrada." });
  db.prepare("DELETE FROM mediciones WHERE id = ?").run(req.params.id);
  recalcKpi(row.kpi_id);
  audit(req.user?.nombre, "Eliminación", "mediciones", req.params.id, `Medición eliminada del KPI ${row.kpi_id}.`);
  return res.json({ message: "Medición eliminada." });
};
