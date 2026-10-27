"use strict";

const db = require("../config/database");
const { achievement, semaforo } = require("../../shared/compliance");
const { audit } = require("../utils/audit");
const { newId } = require("../utils/ids");
const { parse, kpiSchema } = require("../utils/validate");

function enrichKpi(kpi) {
  if (!kpi) return null;
  const pct = achievement(kpi, kpi.resultado_actual);
  const estado_semaforo = semaforo(kpi, pct);
  const objetivo = db.prepare("SELECT id, nombre, perspectiva FROM objetivos WHERE id = ?").get(kpi.objetivo_id);
  const trabajador = kpi.trabajador_id
    ? db.prepare("SELECT id, nombre, apellido, cargo FROM trabajadores WHERE id = ?").get(kpi.trabajador_id)
    : null;
  const mediciones = db.prepare(
    "SELECT * FROM mediciones WHERE kpi_id = ? ORDER BY periodo DESC LIMIT 12"
  ).all(kpi.id);
  return { ...kpi, cumplimiento: pct, estado_semaforo, objetivo, trabajador, mediciones };
}

exports.list = (req, res) => {
  const { perspectiva, objetivo_id, area, estado_semaforo: sfFilter, q } = req.query;
  let sql = "SELECT * FROM kpis WHERE 1=1";
  const params = [];

  if (perspectiva) { sql += " AND perspectiva = ?"; params.push(perspectiva); }
  if (objetivo_id) { sql += " AND objetivo_id = ?"; params.push(objetivo_id); }
  if (area) { sql += " AND area = ?"; params.push(area); }
  if (q) {
    sql += " AND (nombre LIKE ? OR formula LIKE ? OR responsable LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY perspectiva, id";

  let rows = db.prepare(sql).all(...params).map((k) => {
    const pct = achievement(k, k.resultado_actual);
    const sf = semaforo(k, pct);
    return { ...k, cumplimiento: pct, estado_semaforo: sf };
  });

  if (sfFilter) rows = rows.filter((k) => k.estado_semaforo.key === sfFilter);
  return res.json(rows);
};

exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });
  return res.json(enrichKpi(row));
};

exports.create = (req, res) => {
  try {
    const data = parse(kpiSchema, req.body || {});
    const id = newId("kpi");
    db.prepare(`
      INSERT INTO kpis (id, nombre, perspectiva, objetivo_id, unidad, formula, descripcion,
        linea_base, meta, resultado_actual, direccion, rango_inferior, rango_superior,
        frecuencia, responsable, trabajador_id, area, peso, umbral_alerta, umbral_critico, estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.nombre.trim(), data.perspectiva, data.objetivo_id, data.unidad, data.formula, data.descripcion,
      data.linea_base ?? null, data.meta ?? null, data.resultado_actual ?? null, data.direccion,
      data.rango_inferior ?? null, data.rango_superior ?? null, data.frecuencia, data.responsable,
      data.trabajador_id || null, data.area, data.peso, data.umbral_alerta, data.umbral_critico, data.estado
    );

    audit(req.user?.nombre, "Creación", "kpis", id, `KPI ${id}: ${data.nombre}`);
    return res.status(201).json(enrichKpi(db.prepare("SELECT * FROM kpis WHERE id = ?").get(id)));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });

  const fields = [
    "nombre", "perspectiva", "objetivo_id", "unidad", "formula", "descripcion",
    "linea_base", "meta", "resultado_actual", "direccion", "rango_inferior", "rango_superior",
    "frecuencia", "responsable", "trabajador_id", "area", "peso", "umbral_alerta", "umbral_critico", "estado",
  ];
  const numFields = new Set([
    "linea_base", "meta", "resultado_actual", "rango_inferior", "rango_superior",
    "peso", "umbral_alerta", "umbral_critico",
  ]);
  const setClauses = [];
  const params = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      setClauses.push(`${f} = ?`);
      let val = req.body[f];
      if (numFields.has(f)) val = val !== null && val !== "" ? Number(val) : null;
      if (f === "trabajador_id") val = val || null;
      params.push(val);
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });

  params.push(req.params.id);
  db.prepare(`UPDATE kpis SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

  audit(req.user?.nombre, "Edición", "kpis", req.params.id, `KPI ${req.params.id} actualizado.`);
  return res.json(enrichKpi(db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id)));
};

exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });
  try {
    db.prepare("DELETE FROM kpis WHERE id = ?").run(req.params.id);
  } catch (e) {
    return res.status(409).json({ error: "No se puede eliminar el KPI: tiene registros dependientes." });
  }
  audit(req.user?.nombre, "Eliminación", "kpis", req.params.id, `KPI ${row.nombre} eliminado.`);
  return res.json({ message: "KPI eliminado." });
};

exports.achievement = achievement;
exports.semaforo = semaforo;
exports.enrichKpi = enrichKpi;
