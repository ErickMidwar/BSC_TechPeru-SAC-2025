"use strict";

/**
 * Database layer using Node.js built-in `node:sqlite` (available in Node >= 22.5).
 * Exposes a better-sqlite3-compatible API (prepare, exec, pragma, transaction).
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs   = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "bsc.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const _db = new DatabaseSync(DB_PATH);

// ── Compatibility shim for better-sqlite3 API ─────────────────────────────────
// node:sqlite uses positional ? params (same as better-sqlite3), but the
// Statement object has slightly different method names. We wrap them here.

function wrapStatement(raw) {
  return {
    run(...args)  { return raw.run(...flatArgs(args)); },
    get(...args)  { return raw.get(...flatArgs(args)); },
    all(...args)  { return raw.all(...flatArgs(args)); },
  };
}

// better-sqlite3 allows calling .run(obj) for named params OR .run(...vals)
// node:sqlite .run() accepts positional or named params via an object.
// We normalise: if first arg is a plain object and there's only one arg, pass as named; else positional.
function flatArgs(args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
    return [args[0]];
  }
  return args;
}

const db = {
  /** Execute raw SQL (no params). */
  exec(sql) {
    _db.exec(sql);
  },

  /** Set a SQLite pragma. */
  pragma(stmt) {
    _db.exec(`PRAGMA ${stmt};`);
  },

  /** Prepare a statement and return a better-sqlite3-style object. */
  prepare(sql) {
    const raw = _db.prepare(sql);
    return wrapStatement(raw);
  },

  /**
   * Wrap a function in a transaction.
   * Returns a function that, when called, executes fn inside BEGIN/COMMIT.
   */
  transaction(fn) {
    return (...args) => {
      _db.exec("BEGIN");
      try {
        const result = fn(...args);
        _db.exec("COMMIT");
        return result;
      } catch (e) {
        try { _db.exec("ROLLBACK"); } catch (_) {}
        throw e;
      }
    };
  },
};

// Enable pragmas
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────
function initSchema() {
  db.exec(`
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
      trabajador_id TEXT,
      prioridad     TEXT NOT NULL DEFAULT 'Media',
      peso          REAL NOT NULL DEFAULT 100,
      estado        TEXT NOT NULL DEFAULT 'Activo',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kpis (
      id               TEXT PRIMARY KEY,
      nombre           TEXT NOT NULL,
      perspectiva      TEXT NOT NULL,
      objetivo_id      TEXT NOT NULL,
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
      trabajador_id    TEXT,
      area             TEXT NOT NULL DEFAULT '',
      peso             REAL NOT NULL DEFAULT 1,
      umbral_alerta    REAL NOT NULL DEFAULT 80,
      umbral_critico   REAL NOT NULL DEFAULT 60,
      estado           TEXT NOT NULL DEFAULT 'Activo',
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mediciones (
      id          TEXT PRIMARY KEY,
      kpi_id      TEXT NOT NULL,
      periodo     TEXT NOT NULL,
      fecha       TEXT NOT NULL,
      valor       REAL NOT NULL,
      responsable TEXT NOT NULL DEFAULT '',
      notas       TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
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
      objetivo_id   TEXT NOT NULL,
      kpi_id        TEXT,
      responsable   TEXT NOT NULL DEFAULT '',
      trabajador_id TEXT,
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
      iniciativa_id   TEXT NOT NULL,
      recurso_id      TEXT NOT NULL,
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
  `);
}

initSchema();

module.exports = db;
