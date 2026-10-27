import { $, $$ } from "./lib/dom.js";
import { ORG, pageTitles } from "./lib/constants.js";
import { getUser, saveSession, clearSession, restoreSession } from "./lib/auth.js";
import { GET, POST, setUnauthorizedHandler } from "./lib/api.js";
import { toast, showModal, closeModal, bindModalEscape } from "./lib/ui.js";
import { escapeHtml } from "./lib/dom.js";
import { renderers, destroyCharts, drawDashboardCharts, drawReportCharts, setNavigation } from "./pages.js";
import { bindPageEvents, setFormsContext } from "./forms.js";

let currentPage = "dashboard";

function navigate(page) {
  if (!page) return;
  currentPage = page;
  setNavigation({ currentPage, navigate, renderPage, refreshNotifications });
  setFormsContext({ currentPage, navigate, renderPage, refreshNotifications });
  $("#sidebar").classList.remove("open");
  history.replaceState(null, "", "#" + page);
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderPage(page);
}

async function renderPage(page) {
  currentPage = page;
  setNavigation({ currentPage, navigate, renderPage, refreshNotifications });
  setFormsContext({ currentPage, navigate, renderPage, refreshNotifications });
  $("#breadcrumbPage").textContent = pageTitles[page] || "Dashboard";
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  destroyCharts();
  $("#pageContent").innerHTML = `<div class="loading-state">Cargando...</div>`;
  try {
    const html = await renderers[page]?.();
    if (html) $("#pageContent").innerHTML = html;
    bindPageEvents(page);
    if (page === "dashboard") await drawDashboardCharts();
    if (page === "reportes") await drawReportCharts();
  } catch (e) {
    toast(e.message, "error");
    $("#pageContent").innerHTML = `<div class="error-state">${escapeHtml(e.message)}</div>`;
  }
  $("#pageContent").focus({ preventScroll: true });
}

async function refreshNotifications() {
  try {
    const data = await GET("/dashboard/alertas");
    const dot = $("#notificationDot");
    if (dot) dot.style.display = data.count ? "block" : "none";
    window._alertas = data.items || [];
  } catch (_) {
    window._alertas = [];
  }
}

function toggleNotifications() {
  let pop = $("#notificationPop");
  if (pop) { pop.remove(); return; }
  const items = window._alertas || [];
  pop = document.createElement("div");
  pop.id = "notificationPop";
  pop.className = "notification-pop";
  pop.innerHTML = `<h3>Alertas estratégicas</h3>${
    items.length ? items.map(i => `<div class="notification-item"><strong>${escapeHtml(i.titulo)}</strong><small>${escapeHtml(i.detalle||'')}</small></div>`).join("")
    : '<div class="notification-item muted">Sin alertas por ahora</div>'
  }`;
  document.body.append(pop);
  const closer = (e) => {
    if (!pop.contains(e.target) && !e.target.closest("#notificationsBtn")) {
      pop.remove(); document.removeEventListener("click", closer);
    }
  };
  setTimeout(() => document.addEventListener("click", closer), 0);
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  const u = getUser();
  const initials = (u.nombre || "?").split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
  $("#sideUserName").textContent = u.nombre;
  $("#topUserName").textContent = u.nombre;
  $("#sideUserRole").textContent = u.rol;
  $("#topUserRole").textContent = u.rol;
  $$(".avatar").forEach(a => a.textContent = initials);
  const hash = (location.hash || "#dashboard").slice(1);
  currentPage = pageTitles[hash] ? hash : "dashboard";
  refreshNotifications();
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

setUnauthorizedHandler(() => { showLogin(); toast("Sesión expirada. Vuelve a ingresar.", "error"); });
setNavigation({ currentPage, navigate, renderPage, refreshNotifications });
setFormsContext({ currentPage, navigate, renderPage, refreshNotifications });

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#loginUser").value.trim();
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
$("#menuToggle")?.addEventListener("click", () => $("#sidebar").classList.add("open"));
$("#sidebarClose")?.addEventListener("click", () => $("#sidebar").classList.remove("open"));
$("#globalPeriod")?.addEventListener("change", () => {
  if (["dashboard","reportes","mapa"].includes(currentPage)) renderPage(currentPage);
});
$("#notificationsBtn")?.addEventListener("click", async (e) => {
  e.stopPropagation();
  await refreshNotifications();
  toggleNotifications();
});
$("#helpCard")?.addEventListener("click", () => {
  showModal("Guía rápida " + ORG.name,
    `<div class="info-box">
      <p><strong>Dashboard</strong> — cumplimiento global y alertas.</p>
      <p><strong>Mapa</strong> — objetivos por perspectiva y relaciones causa-efecto.</p>
      <p><strong>Mediciones</strong> — los Responsables registran; Gerentes aprueban.</p>
      <p><strong>Período</strong> — filtra el dashboard por año fiscal.</p>
    </div>`,
    "Entendido", closeModal, "AYUDA");
});
$("#mainNav").addEventListener("click", e => {
  const btn = e.target.closest("[data-page]");
  if (btn) navigate(btn.dataset.page);
});

bindModalEscape();
if (restoreSession()) showApp();
else showLogin();
