"use strict";

const db = require("../config/database");
const { newId } = require("./ids");

function audit(user, accion, entidad, entidad_id, detalle) {
  db.prepare(
    "INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)"
  ).run(
    newId("aud"),
    user || "Sistema",
    accion,
    entidad,
    entidad_id || "",
    detalle || ""
  );
}

module.exports = { audit };
