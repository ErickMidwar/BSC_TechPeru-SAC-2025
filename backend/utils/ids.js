"use strict";

const { randomUUID } = require("crypto");

/** Generate a prefixed UUID id, e.g. kpi_3f2a... */
function newId(prefix = "") {
  const uuid = randomUUID().replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${uuid}` : uuid;
}

module.exports = { newId };
