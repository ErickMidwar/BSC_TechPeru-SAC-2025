"use strict";

const db = require("../config/database");

// ── Compliance engine ─────────────────────────────────────────────────────────

function achievement(kpi, value) {
  if (value === null || value === undefined || kpi.meta === null) return null;
  value = Number(value);
  const meta = Number(kpi.meta);

  if (kpi.direccion === "rango") {
    const lo = Number(kpi.rango_inferior), hi = Number(kpi.rango_superior);
    if (value >= lo && value <= hi) return 100;
    const dist = value < lo ? lo - value : value - hi;
    const span = Math.max(1, Math.abs(hi - lo));
    return Math.max(0, 100 - (dist / span) * 100);
  }
  if (kpi.direccion === "menor") {
    if (value <= meta) return 100;
    if (meta <= 0 || value <= 0) return 0;
    return Math.max(0, Math.min(100, (meta / value) * 100));
  }
  if (meta === 0) return value >= 0 ? 100 : 0;
  return Math.max(0, Math.min(150, (value / meta) * 100));
}

function semaforo(kpi, pct) {
  if (pct === null) return { key: "neutral", label: "Sin datos" };
  const alerta = Number(kpi.umbral_alerta ?? 80);
  const critico = Number(kpi.umbral_critico ?? 60);
  if (pct >= 100) return { key: "good", label: "Logrado" };
  if (pct >= alerta) return { key: "warn", label: "En riesgo" };
  if (pct >= critico) return { key: "warn", label: "En alerta" };
  return { key: "bad", label: "Crítico" };
}

function enrichKpi(kpi) {
  if (!kpi) return null;
  const pct = achievement(kpi, kpi.resultado_actual);
  const estado_semaforo = semaforo(kpi, pct);
  const objetivo = db.prepare("SELECT id, nombre, perspectiva FROM objetivos WHERE id = ?").get(kpi.objetivo_id);
  const trabajador = kpi.trabajador_id
    ? db.prepare("SELECT id, nombre, apellido, cargo FROM trabajadores WHERE id = ?").get(kpi.trabajador_id)
    : null;
  const mediciones = db.prepare("SELECT * FROM mediciones WHERE kpi_id = ? ORDER BY periodo DESC LIMIT 12").all(kpi.id);
  return { ...kpi, cumplimiento: pct, estado_semaforo, objetivo, trabajador, mediciones };
}

function newId() {
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(id,5) AS INTEGER)) as m FROM kpis").get().m || 0;
  return "KPI-" + String(max + 1).padStart(2, "0");
}

function audit(user, accion, entidad_id, detalle) {
  db.prepare("INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)")
    .run(`AUD-${Date.now()}`, user || "Sistema", accion, "kpis", entidad_id, detalle);
}

// GET /api/kpis
exports.list = (req, res) => {
  const { perspectiva, objetivo_id, area, estado_semaforo: sfFilter, q } = req.query;
  let sql = "SELECT * FROM kpis WHERE 1=1";
  const params = [];

  if (perspectiva)  { sql += " AND perspectiva = ?";   params.push(perspectiva); }
  if (objetivo_id)  { sql += " AND objetivo_id = ?";   params.push(objetivo_id); }
  if (area)         { sql += " AND area = ?";          params.push(area); }
  if (q) {
    sql += " AND (nombre LIKE ? OR formula LIKE ? OR responsable LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY perspectiva, id";

  let rows = db.prepare(sql).all(...params).map(k => {
    const pct = achievement(k, k.resultado_actual);
    const sf  = semaforo(k, pct);
    return { ...k, cumplimiento: pct, estado_semaforo: sf };
  });

  if (sfFilter) rows = rows.filter(k => k.estado_semaforo.key === sfFilter);
  return res.json(rows);
};

// GET /api/kpis/:id
exports.getOne = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });
  return res.json(enrichKpi(row));
};

// POST /api/kpis
exports.create = (req, res) => {
  const {
    nombre, perspectiva, objetivo_id, unidad = "%", formula = "", descripcion = "",
    linea_base, meta, resultado_actual = null, direccion = "mayor",
    rango_inferior = null, rango_superior = null, frecuencia = "Mensual",
    responsable = "", trabajador_id = null, area = "", peso = 1,
    umbral_alerta = 80, umbral_critico = 60, estado = "Activo"
  } = req.body || {};

  if (!nombre || !perspectiva || !objetivo_id) {
    return res.status(400).json({ error: "nombre, perspectiva y objetivo_id son requeridos." });
  }

  const id = newId();
  db.prepare(`
    INSERT INTO kpis (id, nombre, perspectiva, objetivo_id, unidad, formula, descripcion,
      linea_base, meta, resultado_actual, direccion, rango_inferior, rango_superior,
      frecuencia, responsable, trabajador_id, area, peso, umbral_alerta, umbral_critico, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, nombre.trim(), perspectiva, objetivo_id, unidad, formula, descripcion,
         linea_base !== undefined ? Number(linea_base) : null,
         meta !== undefined ? Number(meta) : null,
         resultado_actual !== null ? Number(resultado_actual) : null,
         direccion,
         rango_inferior !== null ? Number(rango_inferior) : null,
         rango_superior !== null ? Number(rango_superior) : null,
         frecuencia, responsable, trabajador_id || null, area,
         Number(peso), Number(umbral_alerta), Number(umbral_critico), estado);

  audit(req.user?.nombre, "Creación", id, `KPI ${id}: ${nombre}`);
  return res.status(201).json(enrichKpi(db.prepare("SELECT * FROM kpis WHERE id = ?").get(id)));
};

// PUT /api/kpis/:id
exports.update = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });

  const fields = [
    "nombre", "perspectiva", "objetivo_id", "unidad", "formula", "descripcion",
    "linea_base", "meta", "resultado_actual", "direccion", "rango_inferior", "rango_superior",
    "frecuencia", "responsable", "trabajador_id", "area", "peso", "umbral_alerta", "umbral_critico", "estado"
  ];
  const numFields = new Set(["linea_base","meta","resultado_actual","rango_inferior","rango_superior","peso","umbral_alerta","umbral_critico"]);
  const setClauses = [];
  const params = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      setClauses.push(`${f} = ?`);
      let val = req.body[f];
      if (numFields.has(f)) val = val !== null ? Number(val) : null;
      if (f === "trabajador_id") val = val || null;
      params.push(val);
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });

  params.push(req.params.id);
  db.prepare(`UPDATE kpis SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

  audit(req.user?.nombre, "Edición", req.params.id, `KPI ${req.params.id} actualizado.`);
  return res.json(enrichKpi(db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id)));
};

// DELETE /api/kpis/:id
exports.remove = (req, res) => {
  const row = db.prepare("SELECT * FROM kpis WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "KPI no encontrado." });
  db.prepare("DELETE FROM kpis WHERE id = ?").run(req.params.id);
  audit(req.user?.nombre, "Eliminación", req.params.id, `KPI ${row.nombre} eliminado.`);
  return res.json({ message: "KPI eliminado." });
};

// Expose helpers for other controllers
exports.achievement = achievement;
exports.semaforo = semaforo;
