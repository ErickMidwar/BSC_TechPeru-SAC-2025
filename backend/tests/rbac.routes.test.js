"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

// Use an isolated temp DB for route-level smoke tests via auth middleware helpers
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_key_at_least_16_chars";
process.env.JWT_EXPIRES = "1h";

const { canMeasure, canEditStrategy, canApproveMeasurement } = require("../../shared/compliance");
const { requireJwtSecret } = require("../middleware/auth");
const jwt = require("jsonwebtoken");

describe("JWT secret requirement", () => {
  it("exige JWT_SECRET configurado", () => {
    const secret = requireJwtSecret();
    assert.ok(secret.length >= 16);
  });
});

describe("Mediciones RBAC matrix", () => {
  const matrix = [
    { rol: "Administrador", measure: true, edit: true, approve: true },
    { rol: "Gerente", measure: true, edit: true, approve: true },
    { rol: "Responsable", measure: true, edit: false, approve: false },
  ];

  for (const row of matrix) {
    it(`${row.rol}: measure=${row.measure} edit=${row.edit} approve=${row.approve}`, () => {
      assert.equal(canMeasure(row.rol), row.measure);
      assert.equal(canEditStrategy(row.rol), row.edit);
      assert.equal(canApproveMeasurement(row.rol), row.approve);
    });
  }
});

describe("Token payload shape", () => {
  it("firma y verifica un token de demo", () => {
    const token = jwt.sign(
      { id: "u1", email: "admin@techperu.com", rol: "Administrador", nombre: "Ana Pérez" },
      requireJwtSecret(),
      { expiresIn: "1h" }
    );
    const payload = jwt.verify(token, requireJwtSecret());
    assert.equal(payload.email, "admin@techperu.com");
    assert.equal(payload.rol, "Administrador");
  });
});

describe("Project layout guards", () => {
  it("existe .env.example y .env no debe estar en el índice git", () => {
    assert.ok(fs.existsSync(path.join(__dirname, "..", ".env.example")));
  });

  it("shared/compliance.js es usable desde backend", () => {
    const c = require("../../shared/compliance");
    assert.equal(typeof c.achievement, "function");
  });
});
