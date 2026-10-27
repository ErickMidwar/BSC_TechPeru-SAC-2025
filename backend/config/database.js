"use strict";

/**
 * Database layer using Node.js built-in `node:sqlite` (available in Node >= 22.5).
 * Exposes a better-sqlite3-compatible API (prepare, exec, pragma, transaction).
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "bsc.db");
const SCHEMA_VERSION = 2;

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const _db = new DatabaseSync(DB_PATH);

function wrapStatement(raw) {
  return {
    run(...args) { return raw.run(...flatArgs(args)); },
    get(...args) { return raw.get(...flatArgs(args)); },
    all(...args) { return raw.all(...flatArgs(args)); },
  };
}

function flatArgs(args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
    return [args[0]];
  }
  return args;
}

const db = {
  exec(sql) { _db.exec(sql); },
  pragma(stmt) { _db.exec(`PRAGMA ${stmt};`); },
  prepare(sql) { return wrapStatement(_db.prepare(sql)); },
  transaction(fn) {
    return (...args) => {
      _db.exec("BEGIN");
      try {
        const result = fn(...args);
        _db.exec("COMMIT");
        return result;
      } catch (e) {
        try { _db.exec("ROLLBACK"); } catch (_) { /* ignore */ }
        throw e;
      }
    };
  },
};

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function dropAllTables() {
  db.pragma("foreign_keys = OFF");
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all();
  for (const t of tables) {
    db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  }
  db.pragma("foreign_keys = ON");
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      nombre      TEXT NOT NULL,
      apellido    TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      rol         TEXT NOT NULL DEFAULT 'Responsable',
      area        TEXT NOT NULL DEFAULT '',
      activo      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trabajadores (
      id          TEXT PRIMARY KEY,
      dni         TEXT NOT NULL DEFAULT '',
      nombre      TEXT NOT NULL,
      apellido    TEXT NOT NULL,
      cargo       TEXT NOT NULL DEFAULT '',
      area        TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL DEFAULT '',
      telefono    TEXT NOT NULL DEFAULT '',
      activo      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS objetivos (
      id            TEXT PRIMARY KEY,
      nombre        TEXT NOT NULL,
      perspectiva   TEXT NOT NULL,
      descripcion   TEXT NOT NULL DEFAULT '',
      responsable   TEXT NOT NULL DEFAULT '',
      trabajador_id TEXT REFERENCES trabajadores(id) ON DELETE SET NULL,
      prioridad     TEXT NOT NULL DEFAULT 'Media',
      peso          REAL NOT NULL DEFAULT 100,
      estado        TEXT NOT NULL DEFAULT 'Activo',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS objetivo_relaciones (
      id           TEXT PRIMARY KEY,
      from_id      TEXT NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
      to_id        TEXT NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
      descripcion  TEXT NOT NULL DEFAULT '',
      UNIQUE(from_id, to_id)
    );

    CREATE TABLE IF NOT EXISTS kpis (
      id               TEXT PRIMARY KEY,
      nombre           TEXT NOT NULL,
      perspectiva      TEXT NOT NULL,
      objetivo_id      TEXT NOT NULL REFERENCES objetivos(id) ON DELETE RESTRICT,
      unidad           TEXT NOT NULL DEFAULT '%',
      formula          TEXT NOT NULL DEFAULT '',
      descripcion      TEXT NOT NULL DEFAULT '',
      linea_base       REAL,
      meta             REAL,
      resultado_actual REAL,
      direccion        TEXT NOT NULL DEFAULT 'mayor',
      rango_inferior   REAL,
      rango_superior   REAL,
      frecuencia       TEXT NOT NULL DEFAULT 'Mensual',
      responsable      TEXT NOT NULL DEFAULT '',
      trabajador_id    TEXT REFERENCES trabajadores(id) ON DELETE SET NULL,
      area             TEXT NOT NULL DEFAULT '',
      peso             REAL NOT NULL DEFAULT 1,
      umbral_alerta    REAL NOT NULL DEFAULT 80,
      umbral_critico   REAL NOT NULL DEFAULT 60,
      estado           TEXT NOT NULL DEFAULT 'Activo',
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mediciones (
      id          TEXT PRIMARY KEY,
      kpi_id      TEXT NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
      periodo     TEXT NOT NULL,
      fecha       TEXT NOT NULL,
      valor       REAL NOT NULL,
      responsable TEXT NOT NULL DEFAULT '',
      notas       TEXT NOT NULL DEFAULT '',
      estado      TEXT NOT NULL DEFAULT 'aprobado',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(kpi_id, periodo)
    );

    CREATE TABLE IF NOT EXISTS recursos (
      id          TEXT PRIMARY KEY,
      nombre      TEXT NOT NULL,
      tipo        TEXT NOT NULL DEFAULT 'Financiero',
      descripcion TEXT NOT NULL DEFAULT '',
      monto_total REAL NOT NULL DEFAULT 0,
      moneda      TEXT NOT NULL DEFAULT 'PEN',
      estado      TEXT NOT NULL DEFAULT 'Disponible',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS iniciativas (
      id            TEXT PRIMARY KEY,
      nombre        TEXT NOT NULL,
      objetivo_id   TEXT NOT NULL REFERENCES objetivos(id) ON DELETE RESTRICT,
      kpi_id        TEXT REFERENCES kpis(id) ON DELETE SET NULL,
      responsable   TEXT NOT NULL DEFAULT '',
      trabajador_id TEXT REFERENCES trabajadores(id) ON DELETE SET NULL,
      area          TEXT NOT NULL DEFAULT '',
      fecha_inicio  TEXT NOT NULL,
      fecha_fin     TEXT NOT NULL,
      presupuesto   REAL NOT NULL DEFAULT 0,
      ejecutado     REAL NOT NULL DEFAULT 0,
      avance        REAL NOT NULL DEFAULT 0,
      estado        TEXT NOT NULL DEFAULT 'Planificada',
      descripcion   TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurso_asignaciones (
      id              TEXT PRIMARY KEY,
      iniciativa_id   TEXT NOT NULL REFERENCES iniciativas(id) ON DELETE CASCADE,
      recurso_id      TEXT NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
      monto_asignado  REAL NOT NULL DEFAULT 0,
      monto_ejecutado REAL NOT NULL DEFAULT 0,
      notas           TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         TEXT PRIMARY KEY,
      fecha      TEXT NOT NULL DEFAULT (datetime('now')),
      usuario    TEXT NOT NULL DEFAULT 'Sistema',
      accion     TEXT NOT NULL,
      entidad    TEXT NOT NULL,
      entidad_id TEXT NOT NULL DEFAULT '',
      detalle    TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_kpis_objetivo ON kpis(objetivo_id);
    CREATE INDEX IF NOT EXISTS idx_mediciones_kpi ON mediciones(kpi_id);
    CREATE INDEX IF NOT EXISTS idx_mediciones_periodo ON mediciones(periodo);
    CREATE INDEX IF NOT EXISTS idx_iniciativas_objetivo ON iniciativas(objetivo_id);
  `);

  db.prepare(
    "INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(SCHEMA_VERSION));
}

function initSchema() {
  let current = 0;
  try {
    const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
    current = row ? Number(row.value) : 0;
  } catch (_) {
    current = 0;
  }

  if (current < SCHEMA_VERSION) {
    if (current > 0) {
      console.log(`⚙️  Migrando esquema SQLite v${current} → v${SCHEMA_VERSION} (recreación con FKs)…`);
    }
    dropAllTables();
    createSchema();
  } else {
    createSchema();
  }
}

initSchema();

module.exports = db;
