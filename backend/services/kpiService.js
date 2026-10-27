"use strict";

/**
 * Thin service layer over KPI compliance + persistence helpers.
 * Controllers may call this instead of embedding SQL/compliance directly.
 */

const db = require("../config/database");
const { achievement, semaforo } = require("../../shared/compliance");

function enrich(kpi) {
  if (!kpi) return null;
  const pct = achievement(kpi, kpi.resultado_actual);
  return {
    ...kpi,
    cumplimiento: pct,
    estado_semaforo: semaforo(kpi, pct),
  };
}

function listAll() {
  return db.prepare("SELECT * FROM kpis ORDER BY perspectiva, id").all().map(enrich);
}

function getById(id) {
  return enrich(db.prepare("SELECT * FROM kpis WHERE id = ?").get(id));
}

function recalcFromApprovedMeasurements(kpiId) {
  const latest = db.prepare(`
    SELECT valor FROM mediciones
    WHERE kpi_id = ? AND estado = 'aprobado'
    ORDER BY periodo DESC, fecha DESC LIMIT 1
  `).get(kpiId);
  db.prepare("UPDATE kpis SET resultado_actual = ? WHERE id = ?").run(
    latest ? latest.valor : null,
    kpiId
  );
  return getById(kpiId);
}

module.exports = {
  enrich,
  listAll,
  getById,
  recalcFromApprovedMeasurements,
  achievement,
  semaforo,
};
