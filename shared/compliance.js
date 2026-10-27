/**
 * Shared KPI compliance / traffic-light engine.
 * Works in Node (CommonJS) and in the browser (global BscCompliance).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BscCompliance = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function achievement(kpi, value) {
    if (value === null || value === undefined || value === "" || kpi == null || kpi.meta === null || kpi.meta === undefined) {
      return null;
    }
    value = Number(value);
    const meta = Number(kpi.meta);

    if (kpi.direccion === "rango") {
      const lo = Number(kpi.rango_inferior);
      const hi = Number(kpi.rango_superior);
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
    if (pct === null || pct === undefined) return { key: "neutral", label: "Sin datos" };
    const alerta = Number(kpi?.umbral_alerta ?? 80);
    const critico = Number(kpi?.umbral_critico ?? 60);
    if (pct >= 100) return { key: "good", label: "Logrado", pct };
    if (pct >= alerta) return { key: "warn", label: "En riesgo", pct };
    if (pct >= critico) return { key: "warn", label: "En alerta", pct };
    return { key: "bad", label: "Crítico", pct };
  }

  function statusOf(kpi, value) {
    if (value === null || value === undefined || value === "") {
      return { key: "neutral", label: "Sin datos" };
    }
    const pct = kpi.cumplimiento ?? achievement(kpi, value);
    return semaforo(kpi, pct);
  }

  const ROLES = {
    ADMIN: "Administrador",
    GERENTE: "Gerente",
    RESPONSABLE: "Responsable",
  };

  function canEditStrategy(rol) {
    return rol === ROLES.ADMIN || rol === ROLES.GERENTE;
  }

  function canMeasure(rol) {
    return rol === ROLES.ADMIN || rol === ROLES.GERENTE || rol === ROLES.RESPONSABLE;
  }

  function canApproveMeasurement(rol) {
    return rol === ROLES.ADMIN || rol === ROLES.GERENTE;
  }

  function canAdmin(rol) {
    return rol === ROLES.ADMIN;
  }

  const PERSPECTIVES = {
    financiera: { label: "Financiera", color: "#3478e5", soft: "#edf4ff" },
    clientes: { label: "Clientes", color: "#18a875", soft: "#eaf8f1" },
    procesos: { label: "Procesos internos", color: "#e99a2d", soft: "#fff5e6" },
    aprendizaje: { label: "Aprendizaje y crecimiento", color: "#8b6bd6", soft: "#f2edff" },
  };

  return {
    achievement,
    semaforo,
    statusOf,
    ROLES,
    canEditStrategy,
    canMeasure,
    canApproveMeasurement,
    canAdmin,
    PERSPECTIVES,
  };
});
