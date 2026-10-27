export const API = "/api";

export const ORG = {
  name: "TechPeru SAC",
  short: "TechPeru",
  tagline: "Balanced Scorecard 2026",
};

export const pageTitles = {
  dashboard: "Dashboard ejecutivo",
  mapa: "Mapa estratégico",
  objetivos: "Objetivos estratégicos",
  kpis: "Indicadores (KPI)",
  mediciones: "Registro de resultados",
  iniciativas: "Iniciativas estratégicas",
  reportes: "Reportes",
  administracion: "Administración",
  trabajadores: "Mantenimiento de Trabajadores",
};

/** Filled from shared/compliance.js (loaded before modules). */
export const perspectives = (typeof BscCompliance !== "undefined" && BscCompliance.PERSPECTIVES)
  ? BscCompliance.PERSPECTIVES
  : {
      financiera: { label: "Financiera", color: "#3478e5", soft: "#edf4ff" },
      clientes: { label: "Clientes", color: "#18a875", soft: "#eaf8f1" },
      procesos: { label: "Procesos internos", color: "#e99a2d", soft: "#fff5e6" },
      aprendizaje: { label: "Aprendizaje y crecimiento", color: "#8b6bd6", soft: "#f2edff" },
    };

export const compliance = typeof BscCompliance !== "undefined"
  ? BscCompliance
  : {
      achievement: () => null,
      semaforo: () => ({ key: "neutral", label: "Sin datos" }),
      statusOf: () => ({ key: "neutral", label: "Sin datos" }),
      canEditStrategy: (r) => ["Administrador", "Gerente"].includes(r),
      canMeasure: (r) => ["Administrador", "Gerente", "Responsable"].includes(r),
      canApproveMeasurement: (r) => ["Administrador", "Gerente"].includes(r),
      canAdmin: (r) => r === "Administrador",
    };
