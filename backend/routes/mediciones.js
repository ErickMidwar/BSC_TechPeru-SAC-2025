"use strict";

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/medicionesController");
const { authenticate, requireMeasurer, requireApprover } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", requireMeasurer, ctrl.create);
router.put("/:id", requireMeasurer, ctrl.update);
router.post("/:id/approve", requireApprover, ctrl.approve);
router.delete("/:id", requireApprover, ctrl.remove);

module.exports = router;
