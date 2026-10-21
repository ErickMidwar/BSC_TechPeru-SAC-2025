(() => {
"use strict";

// ── Constants & helpers ───────────────────────────────────────────────────────
const API = "http://localhost:3000/api";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const perspectives = {
  financiera:  { label: "Financiera",                    color: "#3478e5", soft: "#edf4ff" },
  clientes:    { label: "Clientes",                      color: "#18a875", soft: "#eaf8f1" },
  procesos:    { label: "Procesos internos",             color: "#e99a2d", soft: "#fff5e6" },
  aprendizaje: { label: "Aprendizaje y crecimiento",     color: "#8b6bd6", soft: "#f2edff" },
};

// ── Token / auth state ────────────────────────────────────────────────────────
let currentUser = null;
let authToken   = null;

function saveSession(token, user) {
  authToken   = token;
  currentUser = user;
  sessionStorage.setItem("bsc_token", token);
  sessionStorage.setItem("bsc_user",  JSON.stringify(user));
}

function clearSession() {
  authToken   = null;
  currentUser = null;
  sessionStorage.removeItem("bsc_token");
  sessionStorage.removeItem("bsc_user");
}

function restoreSession() {
  const t = sessionStorage.getItem("bsc_token");
  const u = sessionStorage.getItem("bsc_user");
  if (t && u) { authToken = t; currentUser = JSON.parse(u); return true; }
  return false;
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (authToken) opts.headers["Authorization"] = `Bearer ${authToken}`;
  if (body)      opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);

  if (res.status === 401) { logout(); return null; }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const GET    = (p)       => api("GET",    p);
const POST   = (p, b)    => api("POST",   p, b);
const PUT    = (p, b)    => api("PUT",    p, b);
const DELETE = (p)       => api("DELETE", p);

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function fmt(n, d = 1) {
  return n === null || n === undefined || n === "" ? "—"
    : Number(n).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
function currency(n) {
  return "S/ " + Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });
}
function today() { return new Date().toISOString().slice(0, 10); }

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toastRegion").append(el);
  setTimeout(() => el.remove(), 3600);
}

function perspectiveLabel(p) { return perspectives[p]?.label || p || "—"; }

function canEdit()  { return currentUser && ["Administrador", "Gerente"].includes(currentUser.rol); }
function canAdmin() { return currentUser?.rol === "Administrador"; }

// ── Semáforo helpers (mirrors backend logic) ──────────────────────────────────
function achievement(kpi, value = kpi.resultado_actual) {
  if (value === null || value === undefined || value === "" || kpi.meta === null) return null;
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

function statusOf(kpi, value = kpi.resultado_actual) {
  if (value === null || value === undefined || value === "") return { key: "neutral", label: "Sin datos" };
  const pct = kpi.cumplimiento ?? achievement(kpi, value);
  if (pct === null) return { key: "neutral", label: "Sin datos" };
  const alerta  = Number(kpi.umbral_alerta  ?? 80);
  const critico = Number(kpi.umbral_critico ?? 60);
  if (pct >= 100)    return { key: "good", label: "Logrado",   pct };
  if (pct >= alerta) return { key: "warn", label: "En riesgo", pct };
  if (pct >= critico)return { key: "warn", label: "En alerta", pct };
  return { key: "bad", label: "Crítico", pct };
}

function statusBadge(kpi, value) {
  const s = statusOf(kpi, value);
  return `<span class="status ${s.key}">${s.label}</span>`;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
let charts = {};
function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  charts = {};
}
function chartAvailable() { return typeof window.Chart !== "undefined"; }

// ── Navigation ────────────────────────────────────────────────────────────────
let currentPage = "dashboard";
const pageTitles = {
  dashboard: "Dashboard ejecutivo", mapa: "Mapa estratégico",
  objetivos: "Objetivos estratégicos", kpis: "Indicadores (KPI)",
  mediciones: "Registro de resultados", iniciativas: "Iniciativas estratégicas",
  reportes: "Reportes", administracion: "Administración",
  trabajadores: "Mantenimiento de Trabajadores",
};

function navigate(page) {
  if (!page) return;
  currentPage = page;
  $("#sidebar").classList.remove("open");
  history.replaceState(null, "", "#" + page);
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderPage(page);
}

async function renderPage(page) {
  currentPage = page;
  $("#breadcrumbPage").textContent = pageTitles[page] || "Dashboard";
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  destroyCharts();
  $("#pageContent").innerHTML = `<div style="padding:40px;text-align:center;color:#8b98a9;">Cargando...</div>`;

  try {
    const html = await renderers[page]?.();
    if (html) $("#pageContent").innerHTML = html;
    bindPageEvents(page);
    if (page === "dashboard")   await drawDashboardCharts();
    if (page === "reportes")    await drawReportCharts();
  } catch (e) {
    toast(e.message, "error");
    $("#pageContent").innerHTML = `<div style="padding:40px;color:#c23a42;">${escapeHtml(e.message)}</div>`;
  }
  $("#pageContent").focus({ preventScroll: true });
}

// ── Page head / shared HTML ───────────────────────────────────────────────────
function pageHead(title, desc, actions = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="head-actions">${actions}</div></div>`;
}
function metricCard(label, value, foot, icon, kind = "blue") {
  const style = kind === "green" ? "background:#eaf8f1;color:#16845b"
              : kind === "amber" ? "background:#fff5dd;color:#b97708"
              : kind === "red"   ? "background:#ffebed;color:#c23a42" : "";
  return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon" style="${style}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`;
}

// ── Modal engine ──────────────────────────────────────────────────────────────
let modalSubmit = null;
function showModal(title, body, submitLabel = "Guardar", submitFn = null, eyebrow = "GESTIÓN") {
  $("#modalTitle").textContent    = title;
  $("#modalEyebrow").textContent  = eyebrow;
  $("#modalBody").innerHTML       = body;
  $("#modalFooter").innerHTML     = `<button class="btn" type="button" id="modalCancel">Cancelar</button><button class="btn primary" type="button" id="modalSubmit">${submitLabel}</button>`;
  $("#modalLayer").classList.remove("hidden");
  modalSubmit = submitFn;
  $("#modalClose").onclick   = closeModal;
  $("#modalCancel").onclick  = closeModal;
  $("#modalSubmit").onclick  = () => { if (modalSubmit) modalSubmit(); };
  $("#modalLayer").onclick   = e => { if (e.target === $("#modalLayer")) closeModal(); };
}
function closeModal() { $("#modalLayer").classList.add("hidden"); modalSubmit = null; }

// Form field helpers
function field(label, name, value = "", type = "text", required = true, extra = "") {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${extra}></div>`;
}
function selectField(label, name, opts, required = true) {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label><select id="${name}" name="${name}" ${required ? "required" : ""}>${opts}</select></div>`;
}
function validateForm(ids) {
  for (const id of ids) {
    const el = $("#" + id);
    if (el && el.required && !String(el.value).trim()) { el.focus(); toast("Completa los campos obligatorios.", "error"); return false; }
    if (el && el.type === "number" && el.value !== "" && !Number.isFinite(Number(el.value))) { el.focus(); toast("Ingresa un valor numérico válido.", "error"); return false; }
  }
  return true;
}

function optionsPerspectives(selected) {
  return Object.entries(perspectives).map(([k, p]) =>
    `<option value="${k}" ${selected === k ? "selected" : ""}>${p.label}</option>`
  ).join("");
}

// ── APP INIT ──────────────────────────────────────────────────────────────────
function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  const initials = (currentUser.nombre || "?").split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
  $("#sideUserName").textContent  = currentUser.nombre;
  $("#topUserName").textContent   = currentUser.nombre;
  $("#sideUserRole").textContent  = currentUser.rol;
  $("#topUserRole").textContent   = currentUser.rol;
  $$(".avatar").forEach(a => a.textContent = initials);
  navigate(currentPage);
}

function showLogin() {
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

function logout() {
  clearSession();
  showLogin();
  toast("Sesión cerrada correctamente");
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email    = $("#loginUser").value.trim();
  const password = $("#loginPass").value;
  try {
    const data = await POST("/auth/login", { email, password });
    if (!data) return;
    saveSession(data.token, data.user);
    $("#loginError").classList.add("hidden");
    showApp();
  } catch (err) {
    $("#loginError").textContent = err.message;
    $("#loginError").classList.remove("hidden");
  }
});

$("#logoutBtn").addEventListener("click", logout);

// Sidebar mobile toggle
$("#menuToggle")?.addEventListener("click",   () => $("#sidebar").classList.add("open"));
$("#sidebarClose")?.addEventListener("click", () => $("#sidebar").classList.remove("open"));

// Period selector
$("#globalPeriod")?.addEventListener("change", () => { if (currentPage === "dashboard") renderPage("dashboard"); });

// Main nav delegation
$("#mainNav").addEventListener("click", e => {
  const btn = e.target.closest("[data-page]");
  if (btn) navigate(btn.dataset.page);
});

// ══════════════════════════════════════════════════════════════════════════════
// PAGE RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const d = await GET("/dashboard/summary");
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

function criticalKpiTable(list) {
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

async function drawDashboardCharts() {
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
  const [objetivos, kpis] = await Promise.all([GET("/objetivos"), GET("/kpis")]);

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

function objectivesTable(items) {
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

function kpisFullTable(items) {
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

function measurementTable(items) {
  if (!items.length) return `<div class="empty-state"><strong>Sin mediciones</strong></div>`;
  return `<div class="table-scroll"><table><thead><tr>
    <th>Fecha</th><th>Período</th><th>Indicador</th><th>Valor</th><th>Cumplimiento</th><th>Responsable</th><th>Observaciones</th><th>Acciones</th>
  </tr></thead><tbody>
    ${items.map(x => `<tr>
      <td>${escapeHtml(x.fecha)}</td>
      <td>${escapeHtml(x.periodo)}</td>
      <td><span class="code">${escapeHtml(x.kpi_id)}</span><span class="subcell">${escapeHtml(x.kpi_nombre || "")}</span></td>
      <td><strong>${fmt(x.valor, 2)} ${escapeHtml(x.unidad || "")}</strong></td>
      <td>${x.cumplimiento !== null && x.cumplimiento !== undefined ? fmt(x.cumplimiento) + "%" : "—"}</td>
      <td>${escapeHtml(x.responsable)}</td>
      <td>${escapeHtml(x.notas || "—")}</td>
      <td><div class="table-actions">
        <button class="text-action" data-action="edit-measurement" data-id="${x.id}" data-kpi="${x.kpi_id}">Editar</button>
        <button class="text-action" data-action="delete-measurement" data-id="${x.id}">Eliminar</button>
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

function initiativesTable(items) {
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

function trabajadoresTable(items) {
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

async function drawReportCharts() {
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
      ${u.id !== currentUser?.id ? `<button class="text-action" data-action="delete-user" data-id="${u.id}">Dar de baja</button>` : ""}
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

const renderers = {
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

// ══════════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

function bindPageEvents(page) {
  const root = $("#pageContent");

  root.onclick = e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    handleAction(b.dataset.action, b.dataset.id, b.dataset);
  };

  // Live search / filter for tables
  root.oninput = e => {
    const id = e.target.id;
    if (["objSearch","kpiSearch","measurementSearch","initiativeSearch","trabSearch"].includes(id)) {
      applyTableFilters(page);
    }
  };
  root.onchange = e => {
    const id = e.target.id;
    if (["objPerspective","objStatus","objPriority",
         "kpiPerspective","kpiStatus",
         "measurementKpi","measurementMonth",
         "initiativeStatus",
         "trabArea","trabActivo"].includes(id)) {
      applyTableFilters(page);
    }
  };
}

async function applyTableFilters(page) {
  if (page === "objetivos") {
    const q  = ($("#objSearch")?.value || "").toLowerCase();
    const p  = $("#objPerspective")?.value || "";
    const s  = $("#objStatus")?.value || "";
    const pr = $("#objPriority")?.value || "";
    let url = "/objetivos?";
    if (p)  url += `perspectiva=${encodeURIComponent(p)}&`;
    if (s)  url += `estado=${encodeURIComponent(s)}&`;
    if (pr) url += `prioridad=${encodeURIComponent(pr)}&`;
    if (q)  url += `q=${encodeURIComponent(q)}`;
    const items = await GET(url).catch(() => []);
    $("#objectiveTableWrap").innerHTML = objectivesTable(items);
  }
  if (page === "kpis") {
    const q  = ($("#kpiSearch")?.value || "").toLowerCase();
    const p  = $("#kpiPerspective")?.value || "";
    const sf = $("#kpiStatus")?.value || "";
    let url = "/kpis?";
    if (p)  url += `perspectiva=${encodeURIComponent(p)}&`;
    if (sf) url += `estado_semaforo=${encodeURIComponent(sf)}&`;
    if (q)  url += `q=${encodeURIComponent(q)}`;
    const items = await GET(url).catch(() => []);
    $("#kpiTableWrap").innerHTML = kpisFullTable(items);
  }
  if (page === "mediciones") {
    const q     = ($("#measurementSearch")?.value || "").toLowerCase();
    const kid   = $("#measurementKpi")?.value || "";
    const month = $("#measurementMonth")?.value || "";
    let url = "/mediciones?";
    if (kid)   url += `kpi_id=${encodeURIComponent(kid)}&`;
    if (month) url += `periodo=${encodeURIComponent(month)}&`;
    if (q)     url += `q=${encodeURIComponent(q)}`;
    const items = await GET(url).catch(() => []);
    $("#measurementTableWrap").innerHTML = measurementTable(items);
  }
  if (page === "iniciativas") {
    const q  = ($("#initiativeSearch")?.value || "").toLowerCase();
    const st = $("#initiativeStatus")?.value || "";
    let url = "/iniciativas?";
    if (st) url += `estado=${encodeURIComponent(st)}&`;
    if (q)  url += `q=${encodeURIComponent(q)}`;
    const items = await GET(url).catch(() => []);
    $("#initiativeTableWrap").innerHTML = initiativesTable(items);
  }
  if (page === "trabajadores") {
    const q  = ($("#trabSearch")?.value || "").toLowerCase();
    const ar = $("#trabArea")?.value || "";
    const ac = $("#trabActivo")?.value;
    let url = "/trabajadores?";
    if (ar) url += `area=${encodeURIComponent(ar)}&`;
    if (ac !== undefined && ac !== "") url += `activo=${ac}&`;
    if (q)  url += `q=${encodeURIComponent(q)}`;
    const items = await GET(url).catch(() => []);
    $("#trabTableWrap").innerHTML = trabajadoresTable(items);
  }
}

async function handleAction(action, id, data = {}) {
  switch (action) {
    // Navigation shortcuts
    case "go-mediciones":  navigate("mediciones");  break;
    case "go-kpis":        navigate("kpis");        break;
    case "go-reportes":    navigate("reportes");    break;

    // Objetivos
    case "new-objective":      openObjectiveForm();   break;
    case "edit-objective":     openObjectiveForm(id); break;
    case "delete-objective":   confirmDelete("objetivo", id, "objetivos"); break;
    case "objective-detail":   showObjectiveDetail(id); break;

    // KPIs
    case "new-kpi":    openKpiForm();   break;
    case "edit-kpi":   openKpiForm(id); break;
    case "delete-kpi": confirmDelete("KPI", id, "kpis"); break;
    case "kpi-detail": showKpiDetail(id); break;
    case "measure-kpi":openMeasurementForm(null, id); break;

    // Mediciones
    case "new-measurement":  openMeasurementForm(); break;
    case "edit-measurement": openMeasurementForm(id, data.kpi); break;
    case "delete-measurement": confirmDelete("medición", id, "mediciones"); break;
    case "export-measurements": await exportMeasurements(); break;

    // Iniciativas
    case "new-initiative":    openInitiativeForm();   break;
    case "edit-initiative":   openInitiativeForm(id); break;
    case "delete-initiative": confirmDelete("iniciativa", id, "iniciativas"); break;
    case "initiative-detail": showInitiativeDetail(id); break;

    // Trabajadores
    case "new-trabajador":    openTrabajadorForm();   break;
    case "edit-trabajador":   openTrabajadorForm(id); break;
    case "delete-trabajador": confirmToggleTrabajador(id); break;
    case "export-trabajadores": await exportTrabajadores(); break;

    // Users (admin)
    case "new-user":    openUserForm();   break;
    case "edit-user":   openUserForm(id); break;
    case "delete-user": confirmDelete("usuario", id, "users"); break;

    // Recursos
    case "new-recurso":    openRecursoForm();   break;
    case "edit-recurso":   openRecursoForm(id); break;
    case "delete-recurso": confirmDelete("recurso", id, "recursos"); break;

    // Reports
    case "report-type":   generateReport(data.type); break;
    case "export-report": exportReport(); break;
    case "print-report":  window.print(); break;
  }
}

// ── OBJECTIVE FORM ────────────────────────────────────────────────────────────
async function openObjectiveForm(id = null) {
  if (!canEdit()) { toast("Tu rol no permite modificar objetivos.", "error"); return; }

  const [trabajadores] = await Promise.all([GET("/trabajadores?activo=1")]);
  const o = id ? await GET(`/objetivos/${id}`) : {};
  const editing = !!id;

  const trabOpts = `<option value="">Sin asignar</option>` +
    trabajadores.map(t => `<option value="${t.id}" ${o.trabajador_id===t.id?"selected":""}>${escapeHtml(t.nombre+" "+t.apellido)} — ${escapeHtml(t.area)}</option>`).join("");

  showModal(
    editing ? "Editar objetivo estratégico" : "Nuevo objetivo estratégico",
    `<form id="objectiveForm" class="detail-form-grid">
      ${field("Nombre del objetivo", "oName", o.nombre || "", "text", true)}
      ${selectField("Perspectiva", "oPerspective", optionsPerspectives(o.perspectiva || "financiera"))}
      <div class="field full-span"><label for="oDescription">Descripción</label><textarea id="oDescription">${escapeHtml(o.descripcion||"")}</textarea></div>
      ${selectField("Trabajador responsable", "oTrabajador", trabOpts, false)}
      ${selectField("Prioridad", "oPriority", ["Alta","Media","Baja"].map(x=>`<option ${(o.prioridad||"Media")===x?"selected":""}>${x}</option>`).join(""))}
      ${field("Ponderación (%)", "oWeight", o.peso ?? 100, "number", true, 'min="1" max="100" step="1"')}
      ${selectField("Estado", "oStatus", ["Activo","En revisión","Inactivo"].map(x=>`<option ${(o.estado||"Activo")===x?"selected":""}>${x}</option>`).join(""))}
    </form>`,
    editing ? "Guardar cambios" : "Crear objetivo",
    async () => {
      if (!validateForm(["oName","oPerspective","oWeight"])) return;
      const payload = {
        nombre:       $("#oName").value.trim(),
        perspectiva:  $("#oPerspective").value,
        descripcion:  $("#oDescription").value.trim(),
        trabajador_id:$("#oTrabajador").value || null,
        responsable:  $("#oTrabajador").selectedOptions[0]?.text?.split(" — ")[0] || "",
        prioridad:    $("#oPriority").value,
        peso:         Number($("#oWeight").value),
        estado:       $("#oStatus").value,
      };
      try {
        if (editing) await PUT(`/objetivos/${id}`, payload);
        else await POST("/objetivos", payload);
        closeModal();
        toast(editing ? "Objetivo actualizado" : "Objetivo creado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── OBJECTIVE DETAIL ──────────────────────────────────────────────────────────
async function showObjectiveDetail(id) {
  const o = await GET(`/objetivos/${id}`);
  if (!o) return;
  const kpiRows = (o.kpis || []).map(k => `<tr>
    <td><span class="code">${escapeHtml(k.id)}</span></td>
    <td>${escapeHtml(k.nombre)}</td>
    <td>${fmt(k.resultado_actual,2)}</td>
    <td>${fmt(k.meta,2)}</td>
    <td>${k.cumplimiento!==null?fmt(k.cumplimiento)+"%":"—"}</td>
    <td><span class="status ${k.estado_semaforo?.key||"neutral"}">${k.estado_semaforo?.label||"Sin datos"}</span></td>
  </tr>`).join("") || `<tr><td colspan="6" class="empty-state">Sin KPI asociados</td></tr>`;

  showModal(`${o.id}: ${o.nombre}`,
    `<div class="info-box" style="margin-bottom:14px">
      <strong>Perspectiva:</strong> ${perspectiveLabel(o.perspectiva)}<br>
      <strong>Descripción:</strong> ${escapeHtml(o.descripcion)}<br>
      <strong>Responsable:</strong> ${escapeHtml(o.responsable)}<br>
      ${o.trabajador ? `<strong>Trabajador asignado:</strong> ${escapeHtml(o.trabajador.nombre+" "+o.trabajador.apellido)} (${escapeHtml(o.trabajador.cargo)})<br>` : ""}
      <strong>Prioridad:</strong> ${escapeHtml(o.prioridad)} · <strong>Peso:</strong> ${fmt(o.peso)}% · <strong>Estado:</strong> ${escapeHtml(o.estado)}
    </div>
    <h3 style="font-size:12px;margin:0 0 8px">KPI asociados</h3>
    <div class="table-scroll"><table><thead><tr><th>ID</th><th>Indicador</th><th>Resultado</th><th>Meta</th><th>Cumplimiento</th><th>Estado</th></tr></thead><tbody>${kpiRows}</tbody></table></div>`,
    "Cerrar", closeModal, "DETALLE"
  );
}

// ── KPI FORM ──────────────────────────────────────────────────────────────────
async function openKpiForm(id = null) {
  if (!canEdit()) { toast("Tu rol no permite modificar KPI.", "error"); return; }
  const [objetivos, trabajadores] = await Promise.all([GET("/objetivos"), GET("/trabajadores?activo=1")]);
  const k = id ? await GET(`/kpis/${id}`) : {};
  const editing = !!id;

  const objOpts = `<option value="">Seleccionar objetivo</option>` +
    objetivos.map(o => `<option value="${o.id}" ${k.objetivo_id===o.id?"selected":""}>${escapeHtml(o.id+" · "+o.nombre)}</option>`).join("");
  const trabOpts = `<option value="">Sin asignar</option>` +
    trabajadores.map(t => `<option value="${t.id}" ${k.trabajador_id===t.id?"selected":""}>${escapeHtml(t.nombre+" "+t.apellido)}</option>`).join("");

  showModal(
    editing ? "Editar indicador KPI" : "Nuevo indicador KPI",
    `<form id="kpiForm" class="detail-form-grid">
      ${field("Nombre del indicador", "kName", k.nombre||"", "text", true)}
      ${selectField("Perspectiva", "kPerspective", optionsPerspectives(k.perspectiva||"financiera"))}
      ${selectField("Objetivo asociado", "kObjective", objOpts)}
      ${field("Unidad", "kUnit", k.unidad||"%", "text", true)}
      <div class="field full-span"><label for="kFormula">Fórmula *</label><input id="kFormula" required value="${escapeHtml(k.formula||"")}"></div>
      ${field("Línea base", "kBaseline", k.linea_base??0, "number", true, 'step="any"')}
      ${field("Meta", "kTarget", k.meta??100, "number", true, 'step="any"')}
      ${field("Resultado actual", "kCurrent", k.resultado_actual??""  , "number", false, 'step="any"')}
      ${selectField("Sentido", "kDirection", `
        <option value="mayor" ${(k.direccion||"mayor")==="mayor"?"selected":""}>Mayor es mejor</option>
        <option value="menor" ${k.direccion==="menor"?"selected":""}>Menor es mejor</option>
        <option value="rango" ${k.direccion==="rango"?"selected":""}>Dentro de un rango</option>`)}
      ${selectField("Frecuencia", "kFrequency", ["Mensual","Trimestral","Semestral","Anual"].map(x=>`<option ${(k.frecuencia||"Mensual")===x?"selected":""}>${x}</option>`).join(""))}
      ${selectField("Trabajador responsable", "kTrabajador", trabOpts, false)}
      ${field("Área", "kArea", k.area||"", "text", true)}
      ${field("Peso", "kWeight", k.peso??1, "number", true, 'min="0" step="1"')}
      ${field("Umbral alerta (%)", "kAlert", k.umbral_alerta??80, "number", true, 'min="0" max="100"')}
      ${field("Umbral crítico (%)", "kCritical", k.umbral_critico??60, "number", true, 'min="0" max="100"')}
    </form>`,
    editing ? "Guardar cambios" : "Crear indicador",
    async () => {
      if (!validateForm(["kName","kPerspective","kObjective","kUnit","kFormula","kTarget","kFrequency","kArea"])) return;
      const curr = $("#kCurrent").value;
      const payload = {
        nombre: $("#kName").value.trim(), perspectiva: $("#kPerspective").value,
        objetivo_id: $("#kObjective").value, unidad: $("#kUnit").value, formula: $("#kFormula").value.trim(),
        linea_base: Number($("#kBaseline").value), meta: Number($("#kTarget").value),
        resultado_actual: curr !== "" ? Number(curr) : null,
        direccion: $("#kDirection").value, frecuencia: $("#kFrequency").value,
        trabajador_id: $("#kTrabajador").value || null,
        responsable: $("#kTrabajador").selectedOptions[0]?.text || k.responsable || "",
        area: $("#kArea").value, peso: Number($("#kWeight").value),
        umbral_alerta: Number($("#kAlert").value), umbral_critico: Number($("#kCritical").value),
      };
      try {
        if (editing) await PUT(`/kpis/${id}`, payload);
        else await POST("/kpis", payload);
        closeModal();
        toast(editing ? "KPI actualizado" : "KPI creado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── KPI DETAIL ────────────────────────────────────────────────────────────────
async function showKpiDetail(id) {
  const k = await GET(`/kpis/${id}`);
  if (!k) return;
  const pct = k.cumplimiento;
  const sf  = k.estado_semaforo;
  const medRows = (k.mediciones||[]).slice(0,6).map(m=>`<tr>
    <td>${escapeHtml(m.periodo)}</td><td>${fmt(m.valor,2)} ${escapeHtml(k.unidad)}</td>
    <td>${m.cumplimiento!==null?fmt(m.cumplimiento)+"%":"—"}</td><td>${escapeHtml(m.notas||"—")}</td>
  </tr>`).join("") || `<tr><td colspan="4" class="empty-state">Sin mediciones</td></tr>`;

  showModal(`${k.id}: ${k.nombre}`,
    `<div class="info-box" style="margin-bottom:14px">
      <strong>Perspectiva:</strong> ${perspectiveLabel(k.perspectiva)}<br>
      <strong>Objetivo:</strong> ${escapeHtml(k.objetivo?.nombre||k.objetivo_id)}<br>
      <strong>Fórmula:</strong> ${escapeHtml(k.formula)}<br>
      <strong>Sentido:</strong> ${escapeHtml(k.direccion)} · <strong>Frecuencia:</strong> ${escapeHtml(k.frecuencia)}<br>
      ${k.trabajador?`<strong>Responsable:</strong> ${escapeHtml(k.trabajador.nombre+" "+k.trabajador.apellido)} (${escapeHtml(k.trabajador.cargo)})<br>`:""}
    </div>
    <div class="kpi-result" style="margin-bottom:16px">
      <div><small>Resultado actual vs. meta</small>
        <strong>${fmt(k.resultado_actual,2)} ${escapeHtml(k.unidad)}</strong>
        <small>Meta: ${fmt(k.meta,2)} ${escapeHtml(k.unidad)}</small>
      </div>
      <div><small>Cumplimiento</small><strong>${pct!==null?fmt(pct)+"%":"—"}</strong>
        ${sf ? `<span class="status ${sf.key}">${sf.label}</span>` : ""}
      </div>
    </div>
    <h3 style="font-size:12px;margin:0 0 8px">Últimas mediciones</h3>
    <div class="table-scroll"><table><thead><tr><th>Período</th><th>Valor</th><th>Cumplimiento</th><th>Notas</th></tr></thead><tbody>${medRows}</tbody></table></div>`,
    "Cerrar", closeModal, "DETALLE KPI"
  );
}

// ── MEASUREMENT FORM ──────────────────────────────────────────────────────────
async function openMeasurementForm(id = null, kpiId = null) {
  if (!canEdit()) { toast("Tu rol no permite registrar mediciones.", "error"); return; }
  const kpis = await GET("/kpis");
  const m = id ? await GET(`/mediciones/${id}`) : null;

  const kpiOpts = `<option value="">Seleccionar KPI</option>` +
    kpis.map(k => `<option value="${k.id}" ${(kpiId||m?.kpi_id)===k.id?"selected":""}>${escapeHtml(k.id+" · "+k.nombre)}</option>`).join("");

  showModal(
    id ? "Editar medición" : "Registrar medición",
    `<form id="measurementForm" class="detail-form-grid">
      ${selectField("Indicador (KPI)", "mKpi", kpiOpts)}
      ${field("Período", "mPeriod", m?.periodo || new Date().toISOString().slice(0,7), "month", true)}
      ${field("Fecha", "mDate", m?.fecha || today(), "date", true)}
      ${field("Valor obtenido", "mValue", m?.valor ?? "", "number", true, 'step="any"')}
      ${field("Responsable", "mResponsable", m?.responsable || currentUser?.nombre || "", "text", false)}
      <div class="field full-span"><label for="mNotes">Observaciones</label><textarea id="mNotes">${escapeHtml(m?.notas||"")}</textarea></div>
    </form>`,
    id ? "Guardar cambios" : "Registrar",
    async () => {
      if (!validateForm(["mKpi","mPeriod","mDate","mValue"])) return;
      const payload = {
        kpi_id: $("#mKpi").value, periodo: $("#mPeriod").value,
        fecha: $("#mDate").value, valor: Number($("#mValue").value),
        responsable: $("#mResponsable").value, notas: $("#mNotes").value,
      };
      try {
        if (id) await PUT(`/mediciones/${id}`, payload);
        else await POST("/mediciones", payload);
        closeModal();
        toast(id ? "Medición actualizada" : "Medición registrada");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── INITIATIVE FORM ───────────────────────────────────────────────────────────
async function openInitiativeForm(id = null) {
  if (!canEdit()) { toast("Tu rol no permite modificar iniciativas.", "error"); return; }
  const [objetivos, kpis, trabajadores] = await Promise.all([GET("/objetivos"), GET("/kpis"), GET("/trabajadores?activo=1")]);
  const ini = id ? await GET(`/iniciativas/${id}`) : {};
  const editing = !!id;

  const objOpts  = `<option value="">Seleccionar objetivo</option>` +
    objetivos.map(o=>`<option value="${o.id}" ${ini.objetivo_id===o.id?"selected":""}>${escapeHtml(o.id+" · "+o.nombre)}</option>`).join("");
  const kpiOpts  = `<option value="">Sin KPI vinculado</option>` +
    kpis.map(k=>`<option value="${k.id}" ${ini.kpi_id===k.id?"selected":""}>${escapeHtml(k.id+" · "+k.nombre)}</option>`).join("");
  const trabOpts = `<option value="">Sin asignar</option>` +
    trabajadores.map(t=>`<option value="${t.id}" ${ini.trabajador_id===t.id?"selected":""}>${escapeHtml(t.nombre+" "+t.apellido)} — ${escapeHtml(t.area)}</option>`).join("");

  showModal(
    editing ? "Editar iniciativa" : "Nueva iniciativa estratégica",
    `<form id="initiativeForm" class="detail-form-grid">
      ${field("Nombre de la iniciativa", "iName", ini.nombre||"", "text", true)}
      ${selectField("Objetivo estratégico", "iObjective", objOpts)}
      ${selectField("KPI vinculado", "iKpi", kpiOpts, false)}
      ${selectField("Trabajador responsable", "iTrabajador", trabOpts, false)}
      ${field("Área", "iArea", ini.area||"", "text", false)}
      ${field("Fecha inicio", "iStart", ini.fecha_inicio||today(), "date", true)}
      ${field("Fecha fin", "iEnd", ini.fecha_fin||"", "date", true)}
      ${field("Presupuesto (S/)", "iBudget", ini.presupuesto??0, "number", true, 'min="0" step="1"')}
      ${field("Monto ejecutado (S/)", "iEjecutado", ini.ejecutado??0, "number", false, 'min="0" step="1"')}
      ${field("Avance (%)", "iProgress", ini.avance??0, "number", true, 'min="0" max="100" step="1"')}
      ${selectField("Estado", "iStatus", ["Planificada","En ejecución","En riesgo","Finalizada","Cancelada"].map(x=>`<option ${(ini.estado||"Planificada")===x?"selected":""}>${x}</option>`).join(""))}
      <div class="field full-span"><label for="iDesc">Descripción</label><textarea id="iDesc">${escapeHtml(ini.descripcion||"")}</textarea></div>
    </form>`,
    editing ? "Guardar cambios" : "Crear iniciativa",
    async () => {
      if (!validateForm(["iName","iObjective","iStart","iEnd","iBudget","iProgress"])) return;
      const selected = $("#iTrabajador").selectedOptions[0];
      const payload = {
        nombre: $("#iName").value.trim(), objetivo_id: $("#iObjective").value,
        kpi_id: $("#iKpi").value || null,
        trabajador_id: $("#iTrabajador").value || null,
        responsable: selected && selected.value ? selected.text.split(" — ")[0] : ini.responsable || "",
        area: $("#iArea").value || (selected ? selected.text.split(" — ")[1] : ""),
        fecha_inicio: $("#iStart").value, fecha_fin: $("#iEnd").value,
        presupuesto: Number($("#iBudget").value), ejecutado: Number($("#iEjecutado").value),
        avance: Number($("#iProgress").value), estado: $("#iStatus").value,
        descripcion: $("#iDesc").value,
      };
      try {
        if (editing) await PUT(`/iniciativas/${id}`, payload);
        else await POST("/iniciativas", payload);
        closeModal();
        toast(editing ? "Iniciativa actualizada" : "Iniciativa creada");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── INITIATIVE DETAIL ─────────────────────────────────────────────────────────
async function showInitiativeDetail(id) {
  const ini = await GET(`/iniciativas/${id}`);
  if (!ini) return;
  const asgRows = (ini.asignaciones||[]).map(a=>`<tr>
    <td>${escapeHtml(a.recurso_nombre||a.recurso_id)}</td>
    <td><span class="tag">${escapeHtml(a.recurso_tipo||"—")}</span></td>
    <td>${currency(a.monto_asignado)}</td>
    <td>${currency(a.monto_ejecutado)}</td>
    <td>${escapeHtml(a.notas||"—")}</td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty-state">Sin asignaciones</td></tr>`;

  showModal(`${ini.id}: ${ini.nombre}`,
    `<div class="info-box" style="margin-bottom:14px">
      <strong>Objetivo:</strong> ${escapeHtml(ini.objetivo?.nombre||ini.objetivo_id)}<br>
      ${ini.kpi?`<strong>KPI:</strong> ${escapeHtml(ini.kpi.nombre)}<br>`:""}
      <strong>Responsable:</strong> ${escapeHtml(ini.responsable)} — ${escapeHtml(ini.area)}<br>
      ${ini.trabajador?`<strong>Trabajador:</strong> ${escapeHtml(ini.trabajador.nombre+" "+ini.trabajador.apellido)} (${escapeHtml(ini.trabajador.cargo)})<br>`:""}
      <strong>Fechas:</strong> ${escapeHtml(ini.fecha_inicio)} → ${escapeHtml(ini.fecha_fin)}<br>
      <strong>Presupuesto:</strong> ${currency(ini.presupuesto)} · <strong>Ejecutado:</strong> ${currency(ini.ejecutado)}<br>
      <strong>Avance:</strong> ${fmt(ini.avance,0)}% · <strong>Estado:</strong> ${escapeHtml(ini.estado)}
    </div>
    <div class="initiative-progress" style="margin-bottom:16px">
      <div class="progress-track" style="height:12px"><div class="progress-fill" style="width:${ini.avance}%;background:${ini.avance===100?"#16845b":"#3478e5"}"></div></div>
      <b>${fmt(ini.avance,0)}%</b>
    </div>
    <h3 style="font-size:12px;margin:0 0 8px">Asignaciones de recursos</h3>
    <div class="table-scroll"><table><thead><tr><th>Recurso</th><th>Tipo</th><th>Asignado</th><th>Ejecutado</th><th>Notas</th></tr></thead><tbody>${asgRows}</tbody></table></div>`,
    "Cerrar", closeModal, "DETALLE INICIATIVA"
  );
}

// ── TRABAJADOR FORM ───────────────────────────────────────────────────────────
async function openTrabajadorForm(id = null) {
  if (!canEdit()) { toast("Tu rol no permite modificar trabajadores.", "error"); return; }
  const t = id ? await GET(`/trabajadores/${id}`) : {};
  const editing = !!id;

  showModal(
    editing ? "Editar trabajador" : "Nuevo trabajador",
    `<form id="trabForm" class="detail-form-grid">
      ${field("DNI / Código", "tDni", t.dni||"", "text", false)}
      ${field("Nombre", "tNombre", t.nombre||"", "text", true)}
      ${field("Apellido", "tApellido", t.apellido||"", "text", true)}
      ${field("Cargo", "tCargo", t.cargo||"", "text", false)}
      ${field("Área / Departamento", "tArea", t.area||"", "text", false)}
      ${field("Correo electrónico", "tEmail", t.email||"", "email", false)}
      ${field("Teléfono", "tTelefono", t.telefono||"", "tel", false)}
      ${editing ? selectField("Estado", "tActivo", `<option value="1" ${t.activo?"selected":""}>Activo</option><option value="0" ${!t.activo?"selected":""}>Inactivo</option>`, false) : ""}
    </form>`,
    editing ? "Guardar cambios" : "Registrar trabajador",
    async () => {
      if (!validateForm(["tNombre","tApellido"])) return;
      const payload = {
        dni: $("#tDni").value, nombre: $("#tNombre").value.trim(),
        apellido: $("#tApellido").value.trim(), cargo: $("#tCargo").value,
        area: $("#tArea").value, email: $("#tEmail").value, telefono: $("#tTelefono").value,
        ...(editing && { activo: Number($("#tActivo").value) }),
      };
      try {
        if (editing) await PUT(`/trabajadores/${id}`, payload);
        else await POST("/trabajadores", payload);
        closeModal();
        toast(editing ? "Trabajador actualizado" : "Trabajador registrado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

async function confirmToggleTrabajador(id) {
  const t = await GET(`/trabajadores/${id}`);
  if (!t) return;
  showModal(
    t.activo ? "Dar de baja al trabajador" : "Activar trabajador",
    `<p>${t.activo ? `¿Deseas dar de baja a <strong>${escapeHtml(t.nombre+" "+t.apellido)}</strong>? Quedará inactivo pero sus datos se conservan.`
      : `¿Deseas activar a <strong>${escapeHtml(t.nombre+" "+t.apellido)}</strong>?`}</p>`,
    t.activo ? "Dar de baja" : "Activar",
    async () => {
      try {
        await PUT(`/trabajadores/${id}`, { activo: t.activo ? 0 : 1 });
        closeModal();
        toast(t.activo ? "Trabajador dado de baja" : "Trabajador activado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    },
    "CONFIRMACIÓN"
  );
}

// ── USER FORM ─────────────────────────────────────────────────────────────────
async function openUserForm(id = null) {
  if (!canAdmin()) { toast("Solo administradores pueden gestionar usuarios.", "error"); return; }
  const u = id ? await GET(`/users/${id}`) : {};
  const editing = !!id;

  showModal(
    editing ? "Editar usuario" : "Nuevo usuario del sistema",
    `<form id="userForm" class="detail-form-grid">
      ${field("Nombre", "uNombre", u.nombre||"", "text", !editing)}
      ${field("Apellido", "uApellido", u.apellido||"", "text", false)}
      ${editing ? "" : field("Email", "uEmail", u.email||"", "email", true)}
      ${editing ? "" : field("Contraseña inicial", "uPassword", "", "password", true)}
      ${selectField("Rol", "uRol", ["Administrador","Gerente","Responsable"].map(x=>`<option ${(u.rol||"Responsable")===x?"selected":""}>${x}</option>`).join(""))}
      ${field("Área", "uArea", u.area||"", "text", false)}
    </form>`,
    editing ? "Guardar cambios" : "Crear usuario",
    async () => {
      const payload = {
        nombre: $("#uNombre").value.trim(), apellido: $("#uApellido").value.trim(),
        rol: $("#uRol").value, area: $("#uArea").value,
        ...(!editing && { email: $("#uEmail").value.trim(), password: $("#uPassword").value }),
      };
      try {
        if (editing) await PUT(`/users/${id}`, payload);
        else await POST("/auth/register", payload);
        closeModal();
        toast(editing ? "Usuario actualizado" : "Usuario creado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── RECURSO FORM ──────────────────────────────────────────────────────────────
async function openRecursoForm(id = null) {
  if (!canEdit()) { toast("Tu rol no permite modificar recursos.", "error"); return; }
  const r = id ? await GET(`/recursos/${id}`) : {};
  const editing = !!id;

  showModal(
    editing ? "Editar recurso" : "Nuevo recurso",
    `<form id="recursoForm" class="detail-form-grid">
      ${field("Nombre del recurso", "rNombre", r.nombre||"", "text", true)}
      ${selectField("Tipo", "rTipo", ["Financiero","Equipo","Software","Presupuesto","Humano"].map(x=>`<option ${(r.tipo||"Financiero")===x?"selected":""}>${x}</option>`).join(""))}
      ${field("Monto total (S/)", "rMonto", r.monto_total??0, "number", true, 'min="0" step="1"')}
      ${selectField("Estado", "rEstado", ["Disponible","Asignado","Agotado"].map(x=>`<option ${(r.estado||"Disponible")===x?"selected":""}>${x}</option>`).join(""))}
      <div class="field full-span"><label for="rDesc">Descripción</label><textarea id="rDesc">${escapeHtml(r.descripcion||"")}</textarea></div>
    </form>`,
    editing ? "Guardar cambios" : "Crear recurso",
    async () => {
      if (!validateForm(["rNombre","rMonto"])) return;
      const payload = {
        nombre: $("#rNombre").value.trim(), tipo: $("#rTipo").value,
        monto_total: Number($("#rMonto").value), estado: $("#rEstado").value,
        descripcion: $("#rDesc").value,
      };
      try {
        if (editing) await PUT(`/recursos/${id}`, payload);
        else await POST("/recursos", payload);
        closeModal();
        toast(editing ? "Recurso actualizado" : "Recurso creado");
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    }
  );
}

// ── CONFIRM DELETE ────────────────────────────────────────────────────────────
function confirmDelete(entity, id, resource) {
  showModal(
    `Eliminar ${entity}`,
    `<p>¿Estás seguro de eliminar el ${entity} <strong>${escapeHtml(id)}</strong>? Esta acción no se puede deshacer.</p>`,
    "Eliminar",
    async () => {
      try {
        await DELETE(`/${resource}/${id}`);
        closeModal();
        toast(`${entity} eliminado`);
        renderPage(currentPage);
      } catch (e) { toast(e.message, "error"); }
    },
    "CONFIRMACIÓN"
  );
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
async function generateReport(type) {
  const title = { general:"Reporte general", perspectivas:"Desempeño por perspectiva",
    criticos:"Objetivos críticos", kpis:"Detalle de indicadores",
    iniciativas:"Portafolio de iniciativas", trabajadores:"Trabajadores y asignaciones" }[type] || "Reporte";
  $("#reportResultTitle").textContent = "Vista previa: " + title;

  let html = "";
  if (type === "kpis") {
    const items = await GET("/kpis");
    html = kpisFullTable(items);
  } else if (type === "iniciativas") {
    const items = await GET("/iniciativas");
    html = initiativesTable(items);
  } else if (type === "trabajadores") {
    const items = await GET("/trabajadores");
    html = trabajadoresTable(items);
  } else if (type === "criticos") {
    const items = (await GET("/kpis")).filter(k => ["bad","warn"].includes(k.estado_semaforo?.key));
    html = kpisFullTable(items);
  } else if (type === "perspectivas") {
    const d = await GET("/dashboard/summary");
    html = `<div class="perspective-bars">${d.por_perspectiva.map(p=>`
      <div class="perspective-row">
        <div class="perspective-name"><span class="persp-dot" style="background:${perspectives[p.perspectiva]?.color}"></span>${p.label}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,p.cumplimiento||0)}%;background:${perspectives[p.perspectiva]?.color}"></div></div>
        <div class="perspective-value">${p.cumplimiento!==null?fmt(p.cumplimiento)+"%":"—"}</div>
      </div>`).join("")}</div>`;
  } else {
    const d = await GET("/dashboard/summary");
    html = criticalKpiTable(d.criticos);
  }
  $("#reportResult").innerHTML = html;
  toast("Reporte generado");
}

async function exportReport() {
  const kpis = await GET("/kpis");
  const rows = [["ID","Indicador","Perspectiva","Objetivo","Resultado","Meta","Cumplimiento","Estado"]];
  kpis.forEach(k => rows.push([k.id, k.nombre, perspectiveLabel(k.perspectiva), k.objetivo?.nombre||k.objetivo_id,
    k.resultado_actual, k.meta, k.cumplimiento !== null ? fmt(k.cumplimiento)+"%" : "—", k.estado_semaforo?.label||"Sin datos"]));
  downloadCsv("reporte_kpis.csv", rows);
}

async function exportMeasurements() {
  const items = await GET("/mediciones");
  const rows = [["Fecha","Período","KPI","Valor","Cumplimiento","Responsable","Notas"]];
  items.forEach(m => rows.push([m.fecha, m.periodo, m.kpi_nombre||m.kpi_id, m.valor, m.cumplimiento!==null?fmt(m.cumplimiento)+"%":"—", m.responsable, m.notas]));
  downloadCsv("mediciones_bsc.csv", rows);
  toast("CSV de mediciones descargado");
}

async function exportTrabajadores() {
  const items = await GET("/trabajadores");
  const rows = [["ID","DNI","Nombre","Apellido","Cargo","Área","Email","Teléfono","Estado"]];
  items.forEach(t => rows.push([t.id, t.dni, t.nombre, t.apellido, t.cargo, t.area, t.email, t.telefono, t.activo?"Activo":"Inactivo"]));
  downloadCsv("trabajadores_bsc.csv", rows);
  toast("CSV de trabajadores descargado");
}

function downloadCsv(filename, rows) {
  const content = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(filename, "\ufeff" + content, "text/csv");
}

function downloadBlob(filename, content, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════════════════════════════

// Add Trabajadores nav item dynamically
(function addTrabajadoresNav() {
  const nav = $("#mainNav");
  if (!nav) return;
  const existingBtn = nav.querySelector('[data-page="trabajadores"]');
  if (existingBtn) return;
  // Insert after iniciativas button
  const iniciativasBtn = nav.querySelector('[data-page="iniciativas"]');
  if (iniciativasBtn) {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.page = "trabajadores";
    btn.innerHTML = `<span class="nav-icon">♙</span>Trabajadores`;
    iniciativasBtn.after(btn);
  }
})();

if (restoreSession()) {
  showApp();
} else {
  showLogin();
}

})();
