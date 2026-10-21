"use strict";

const db = require("../config/database");
const { achievement, semaforo } = require("./kpisController");

const PERSPECTIVES = ["financiera", "clientes", "procesos", "aprendizaje"];
const PERSP_LABELS = {
  financiera: "Financiera",
  clientes: "Clientes",
  procesos: "Procesos internos",
  aprendizaje: "Aprendizaje y crecimiento",
};

function weightedAvg(items) {
  const valid = items.filter(x => x.pct !== null && x.pct !== undefined);
  if (!valid.length) return null;
  const sumW = valid.reduce((a, x) => a + Math.max(0, Number(x.weight ?? 1)), 0);
  if (sumW <= 0) return null;
  return valid.reduce((a, x) => a + x.pct * Math.max(0, Number(x.weight ?? 1)), 0) / sumW;
}

// GET /api/dashboard/summary
exports.summary = (req, res) => {
  const kpis = db.prepare("SELECT * FROM kpis").all();
  const objetivos = db.prepare("SELECT * FROM objetivos").all();
  const iniciativas = db.prepare("SELECT * FROM iniciativas").all();

  // --- KPI status counts ---
  const kpiStats = { logrado: 0, en_riesgo: 0, critico: 0, sin_datos: 0, total: kpis.length };
  const kpiWithCompliance = kpis.map(k => {
    const pct = achievement(k, k.resultado_actual);
    const sf  = semaforo(k, pct);
    if (sf.key === "good")    kpiStats.logrado++;
    else if (sf.key === "warn") kpiStats.en_riesgo++;
    else if (sf.key === "bad")  kpiStats.critico++;
    else                         kpiStats.sin_datos++;
    return { ...k, cumplimiento: pct, estado_semaforo: sf };
  });

  // --- By perspective ---
  const por_perspectiva = PERSPECTIVES.map(p => {
    const perspKpis = kpiWithCompliance.filter(k => k.perspectiva === p);
    const perspObj  = objetivos.filter(o => o.perspectiva === p);
    const pct = weightedAvg(perspKpis.map(k => ({ pct: k.cumplimiento, weight: k.peso })));

    return {
      perspectiva: p,
      label: PERSP_LABELS[p],
      kpi_count: perspKpis.length,
      objetivo_count: perspObj.length,
      cumplimiento: pct !== null ? +pct.toFixed(1) : null,
    };
  });

  // --- Global compliance (equal weight per perspective) ---
  const globalPct = weightedAvg(por_perspectiva.map(p => ({ pct: p.cumplimiento, weight: 25 })));

  // --- Trend (last 6 months) ---
  const months = db.prepare(`
    SELECT DISTINCT periodo FROM mediciones
    ORDER BY periodo DESC LIMIT 6
  `).all().map(r => r.periodo).reverse();

  const tendencia = months.map(mes => {
    const vals = kpis.map(k => {
      const m = db.prepare("SELECT valor FROM mediciones WHERE kpi_id = ? AND periodo = ? LIMIT 1").get(k.id, mes);
      return m ? achievement(k, m.valor) : null;
    }).filter(v => v !== null);

    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { periodo: mes, cumplimiento: avg !== null ? +avg.toFixed(1) : null };
  });

  // --- Critical KPIs (bad or warn, sorted by compliance asc) ---
  const criticos = kpiWithCompliance
    .filter(k => ["bad", "warn"].includes(k.estado_semaforo.key))
    .sort((a, b) => (a.cumplimiento ?? 0) - (b.cumplimiento ?? 0))
    .slice(0, 10)
    .map(k => ({
      id: k.id, nombre: k.nombre, perspectiva: k.perspectiva,
      resultado_actual: k.resultado_actual, meta: k.meta, unidad: k.unidad,
      cumplimiento: k.cumplimiento, estado_semaforo: k.estado_semaforo,
      responsable: k.responsable,
    }));

  // --- Initiatives summary ---
  const iniciativaSummary = {
    total: iniciativas.length,
    en_ejecucion: iniciativas.filter(i => i.estado === "En ejecución").length,
    planificadas:  iniciativas.filter(i => i.estado === "Planificada").length,
    finalizadas:   iniciativas.filter(i => i.estado === "Finalizada").length,
    avance_promedio: iniciativas.length
      ? +(iniciativas.reduce((a, i) => a + i.avance, 0) / iniciativas.length).toFixed(1)
      : 0,
  };

  return res.json({
    cumplimiento_global: globalPct !== null ? +globalPct.toFixed(1) : null,
    kpis: kpiStats,
    por_perspectiva,
    tendencia,
    criticos,
    objetivos: {
      total: objetivos.length,
      activos: objetivos.filter(o => o.estado === "Activo").length,
    },
    iniciativas: iniciativaSummary,
  });
};

// GET /api/dashboard/audit
exports.audit = (req, res) => {
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY fecha DESC LIMIT 50").all();
  return res.json(rows);
};
