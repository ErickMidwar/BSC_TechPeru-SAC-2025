"use strict";

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/trabajadoresController");
const { authenticate, requireEditor, requireAdmin } = require("../middleware/auth");

router.use(authenticate);

router.get("/",     ctrl.list);
router.get("/:id",  ctrl.getOne);
router.post("/",    requireEditor, ctrl.create);
router.put("/:id",  requireEditor, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

module.exports = router;
