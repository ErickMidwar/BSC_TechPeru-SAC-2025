"use strict";

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/usersController");
const { authenticate, requireAdmin } = require("../middleware/auth");

router.use(authenticate);

router.get("/", requireAdmin, ctrl.list);
router.get("/:id", ctrl.getOne);
router.put("/:id", ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

module.exports = router;
