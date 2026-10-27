"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  achievement,
  semaforo,
  canEditStrategy,
  canMeasure,
  canApproveMeasurement,
  canAdmin,
} = require("../../shared/compliance");

describe("achievement — mayor es mejor", () => {
  const kpi = { meta: 100, direccion: "mayor" };

  it("alcanza 100% en la meta", () => {
    assert.equal(achievement(kpi, 100), 100);
  });

  it("calcula proporción sobre la meta", () => {
    assert.equal(achievement(kpi, 80), 80);
  });

  it("permite sobrecumplimiento hasta 150%", () => {
    assert.equal(achievement(kpi, 200), 150);
  });

  it("retorna null sin valor o meta", () => {
    assert.equal(achievement(kpi, null), null);
    assert.equal(achievement({ meta: null, direccion: "mayor" }, 10), null);
  });
});

describe("achievement — menor es mejor", () => {
  const kpi = { meta: 10, direccion: "menor" };

  it("100% si valor ≤ meta", () => {
    assert.equal(achievement(kpi, 8), 100);
    assert.equal(achievement(kpi, 10), 100);
  });

  it("penaliza valores por encima de la meta", () => {
    assert.equal(achievement(kpi, 20), 50);
  });
});

describe("achievement — rango", () => {
  const kpi = { meta: 50, direccion: "rango", rango_inferior: 40, rango_superior: 60 };

  it("100% dentro del rango", () => {
    assert.equal(achievement(kpi, 50), 100);
  });

  it("penaliza fuera del rango", () => {
    const pct = achievement(kpi, 20);
    assert.ok(pct < 100);
    assert.ok(pct >= 0);
  });
});

describe("semaforo", () => {
  const kpi = { umbral_alerta: 80, umbral_critico: 60 };

  it("Logrado ≥ 100", () => {
    assert.equal(semaforo(kpi, 100).key, "good");
  });

  it("En riesgo entre alerta y 100", () => {
    assert.equal(semaforo(kpi, 85).key, "warn");
  });

  it("Crítico bajo umbral crítico", () => {
    assert.equal(semaforo(kpi, 40).key, "bad");
  });

  it("Sin datos si pct null", () => {
    assert.equal(semaforo(kpi, null).key, "neutral");
  });
});

describe("RBAC helpers", () => {
  it("Responsable puede medir pero no editar estrategia", () => {
    assert.equal(canMeasure("Responsable"), true);
    assert.equal(canEditStrategy("Responsable"), false);
    assert.equal(canApproveMeasurement("Responsable"), false);
  });

  it("Gerente edita, mide y aprueba", () => {
    assert.equal(canEditStrategy("Gerente"), true);
    assert.equal(canMeasure("Gerente"), true);
    assert.equal(canApproveMeasurement("Gerente"), true);
    assert.equal(canAdmin("Gerente"), false);
  });

  it("Administrador tiene todos los permisos", () => {
    assert.equal(canAdmin("Administrador"), true);
    assert.equal(canEditStrategy("Administrador"), true);
    assert.equal(canMeasure("Administrador"), true);
  });
});
