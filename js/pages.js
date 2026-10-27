import { $, $$, escapeHtml } from "./lib/dom.js";
import { pageTitles, perspectives, compliance } from "./lib/constants.js";
import { getUser, canEdit, canMeasure, canApprove, canAdmin } from "./lib/auth.js";
import { GET, POST, PUT, DELETE } from "./lib/api.js";
import { fmt, currency, today, perspectiveLabel, downloadCsv } from "./lib/format.js";
import { toast, pageHead, metricCard, showModal, closeModal, field, selectField, validateForm, optionsPerspectives } from "./lib/ui.js";

const achievement = (...a) => compliance.achievement(...a);
let charts = {};
export function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  charts = {};
}
function chartAvailable() { return typeof window.Chart !== "undefined"; }

let _nav = { currentPage: "dashboard", navigate: () => {}, renderPage: () => {}, refreshNotifications: () => {} };
export function setNavigation(api) { _nav = { ..._nav, ...api }; }
// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const year = $("#globalPeriod")?.value || "";
  const d = await GET("/dashboard/summary" + (year ? `?year=${encodeURIComponent(year)}` : ""));
  if (!d) return "";

  const gc = d.cumplimiento_global;
  return `${pageHead("Dashboard ejecutivo",
    "Monitorea el desempeño de la estrategia, identifica desviaciones y prioriza las acciones.",
    `<button class="btn primary" data-action="go-mediciones">＋ Registrar resultado</button>`)}
  <div class="grid metric-grid">
    ${metricCard("Cumplimiento estratégico", gc === null ? "Sin datos" : fmt(gc) + "%",
      `<span class="${gc >= 80 ? "trend-up" : "trend-down"}">${d.kpis.total - d.kpis.sin_datos} de ${d.kpis.total} KPI con datos</span>`, "◉")}
    ${metricCard("Objetivos estratégicos", d.objetivos.total,
      `<span class="trend-up">${d.objetivos.activos} activos</span>`, "◎", "green")}
    ${metricCard("Indicadores KPI", d.kpis.total,
      `<span class="trend-up">${d.kpis.logrado} logrados</span>`, "▥", "amber")}
    ${metricCard("Requieren atención", d.kpis.en_riesgo + d.kpis.critico,
      `<span class="${d.kpis.critico ? "trend-down" : "trend-up"}">${d.kpis.critico} críticos</span>`, "⚑", "red")}
  </div>
  <div class="grid dashboard-grid">
    <section class="panel">
      <div class="panel-head"><div><h2>Desempeño por perspectiva</h2><p>Cumplimiento ponderado por perspectiva</p></div></div>
      <div class="perspective-bars">
        ${d.por_perspectiva.map(p => `
          <div class="perspective-row">
            <div class="perspective-name"><span class="persp-dot" style="background:${perspectives[p.perspectiva]?.color || "#888"}"></span>${p.label}</div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, p.cumplimiento || 0)}%;background:${perspectives[p.perspectiva]?.color || "#888"}"></div></div>
            <div class="perspective-value">${p.cumplimiento !== null ? fmt(p.cumplimiento) + "%" : "—"}</div>
          </div>`).join("")}
      </div>
      <div class="chart-wrap short" style="margin-top:24px"><canvas id="perspectiveChart"></canvas></div>
    </section>
    <section class="panel">
      <div class="panel-head"><div><h2>Tendencia de desempeño</h2><p>Últimos meses · % de cumplimiento</p></div><button class="panel-action" data-action="go-reportes">Ver reportes →</button></div>
      <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
    </section>
  </div>
  <section class="panel">
    <div class="panel-head"><div><h2>Indicadores que requieren atención</h2></div><button class="panel-action" data-action="go-kpis">Ver todos →</button></div>
    ${criticalKpiTable(d.criticos)}
  </section>`;

  // store for charts
  window._dashData = d;
}

export function criticalKpiTable(list) {
  if (!list.length) return `<div class="empty-state"><strong>Todo en orden</strong>No hay indicadores críticos.</div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Indicador</th><th>Perspectiva</th><th>Resultado</th><th>Meta</th><th>Cumplimiento</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>
    ${list.map(k => `<tr>
      <td><span class="code">${escapeHtml(k.id)}</span><span class="subcell">${escapeHtml(k.nombre)}</span></td>
      <td>${escapeHtml(perspectiveLabel(k.perspectiva))}</td>
      <td><strong>${fmt(k.resultado_actual, 2)} ${escapeHtml(k.unidad)}</strong></td>
      <td>${fmt(k.meta, 2)} ${escapeHtml(k.unidad)}</td>
      <td>${k.cumplimiento !== null ? fmt(k.cumplimiento) + "%" : "—"}</td>
      <td>${escapeHtml(k.responsable)}</td>
      <td><span class="status ${k.estado_semaforo.key}">${k.estado_semaforo.label}</span></td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

export async function drawDashboardCharts() {
  const d = await GET("/dashboard/summary").catch(() => null);
  if (!d || !chartAvailable()) return;

  const per = d.por_perspectiva;
  const ctx = $("#perspectiveChart");
  if (ctx) charts.perspective = new Chart(ctx, {
    type: "bar",
    data: {
      labels: per.map(x => x.label),
      datasets: [{ label: "Cumplimiento (%)", data: per.map(x => x.cumplimiento || 0),
        backgroundColor: per.map(x => perspectives[x.perspectiva]?.color || "#888"),
        borderRadius: 6, maxBarThickness: 36 }]
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 120, ticks: { callback: v => v + "%" } }, x: { grid: { display: false } } } }
  });

  const ctx2 = $("#trendChart");
  if (ctx2 && d.tendencia.length) {
    charts.trend = new Chart(ctx2, {
      type: "line",
      data: {
        labels: d.tendencia.map(t => t.periodo),
        datasets: [{ label: "Cumplimiento", data: d.tendencia.map(t => t.cumplimiento),
          borderColor: "#286de0", backgroundColor: "#286de01c", fill: true, tension: 0.35,
          pointRadius: 3, pointBackgroundColor: "#286de0", spanGaps: true }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 120, ticks: { callback: v => v + "%" } }, x: { grid: { display: false } } } }
    });
  }
}

// ── MAPA ESTRATÉGICO ──────────────────────────────────────────────────────────
async function renderMap() {
  const [objetivos, kpis, relaciones] = await Promise.all([
    GET("/objetivos"), GET("/kpis"), GET("/objetivos/relaciones/all").catch(() => [])
  ]);

  const lanes = Object.entries(perspectives).map(([key, p]) => {
    const objs = objetivos.filter(o => o.perspectiva === key);
    return `<div class="map-lane">
      <div class="map-lane-label" style="background:${p.soft};color:${p.color}">${p.label}</div>
      <div class="map-lane-items">
        ${objs.map(o => {
          const ks = kpis.filter(k => k.objetivo_id === o.id);
          const avg = ks.length ? ks.reduce((a, k) => a + (k.cumplimiento ?? 0), 0) / ks.filter(k => k.cumplimiento !== null).length : null;
          const validKpis = ks.filter(k => k.cumplimiento !== null);
          const realAvg = validKpis.length ? validKpis.reduce((a, k) => a + k.cumplimiento, 0) / validKpis.length : null;
          const col = realAvg === null ? "#94a3b8" : realAvg >= 100 ? "#16845b" : realAvg >= 80 ? "#d99a19" : "#d23f49";
          return `<button class="map-objective" data-action="objective-detail" data-id="${o.id}">
            <span class="mini-status" style="background:${col}"></span>
            ${escapeHtml(o.nombre)}
            <small>${ks.length} KPI · ${realAvg === null ? "Sin datos" : fmt(realAvg) + "% cumplimiento"}</small>
          </button>`;
        }).join("") || `<span class="muted">Sin objetivos.</span>`}
      </div>
    </div>`;
  }).join("");

  return `${pageHead("Mapa estratégico", "Explora cómo los objetivos se conectan a través de las cuatro perspectivas.",
    `${canEdit() ? `<button class="btn primary" data-action="new-objective">＋ Nuevo objetivo</button>` : ""}`)}
  <section class="panel">
    <div class="panel-head"><div><h2>Mapa de objetivos estratégicos</h2><p>Selecciona cualquier objetivo para consultar sus indicadores.</p></div></div>
    <div class="strategy-map">${lanes}</div>
    <div class="map-legend" style="margin-top:18px">
      <span class="legend-item"><i class="legend-dot" style="background:#16845b"></i>≥ 100%</span>
      <span class="legend-item"><i class="legend-dot" style="background:#d99a19"></i>80–99%</span>
      <span class="legend-item"><i class="legend-dot" style="background:#d23f49"></i>&lt; 80%</span>
      <span class="legend-item"><i class="legend-dot" style="background:#94a3b8"></i>Sin datos</span>
    </div>
  </section>
  <section class="panel" style="margin-top:16px">
    <div class="panel-head"><div><h2>Relaciones causa → efecto</h2><p>Cómo los objetivos se impulsan entre perspectivas</p></div></div>
    <div class="cause-effect-list">
      ${(relaciones||[]).map(r => `
        <div class="cause-effect-item">
          <span class="tag">${escapeHtml(perspectiveLabel(r.from_perspectiva))}</span>
          <strong>${escapeHtml(r.from_nombre)}</strong>
          <span class="cause-arrow">→</span>
          <span class="tag">${escapeHtml(perspectiveLabel(r.to_perspectiva))}</span>
          <strong>${escapeHtml(r.to_nombre)}</strong>
          <small class="muted">${escapeHtml(r.descripcion||'')}</small>
        </div>`).join('') || '<p class="muted">Sin relaciones definidas.</p>'}
    </div>
  </section>`;
}

// ── OBJETIVOS ─────────────────────────────────────────────────────────────────
async function renderObjectives() {
  const items = await GET("/objetivos");
  return `${pageHead("Objetivos estratégicos", "Define los resultados prioritarios y alinea cada objetivo con su perspectiva.",
    `${canEdit() ? `<button class="btn primary" data-action="new-objective">＋ Nuevo objetivo</button>` : ""}`)}
  <div class="toolbar">
    <div class="search-box"><input id="objSearch" placeholder="Buscar objetivo, código o responsable…"></div>
    <select id="objPerspective"><option value="">Todas las perspectivas</option>
      ${Object.entries(perspectives).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}
    </select>
    <select id="objStatus"><option value="">Todos los estados</option><option>Activo</option><option>En revisión</option><option>Inactivo</option></select>
    <select id="objPriority"><option value="">Todas las prioridades</option><option>Alta</option><option>Media</option><option>Baja</option></select>
  </div>
  <div id="objectiveTableWrap" class="table-panel">${objectivesTable(items)}</div>`;
}

export function objectivesTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay objetivos</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>Código</th><th>Objetivo</th><th>Perspectiva</th><th>Responsable</th>
    <th>Prioridad</th><th>KPI</th><th>Peso</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(o => `<tr>
      <td><span class="code">${escapeHtml(o.id)}</span></td>
      <td><span class="table-title">${escapeHtml(o.nombre)}</span><span class="subcell">${escapeHtml(o.descripcion)}</span></td>
      <td>${escapeHtml(perspectiveLabel(o.perspectiva))}</td>
      <td>${escapeHtml(o.responsable)}</td>
      <td><span class="tag">${escapeHtml(o.prioridad)}</span></td>
      <td>${o.kpi_count ?? "—"}</td>
      <td>${fmt(o.peso, 0)}%</td>
      <td><span class="status ${o.estado === "Activo" ? "good" : "neutral"}">${escapeHtml(o.estado)}</span></td>
      <td><div class="table-actions">
        <button class="text-action" data-action="objective-detail" data-id="${o.id}">Ver</button>
        ${canEdit() ? `<button class="text-action" data-action="edit-objective" data-id="${o.id}">Editar</button>
        <button class="text-action" data-action="delete-objective" data-id="${o.id}">Eliminar</button>` : ""}
      </div></td>
    </tr>`).join("")}
  </tbody></table></div>
  <div class="table-bottom"><span>${items.length} objetivo(s)</span></div>`;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
async function renderKpis() {
  const items = await GET("/kpis");
  const logrado   = items.filter(k => k.estado_semaforo?.key === "good").length;
  const alerta    = items.filter(k => k.estado_semaforo?.key === "warn").length;
  const sinDatos  = items.filter(k => k.estado_semaforo?.key === "neutral").length;

  return `${pageHead("Indicadores (KPI)", "Administra fórmulas, metas, mediciones y estado de los indicadores.",
    `${canEdit() ? `<button class="btn primary" data-action="new-kpi">＋ Nuevo indicador</button>` : ""}`)}
  <div class="grid metric-grid">
    ${metricCard("Total KPI", items.length, "En el cuadro de mando", "▥")}
    ${metricCard("Logrados", logrado, "Meta alcanzada", "✓", "green")}
    ${metricCard("En alerta / riesgo", alerta, "Requieren seguimiento", "⚑", "amber")}
    ${metricCard("Sin datos", sinDatos, "Registrar una medición", "＋", "red")}
  </div>
  <div class="toolbar">
    <div class="search-box"><input id="kpiSearch" placeholder="Buscar indicador, código o fórmula…"></div>
    <select id="kpiPerspective"><option value="">Todas las perspectivas</option>
      ${Object.entries(perspectives).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}
    </select>
    <select id="kpiStatus"><option value="">Todos los estados</option>
      <option value="good">Logrado</option><option value="warn">Alerta / riesgo</option>
      <option value="bad">Crítico</option><option value="neutral">Sin datos</option>
    </select>
  </div>
  <div id="kpiTableWrap" class="table-panel">${kpisFullTable(items)}</div>`;
}

export function kpisFullTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay KPI</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>Código / Indicador</th><th>Perspectiva</th><th>Objetivo</th><th>Resultado</th>
    <th>Meta</th><th>Cumplimiento</th><th>Frecuencia</th><th>Responsable</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(k => `<tr>
      <td><span class="code">${escapeHtml(k.id)}</span><span class="subcell">${escapeHtml(k.nombre)}</span></td>
      <td>${escapeHtml(perspectiveLabel(k.perspectiva))}</td>
      <td>${escapeHtml(k.objetivo?.nombre || k.objetivo_id)}</td>
      <td><strong>${fmt(k.resultado_actual, 2)} ${escapeHtml(k.unidad)}</strong></td>
      <td>${fmt(k.meta, 2)} ${escapeHtml(k.unidad)}</td>
      <td>${k.cumplimiento !== null ? fmt(k.cumplimiento) + "%" : "—"}</td>
      <td>${escapeHtml(k.frecuencia)}</td>
      <td>${escapeHtml(k.responsable)}</td>
      <td><span class="status ${k.estado_semaforo?.key || "neutral"}">${k.estado_semaforo?.label || "Sin datos"}</span></td>
      <td><div class="table-actions">
        <button class="text-action" data-action="kpi-detail" data-id="${k.id}">Detalle</button>
        <button class="text-action" data-action="measure-kpi" data-id="${k.id}">Medir</button>
        ${canEdit() ? `<button class="text-action" data-action="edit-kpi" data-id="${k.id}">Editar</button>
        <button class="text-action" data-action="delete-kpi" data-id="${k.id}">Eliminar</button>` : ""}
      </div></td>
    </tr>`).join("")}
  </tbody></table></div>
  <div class="table-bottom"><span>${items.length} indicador(es)</span></div>`;
}

// ── MEDICIONES ────────────────────────────────────────────────────────────────
async function renderMeasurements() {
  const items = await GET("/mediciones");
  const kpis  = await GET("/kpis");
  const conMedicion = kpis.filter(k => k.resultado_actual !== null).length;
  const sinMedicion = kpis.filter(k => k.resultado_actual === null).length;
  const ultimoPeriodo = items[0]?.periodo || "—";

  return `${pageHead("Registro de resultados", "Registra valores reales para actualizar el cumplimiento y los reportes.",
    `<button class="btn primary" data-action="new-measurement">＋ Registrar medición</button>`)}
  <div class="grid metric-grid">
    ${metricCard("Mediciones registradas", items.length, "Historial completo", "↗")}
    ${metricCard("KPI con medición", conMedicion, "Con datos actuales", "▥", "green")}
    ${metricCard("Último período", ultimoPeriodo, "Fecha más reciente", "◷", "amber")}
    ${metricCard("Pendientes de dato", sinMedicion, "Sin resultado actual", "!", "red")}
  </div>
  <div class="toolbar">
    <div class="search-box"><input id="measurementSearch" placeholder="Buscar KPI o responsable…"></div>
    <select id="measurementKpi"><option value="">Todos los KPI</option>
      ${kpis.map(k => `<option value="${k.id}">${escapeHtml(k.id + " · " + k.nombre)}</option>`).join("")}
    </select>
    <input id="measurementMonth" type="month" value="${new Date().toISOString().slice(0,7)}" aria-label="Filtrar por mes">
    <button class="btn" data-action="export-measurements">↓ CSV</button>
  </div>
  <div id="measurementTableWrap" class="table-panel">${measurementTable(items)}</div>`;
}

export function measurementTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>Sin mediciones</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>Fecha</th><th>Período</th><th>Indicador</th><th>Valor</th><th>Cumplimiento</th><th>Estado</th><th>Responsable</th><th>Observaciones</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(x => `<tr>
      <td>${escapeHtml(x.fecha)}</td>
      <td>${escapeHtml(x.periodo)}</td>
      <td><span class="code">${escapeHtml(x.kpi_id)}</span><span class="subcell">${escapeHtml(x.kpi_nombre || "")}</span></td>
      <td><strong>${fmt(x.valor, 2)} ${escapeHtml(x.unidad || "")}</strong></td>
      <td>${x.cumplimiento !== null && x.cumplimiento !== undefined ? fmt(x.cumplimiento) + "%" : "—"}</td>
      <td><span class="status ${x.estado==='aprobado'?'good':x.estado==='pendiente'?'warn':x.estado==='rechazado'?'bad':'neutral'}">${escapeHtml(x.estado||'aprobado')}</span></td>
      <td>${escapeHtml(x.responsable)}</td>
      <td>${escapeHtml(x.notas || "—")}</td>
      <td><div class="table-actions">
        ${canMeasure() ? `<button class="text-action" data-action="edit-measurement" data-id="${x.id}" data-kpi="${x.kpi_id}">Editar</button>` : ''}
        ${canApprove() && x.estado==='pendiente' ? `<button class="text-action" data-action="approve-measurement" data-id="${x.id}">Aprobar</button>
        <button class="text-action" data-action="reject-measurement" data-id="${x.id}">Rechazar</button>` : ''}
        ${canApprove() ? `<button class="text-action" data-action="delete-measurement" data-id="${x.id}">Eliminar</button>` : ''}
      </div></td>
    </tr>`).join("")}
  </tbody></table></div>
  <div class="table-bottom"><span>${items.length} medición(es)</span></div>`;
}

// ── INICIATIVAS ───────────────────────────────────────────────────────────────
async function renderInitiatives() {
  const items = await GET("/iniciativas");
  return `${pageHead("Iniciativas estratégicas", "Convierte los objetivos en proyectos con responsables, presupuesto y seguimiento.",
    `${canEdit() ? `<button class="btn primary" data-action="new-initiative">＋ Nueva iniciativa</button>` : ""}`)}
  <div class="grid metric-grid">
    ${metricCard("Total iniciativas", items.length, "Portafolio estratégico", "◈")}
    ${metricCard("En ejecución", items.filter(i => i.estado === "En ejecución").length, "Trabajo activo", "↗", "green")}
    ${metricCard("Planificadas", items.filter(i => i.estado === "Planificada").length, "Pendientes de inicio", "◷", "amber")}
    ${metricCard("Finalizadas", items.filter(i => i.estado === "Finalizada").length, "Completadas", "✓", "green")}
  </div>
  <div class="toolbar">
    <div class="search-box"><input id="initiativeSearch" placeholder="Buscar iniciativa u objetivo…"></div>
    <select id="initiativeStatus"><option value="">Todos los estados</option>
      <option>Planificada</option><option>En ejecución</option><option>En riesgo</option><option>Finalizada</option><option>Cancelada</option>
    </select>
  </div>
  <div id="initiativeTableWrap" class="table-panel">${initiativesTable(items)}</div>`;
}

export function initiativesTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay iniciativas</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>Iniciativa</th><th>Objetivo</th><th>Responsable</th><th>Fechas</th><th>Presupuesto</th><th>Ejecutado</th><th>Avance</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(i => `<tr>
      <td><span class="code">${escapeHtml(i.id)}</span><span class="subcell">${escapeHtml(i.nombre)}</span></td>
      <td>${escapeHtml(i.objetivo?.nombre || i.objetivo_id)}</td>
      <td>${escapeHtml(i.responsable)}<span class="subcell">${escapeHtml(i.area)}</span></td>
      <td>${escapeHtml(i.fecha_inicio)}<span class="subcell">hasta ${escapeHtml(i.fecha_fin)}</span></td>
      <td>${currency(i.presupuesto)}</td>
      <td>${currency(i.ejecutado)}</td>
      <td><div class="initiative-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,i.avance))}%;background:${i.avance===100?"#16845b":"#3478e5"}"></div></div>
        <b>${fmt(i.avance, 0)}%</b>
      </div></td>
      <td><span class="status ${i.estado==="Finalizada"?"good":i.estado==="En riesgo"?"bad":i.estado==="Planificada"?"neutral":"blue"}">${escapeHtml(i.estado)}</span></td>
      <td><div class="table-actions">
        <button class="text-action" data-action="initiative-detail" data-id="${i.id}">Detalle</button>
        ${canEdit() ? `<button class="text-action" data-action="edit-initiative" data-id="${i.id}">Editar</button>
        <button class="text-action" data-action="delete-initiative" data-id="${i.id}">Eliminar</button>` : ""}
      </div></td>
    </tr>`).join("")}
  </tbody></table></div>
  <div class="table-bottom"><span>${items.length} iniciativa(s)</span></div>`;
}

// ── TRABAJADORES (NUEVO MÓDULO) ───────────────────────────────────────────────
async function renderTrabajadores() {
  const items = await GET("/trabajadores");
  const activos   = items.filter(t => t.activo).length;
  const inactivos = items.length - activos;

  const areas = [...new Set(items.map(t => t.area).filter(Boolean))].sort();

  return `${pageHead("Mantenimiento de Trabajadores", "Gestiona el personal y responsables asignados a indicadores e iniciativas.",
    `${canEdit() ? `<button class="btn primary" data-action="new-trabajador">＋ Nuevo trabajador</button>` : ""}`)}
  <div class="grid metric-grid">
    ${metricCard("Total trabajadores", items.length, "Registrados en el sistema", "♙")}
    ${metricCard("Activos", activos, "Personal activo", "✓", "green")}
    ${metricCard("Inactivos", inactivos, "Dados de baja", "×", "amber")}
    ${metricCard("Áreas", areas.length, "Departamentos con personal", "▦", "red")}
  </div>
  <div class="toolbar">
    <div class="search-box"><input id="trabSearch" placeholder="Buscar por nombre, cargo o DNI…"></div>
    <select id="trabArea"><option value="">Todas las áreas</option>
      ${areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}
    </select>
    <select id="trabActivo"><option value="">Todos los estados</option><option value="1">Activo</option><option value="0">Inactivo</option></select>
    <button class="btn" data-action="export-trabajadores">↓ CSV</button>
  </div>
  <div id="trabTableWrap" class="table-panel">${trabajadoresTable(items)}</div>`;
}

export function trabajadoresTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>No hay trabajadores</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>DNI / Código</th><th>Trabajador</th><th>Cargo</th><th>Área</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(t => `<tr>
      <td><span class="code">${escapeHtml(t.dni || "—")}</span></td>
      <td><span class="table-title">${escapeHtml(t.nombre)} ${escapeHtml(t.apellido)}</span><span class="subcell">${escapeHtml(t.id)}</span></td>
      <td>${escapeHtml(t.cargo)}</td>
      <td><span class="tag">${escapeHtml(t.area)}</span></td>
      <td>${escapeHtml(t.email)}</td>
      <td>${escapeHtml(t.telefono)}</td>
      <td><span class="status ${t.activo ? "good" : "neutral"}">${t.activo ? "Activo" : "Inactivo"}</span></td>
      <td><div class="table-actions">
        ${canEdit() ? `<button class="text-action" data-action="edit-trabajador" data-id="${t.id}">Editar</button>` : ""}
        ${canAdmin() ? `<button class="text-action" data-action="delete-trabajador" data-id="${t.id}">${t.activo ? "Dar de baja" : "Activar"}</button>` : ""}
      </div></td>
    </tr>`).join("")}
  </tbody></table></div>
  <div class="table-bottom"><span>${items.length} trabajador(es)</span></div>`;
}

// ── REPORTES ──────────────────────────────────────────────────────────────────
async function renderReports() {
  const d = await GET("/dashboard/summary");
  const gc = d.cumplimiento_global;

  return `${pageHead("Reportes", "Genera resúmenes de desempeño y exporta información.",
    `<button class="btn" data-action="print-report">⎙ Imprimir / PDF</button><button class="btn primary" data-action="export-report">↓ Exportar CSV</button>`)}
  <div class="grid report-cards">
    <article class="report-card"><div class="report-icon">▦</div><h3>Reporte general del BSC</h3><p>Resumen ejecutivo con cumplimiento global.</p><button class="btn small" data-action="report-type" data-type="general">Generar →</button></article>
    <article class="report-card"><div class="report-icon">◉</div><h3>Desempeño por perspectiva</h3><p>Comparación de resultados en las cuatro perspectivas.</p><button class="btn small" data-action="report-type" data-type="perspectivas">Generar →</button></article>
    <article class="report-card"><div class="report-icon">⚑</div><h3>Objetivos críticos</h3><p>Objetivos con indicadores en riesgo o sin datos.</p><button class="btn small" data-action="report-type" data-type="criticos">Generar →</button></article>
    <article class="report-card"><div class="report-icon">▥</div><h3>Detalle de indicadores</h3><p>Fórmulas, metas, resultados y responsables.</p><button class="btn small" data-action="report-type" data-type="kpis">Generar →</button></article>
    <article class="report-card"><div class="report-icon">◈</div><h3>Portafolio de iniciativas</h3><p>Estado, avance y presupuesto de proyectos.</p><button class="btn small" data-action="report-type" data-type="iniciativas">Generar →</button></article>
    <article class="report-card"><div class="report-icon">♙</div><h3>Trabajadores y asignaciones</h3><p>Personal activo y recursos asignados.</p><button class="btn small" data-action="report-type" data-type="trabajadores">Generar →</button></article>
  </div>
  <section class="panel" style="margin-top:16px">
    <div class="panel-head"><div><h2 id="reportResultTitle">Vista previa: Reporte general</h2></div><button class="panel-action" data-action="export-report">Exportar CSV ↓</button></div>
    <div id="reportResult">
      <div class="grid dashboard-grid">
        <div>
          <div class="kpi-result">
            <div><small>Cumplimiento global ponderado</small><strong>${gc === null ? "—" : fmt(gc) + "%"}</strong></div>
            <span class="status ${gc >= 90 ? "good" : gc >= 75 ? "warn" : "bad"}">${gc === null ? "Sin datos" : gc >= 90 ? "Buen desempeño" : gc >= 75 ? "Seguimiento" : "Plan de acción"}</span>
          </div>
          <div class="perspective-bars" style="margin-top:20px">
            ${d.por_perspectiva.map(p => `
              <div class="perspective-row">
                <div class="perspective-name"><span class="persp-dot" style="background:${perspectives[p.perspectiva]?.color}"></span>${p.label}</div>
                <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,p.cumplimiento||0)}%;background:${perspectives[p.perspectiva]?.color}"></div></div>
                <div class="perspective-value">${p.cumplimiento !== null ? fmt(p.cumplimiento)+"%" : "—"}</div>
              </div>`).join("")}
          </div>
        </div>
        <div class="chart-wrap short"><canvas id="reportChart"></canvas></div>
      </div>
      ${criticalKpiTable(d.criticos)}
    </div>
  </section>`;
}

export async function drawReportCharts() {
  const d = await GET("/dashboard/summary").catch(() => null);
  if (!d || !chartAvailable()) return;
  const c = $("#reportChart");
  if (!c) return;
  const per = d.por_perspectiva;
  charts.report = new Chart(c, {
    type: "doughnut",
    data: {
      labels: per.map(x => x.label),
      datasets: [{ data: per.map(x => x.cumplimiento || 0),
        backgroundColor: per.map(x => perspectives[x.perspectiva]?.color || "#888"), borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { boxWidth: 10, font: { size: 9 } } } } }
  });
}

// ── ADMINISTRACIÓN ────────────────────────────────────────────────────────────
async function renderAdministration() {
  const [users, recursos, audit] = await Promise.all([
    GET("/users"),
    GET("/recursos"),
    GET("/dashboard/audit"),
  ]);

  const userRows = users.map(u => `<tr>
    <td><div class="user-card"><div class="avatar">${(u.nombre||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
    <div><span class="table-title">${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}</span><span class="subcell">${escapeHtml(u.email)}</span></div></div></td>
    <td>${escapeHtml(u.rol)}</td>
    <td>${escapeHtml(u.area || "—")}</td>
    <td><span class="status ${u.activo ? "good" : "neutral"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
    <td>${canAdmin() ? `<div class="table-actions">
      <button class="text-action" data-action="edit-user" data-id="${u.id}">Editar</button>
      ${u.id !== getUser()?.id ? `<button class="text-action" data-action="delete-user" data-id="${u.id}">Dar de baja</button>` : ""}
    </div>` : "Solo lectura"}</td>
  </tr>`).join("");

  const recursoRows = recursos.map(r => `<tr>
    <td><span class="code">${escapeHtml(r.id)}</span></td>
    <td><span class="table-title">${escapeHtml(r.nombre)}</span></td>
    <td><span class="tag">${escapeHtml(r.tipo)}</span></td>
    <td>${currency(r.monto_total)}</td>
    <td><span class="status ${r.estado === "Disponible" ? "good" : "neutral"}">${escapeHtml(r.estado)}</span></td>
    <td>${canEdit() ? `<div class="table-actions">
      <button class="text-action" data-action="edit-recurso" data-id="${r.id}">Editar</button>
      <button class="text-action" data-action="delete-recurso" data-id="${r.id}">Eliminar</button>
    </div>` : "—"}</td>
  </tr>`).join("");

  return `${pageHead("Administración", "Gestiona usuarios, recursos y configuración del sistema.",
    `${canAdmin() ? `<button class="btn primary" data-action="new-user">＋ Nuevo usuario</button>
     <button class="btn soft" data-action="new-recurso">＋ Nuevo recurso</button>` : ""}`)}
  <div class="grid admin-grid">
    <section class="panel"><div class="panel-head"><div><h2>Usuarios del sistema</h2></div></div>
      <div class="table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Área</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${userRows}</tbody></table></div>
    </section>
    <section class="panel"><div class="panel-head"><div><h2>Recursos disponibles</h2><p>Presupuestos, equipos y software</p></div></div>
      <div class="table-scroll"><table><thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${recursoRows}</tbody></table></div>
    </section>
  </div>
  <section class="panel" style="margin-top:16px">
    <div class="panel-head"><div><h2>Registro de auditoría</h2><p>Últimas acciones en el sistema</p></div></div>
    <div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>
      ${audit.map(a => `<tr>
        <td>${escapeHtml(new Date(a.fecha).toLocaleString("es-PE"))}</td>
        <td>${escapeHtml(a.usuario)}</td>
        <td>${escapeHtml(a.accion)}</td>
        <td>${escapeHtml(a.entidad)}</td>
        <td>${escapeHtml(a.detalle)}</td>
      </tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

export const renderers = {
  dashboard:     renderDashboard,
  mapa:          renderMap,
  objetivos:     renderObjectives,
  kpis:          renderKpis,
  mediciones:    renderMeasurements,
  iniciativas:   renderInitiatives,
  trabajadores:  renderTrabajadores,
  reportes:      renderReports,
  administracion:renderAdministration,
};

