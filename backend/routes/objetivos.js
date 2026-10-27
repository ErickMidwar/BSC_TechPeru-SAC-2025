"use strict";

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/objetivosController");
const { authenticate, requireEditor } = require("../middleware/auth");

router.use(authenticate);

router.get("/relaciones/all", ctrl.relaciones);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", requireEditor, ctrl.create);
router.put("/:id", requireEditor, ctrl.update);
router.delete("/:id", requireEditor, ctrl.remove);

module.exports = router;
