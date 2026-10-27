import { $, escapeHtml } from "./dom.js";

export function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toastRegion").append(el);
  setTimeout(() => el.remove(), 3600);
}

export function pageHead(title, desc, actions = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="head-actions">${actions}</div></div>`;
}

export function metricCard(label, value, foot, icon, kind = "blue") {
  const style = kind === "green" ? "background:#eaf8f1;color:#16845b"
    : kind === "amber" ? "background:#fff5dd;color:#b97708"
    : kind === "red" ? "background:#ffebed;color:#c23a42" : "";
  return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon" style="${style}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`;
}

let modalSubmit = null;
let lastFocus = null;

export function showModal(title, body, submitLabel = "Guardar", submitFn = null, eyebrow = "GESTIÓN") {
  lastFocus = document.activeElement;
  $("#modalTitle").textContent = title;
  $("#modalEyebrow").textContent = eyebrow;
  $("#modalBody").innerHTML = body;
  $("#modalFooter").innerHTML =
    `<button class="btn" type="button" id="modalCancel">Cancelar</button>` +
    `<button class="btn primary" type="button" id="modalSubmit">${submitLabel}</button>`;
  $("#modalLayer").classList.remove("hidden");
  modalSubmit = submitFn;
  $("#modalClose").onclick = closeModal;
  $("#modalCancel").onclick = closeModal;
  $("#modalSubmit").onclick = () => { if (modalSubmit) modalSubmit(); };
  $("#modalLayer").onclick = (e) => { if (e.target === $("#modalLayer")) closeModal(); };
  setTimeout(() => $("#modalSubmit")?.focus(), 0);
}

export function closeModal() {
  $("#modalLayer").classList.add("hidden");
  modalSubmit = null;
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

export function field(label, name, value = "", type = "text", required = true, extra = "") {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label>` +
    `<input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${extra}></div>`;
}

export function selectField(label, name, opts, required = true) {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label>` +
    `<select id="${name}" name="${name}" ${required ? "required" : ""}>${opts}</select></div>`;
}

export function validateForm(ids) {
  for (const id of ids) {
    const el = $("#" + id);
    if (el && el.required && !String(el.value).trim()) {
      el.focus();
      toast("Completa los campos obligatorios.", "error");
      return false;
    }
    if (el && el.type === "number" && el.value !== "" && !Number.isFinite(Number(el.value))) {
      el.focus();
      toast("Ingresa un valor numérico válido.", "error");
      return false;
    }
  }
  return true;
}

export function optionsPerspectives(selected, perspectives) {
  return Object.entries(perspectives).map(([k, p]) =>
    `<option value="${k}" ${selected === k ? "selected" : ""}>${p.label}</option>`
  ).join("");
}

export function bindModalEscape() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modalLayer").classList.contains("hidden")) {
      closeModal();
    }
  });
}
