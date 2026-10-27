import { perspectives } from "./constants.js";

export function fmt(n, d = 1) {
  return n === null || n === undefined || n === ""
    ? "—"
    : Number(n).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function currency(n) {
  return "S/ " + Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function perspectiveLabel(p) {
  return perspectives[p]?.label || p || "—";
}

export function downloadCsv(filename, rows) {
  const content = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(filename, "\ufeff" + content, "text/csv");
}

export function downloadBlob(filename, content, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
