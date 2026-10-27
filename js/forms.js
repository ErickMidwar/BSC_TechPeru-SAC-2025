import { $, $$, escapeHtml } from "./lib/dom.js";
import { pageTitles, perspectives, compliance } from "./lib/constants.js";
import { getUser, canEdit, canMeasure, canApprove, canAdmin } from "./lib/auth.js";
import { GET, POST, PUT, DELETE } from "./lib/api.js";
import { fmt, currency, today, perspectiveLabel, downloadCsv, downloadBlob } from "./lib/format.js";
import { toast, pageHead, metricCard, showModal, closeModal, field, selectField, validateForm, optionsPerspectives } from "./lib/ui.js";

import {
  objectivesTable, kpisFullTable, measurementTable, initiativesTable, trabajadoresTable, criticalKpiTable,
} from "./pages.js";

let ctx = { currentPage: "dashboard", navigate(){}, renderPage(){}, refreshNotifications(){} };
export function setFormsContext(api) { ctx = { ...ctx, ...api }; }

async function approveMeasurement(id, estado) {
  if (!canApprove()) { toast("No autorizado.", "error"); return; }
  try {
    await POST(`/mediciones/${id}/approve`, { estado });
    toast(estado === "aprobado" ? "Medición aprobada" : "Medición rechazada");
    ctx.renderPage(ctx.currentPage);
    ctx.refreshNotifications();
  } catch (e) { toast(e.message, "error"); }
}


// ══════════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

export function bindPageEvents(page) {
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

export async function handleAction(action, id, data = {}) {
  switch (action) {
    // Navigation shortcuts
    case "go-mediciones":  ctx.navigate("mediciones");  break;
    case "go-kpis":        ctx.navigate("kpis");        break;
    case "go-reportes":    ctx.navigate("reportes");    break;

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
    case "approve-measurement": await approveMeasurement(id, "aprobado"); break;
    case "reject-measurement": await approveMeasurement(id, "rechazado"); break;
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
      ${selectField("Perspectiva", "oPerspective", optionsPerspectives(o.perspectiva || "financiera", perspectives))}
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
        ctx.renderPage(ctx.currentPage);
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
      ${selectField("Perspectiva", "kPerspective", optionsPerspectives(k.perspectiva||"financiera", perspectives))}
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
        ctx.renderPage(ctx.currentPage);
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
  if (!canMeasure()) { toast("Tu rol no permite registrar mediciones.", "error"); return; }
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
      ${field("Responsable", "mResponsable", m?.responsable || getUser()?.nombre || "", "text", false)}
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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
        ctx.renderPage(ctx.currentPage);
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




