"use strict";

const db = require("../config/database");
const { achievement, semaforo } = require("../../shared/compliance");

const PERSPECTIVES = ["financiera", "clientes", "procesos", "aprendizaje"];
const PERSP_LABELS = {
  financiera: "Financiera",
  clientes: "Clientes",
  procesos: "Procesos internos",
  aprendizaje: "Aprendizaje y crecimiento",
};

function weightedAvg(items) {
  const valid = items.filter((x) => x.pct !== null && x.pct !== undefined);
  if (!valid.length) return null;
  const sumW = valid.reduce((a, x) => a + Math.max(0, Number(x.weight ?? 1)), 0);
  if (sumW <= 0) return null;
  return valid.reduce((a, x) => a + x.pct * Math.max(0, Number(x.weight ?? 1)), 0) / sumW;
}

exports.summary = (req, res) => {
  const year = req.query.year ? String(req.query.year) : null;
  const kpis = db.prepare("SELECT * FROM kpis").all();
  const objetivos = db.prepare("SELECT * FROM objetivos").all();
  const iniciativas = db.prepare("SELECT * FROM iniciativas").all();
  const relaciones = db.prepare(`
    SELECT r.*, o1.nombre as from_nombre, o1.perspectiva as from_perspectiva,
           o2.nombre as to_nombre, o2.perspectiva as to_perspectiva
    FROM objetivo_relaciones r
    JOIN objetivos o1 ON o1.id = r.from_id
    JOIN objetivos o2 ON o2.id = r.to_id
  `).all();

  // Latest approved value per KPI, optionally scoped to year
  const kpiWithCompliance = kpis.map((k) => {
    let valor = k.resultado_actual;
    if (year) {
      const m = db.prepare(`
        SELECT valor FROM mediciones
        WHERE kpi_id = ? AND estado = 'aprobado' AND periodo LIKE ?
        ORDER BY periodo DESC, fecha DESC LIMIT 1
      `).get(k.id, `${year}-%`);
      valor = m ? m.valor : null;
    }
    const pct = achievement(k, valor);
    const sf = semaforo(k, pct);
    return { ...k, resultado_actual: valor, cumplimiento: pct, estado_semaforo: sf };
  });

  const kpiStats = { logrado: 0, en_riesgo: 0, critico: 0, sin_datos: 0, total: kpis.length };
  for (const k of kpiWithCompliance) {
    if (k.estado_semaforo.key === "good") kpiStats.logrado++;
    else if (k.estado_semaforo.key === "warn") kpiStats.en_riesgo++;
    else if (k.estado_semaforo.key === "bad") kpiStats.critico++;
    else kpiStats.sin_datos++;
  }

  const por_perspectiva = PERSPECTIVES.map((p) => {
    const perspKpis = kpiWithCompliance.filter((k) => k.perspectiva === p);
    const perspObj = objetivos.filter((o) => o.perspectiva === p);
    const pct = weightedAvg(perspKpis.map((k) => ({ pct: k.cumplimiento, weight: k.peso })));
    return {
      perspectiva: p,
      label: PERSP_LABELS[p],
      kpi_count: perspKpis.length,
      objetivo_count: perspObj.length,
      cumplimiento: pct !== null ? +pct.toFixed(1) : null,
    };
  });

  const globalPct = weightedAvg(por_perspectiva.map((p) => ({ pct: p.cumplimiento, weight: 25 })));

  let monthsSql = `
    SELECT DISTINCT periodo FROM mediciones
    WHERE estado = 'aprobado'
  `;
  const monthParams = [];
  if (year) {
    monthsSql += " AND periodo LIKE ?";
    monthParams.push(`${year}-%`);
  }
  monthsSql += " ORDER BY periodo DESC LIMIT 6";
  const months = db.prepare(monthsSql).all(...monthParams).map((r) => r.periodo).reverse();

  // Batch fetch measurements for trend (avoid N+1)
  const tendencia = months.map((mes) => {
    const rows = db.prepare(`
      SELECT m.kpi_id, m.valor, k.meta, k.direccion, k.rango_inferior, k.rango_superior
      FROM mediciones m JOIN kpis k ON k.id = m.kpi_id
      WHERE m.periodo = ? AND m.estado = 'aprobado'
    `).all(mes);

    const vals = rows.map((r) => achievement(r, r.valor)).filter((v) => v !== null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { periodo: mes, cumplimiento: avg !== null ? +avg.toFixed(1) : null };
  });

  const criticos = kpiWithCompliance
    .filter((k) => ["bad", "warn"].includes(k.estado_semaforo.key))
    .sort((a, b) => (a.cumplimiento ?? 0) - (b.cumplimiento ?? 0))
    .slice(0, 10)
    .map((k) => ({
      id: k.id, nombre: k.nombre, perspectiva: k.perspectiva,
      resultado_actual: k.resultado_actual, meta: k.meta, unidad: k.unidad,
      cumplimiento: k.cumplimiento, estado_semaforo: k.estado_semaforo,
      responsable: k.responsable,
    }));

  const pendientes = db.prepare(`
    SELECT COUNT(*) as c FROM mediciones WHERE estado = 'pendiente'
  `).get().c;

  const alertaItems = [
    ...criticos.slice(0, 5).map((k) => ({
      tipo: "kpi",
      titulo: k.nombre,
      detalle: `${k.estado_semaforo.label} · ${k.cumplimiento != null ? k.cumplimiento.toFixed(0) + "%" : "—"}`,
      severidad: k.estado_semaforo.key,
      id: k.id,
    })),
  ];
  if (pendientes > 0) {
    alertaItems.unshift({
      tipo: "workflow",
      titulo: `${pendientes} medición(es) pendientes de aprobación`,
      detalle: "Revisa el registro de resultados",
      severidad: "warn",
      id: null,
    });
  }

  return res.json({
    year: year || "all",
    cumplimiento_global: globalPct !== null ? +globalPct.toFixed(1) : null,
    kpis: kpiStats,
    por_perspectiva,
    tendencia,
    criticos,
    alertas: alertaItems,
    relaciones_causa_efecto: relaciones,
    objetivos: {
      total: objetivos.length,
      activos: objetivos.filter((o) => o.estado === "Activo").length,
    },
    iniciativas: {
      total: iniciativas.length,
      en_ejecucion: iniciativas.filter((i) => i.estado === "En ejecución").length,
      planificadas: iniciativas.filter((i) => i.estado === "Planificada").length,
      finalizadas: iniciativas.filter((i) => i.estado === "Finalizada").length,
      avance_promedio: iniciativas.length
        ? +(iniciativas.reduce((a, i) => a + i.avance, 0) / iniciativas.length).toFixed(1)
        : 0,
    },
    mediciones_pendientes: pendientes,
  });
};

exports.audit = (req, res) => {
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY fecha DESC LIMIT 50").all();
  return res.json(rows);
};

exports.alertas = (req, res) => {
  // Reuse summary alertas subset
  req.query = req.query || {};
  const fakeRes = {
    json(payload) { return payload; },
  };
  // Call summary logic inline via temporary handler is awkward; query directly:
  const criticos = db.prepare("SELECT * FROM kpis").all().map((k) => {
    const pct = achievement(k, k.resultado_actual);
    const sf = semaforo(k, pct);
    return { ...k, cumplimiento: pct, estado_semaforo: sf };
  }).filter((k) => ["bad", "warn"].includes(k.estado_semaforo.key));

  const pendientes = db.prepare("SELECT COUNT(*) as c FROM mediciones WHERE estado = 'pendiente'").get().c;
  const items = [];
  if (pendientes > 0) {
    items.push({
      tipo: "workflow",
      titulo: `${pendientes} medición(es) pendientes de aprobación`,
      detalle: "Registro de resultados",
      severidad: "warn",
    });
  }
  for (const k of criticos.slice(0, 8)) {
    items.push({
      tipo: "kpi",
      titulo: k.nombre,
      detalle: `${k.estado_semaforo.label} · ${k.id}`,
      severidad: k.estado_semaforo.key,
      id: k.id,
    });
  }
  return res.json({ items, count: items.length });
};
