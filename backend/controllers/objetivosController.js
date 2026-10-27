"use strict";

const db = require("../config/database");
const { audit } = require("../utils/audit");
const { newId } = require("../utils/ids");
const { parse, objetivoSchema } = require("../utils/validate");
const { achievement, semaforo } = require("../../shared/compliance");

function enrichObjetivo(obj) {
  if (!obj) return null;
  const kpis = db.prepare(
    "SELECT id, nombre, resultado_actual, meta, direccion, umbral_alerta, umbral_critico, peso FROM kpis WHERE objetivo_id = ?"
  ).all(obj.id).map((k) => {
    const pct = achievement(k, k.resultado_actual);
    return { ...k, cumplimiento: pct, estado_semaforo: semaforo(k, pct) };
  });
  const trabajador = obj.trabajador_id
    ? db.prepare("SELECT id, nombre, apellido, cargo, area FROM trabajadores WHERE id = ?").get(obj.trabajador_id)
    : null;
  const causas = db.prepare(`
    SELECT r.id, r.from_id as id_objetivo, o.nombre, o.perspectiva, r.descripcion
    FROM objetivo_relaciones r JOIN objetivos o ON o.id = r.from_id
    WHERE r.to_id = ?
  `).all(obj.id);
  const efectos = db.prepare(`
    SELECT r.id, r.to_id as id_objetivo, o.nombre, o.perspectiva, r.descripcion
    FROM objetivo_relaciones r JOIN objetivos o ON o.id = r.to_id
    WHERE r.from_id = ?
  `).all(obj.id);
  return { ...obj, kpis, trabajador, causas, efectos };
}

exports.list = (req, res) => {
  const { perspectiva, estado, prioridad, q } = req.query;
  let sql = "SELECT * FROM objetivos WHERE 1=1";
  const params = [];

  if (perspectiva) { sql += " AND perspectiva = ?"; params.push(perspectiva); }
  if (estado) { sql += " AND estado = ?"; params.push(estado); }
  if (prioridad) { sql += " AND prioridad = ?"; params.push(prioridad); }
  if (q) {
    sql += " AND (nombre LIKE ? OR descripcion LIKE ? OR responsable LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY perspectiva, id";

  const rows = db.prepare(sql).all(...params).map((o) => {
    const kpis = db.prepare("SELECT id FROM kpis WHERE objetivo_id = ?").all(o.id);
    return { ...o, kpi_count: kpis.length };
  });
  return res.json(rows);
};

exports.relaciones = (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, o1.nombre as from_nombre, o1.perspectiva as from_perspectiva,
           o2.nombre as to_nombre, o2.perspectiva as to_perspectiva
    FROM objetivo_relaciones r
    JOIN objetivos o1 ON o1.id = r.from_id
    JOIN objetivos o2 ON o2.id = r.to_id
  `).all();
  return res.json(rows);
};

exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Objetivo no encontrado." });
  return res.json(enrichObjetivo(row));
};

exports.create = (req, res) => {
  try {
    const data = parse(objetivoSchema, req.body || {});
    const id = newId("obj");
    db.prepare(`
      INSERT INTO objetivos (id, nombre, perspectiva, descripcion, responsable, trabajador_id, prioridad, peso, estado)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      id, data.nombre.trim(), data.perspectiva, data.descripcion, data.responsable,
      data.trabajador_id || null, data.prioridad, Number(data.peso), data.estado
    );

    audit(req.user?.nombre, "Creación", "objetivos", id, `Objetivo ${id}: ${data.nombre}`);
    return res.status(201).json(enrichObjetivo(db.prepare("SELECT * FROM objetivos WHERE id = ?").get(id)));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

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

  audit(req.user?.nombre, "Edición", "objetivos", req.params.id, `Objetivo ${req.params.id} actualizado.`);
  return res.json(enrichObjetivo(db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id)));
};

exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM objetivos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Objetivo no encontrado." });

  const kpiCount = db.prepare("SELECT COUNT(*) as c FROM kpis WHERE objetivo_id = ?").get(req.params.id).c;
  if (kpiCount > 0) {
    return res.status(409).json({ error: `No se puede eliminar: el objetivo tiene ${kpiCount} KPI(s) asociados.` });
  }

  db.prepare("DELETE FROM objetivos WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Eliminación", "objetivos", req.params.id, `Objetivo ${row.nombre} eliminado.`);
  return res.json({ message: "Objetivo eliminado." });
};
