"use strict";

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/recursosController");
const { authenticate, requireEditor } = require("../middleware/auth");

router.use(authenticate);

// Asignaciones sub-resource (must come BEFORE /:id to avoid collision)
router.get("/asignaciones",      ctrl.listAsignaciones);
router.post("/asignaciones",     requireEditor, ctrl.createAsignacion);
router.put("/asignaciones/:id",  requireEditor, ctrl.updateAsignacion);
router.delete("/asignaciones/:id", requireEditor, ctrl.removeAsignacion);

// Recursos CRUD
router.get("/",     ctrl.list);
router.get("/:id",  ctrl.getOne);
router.post("/",    requireEditor, ctrl.create);
router.put("/:id",  requireEditor, ctrl.update);
router.delete("/:id", requireEditor, ctrl.remove);

module.exports = router;
