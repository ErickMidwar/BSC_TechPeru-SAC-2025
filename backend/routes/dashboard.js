"use strict";

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/summary", ctrl.summary);
router.get("/audit",   ctrl.audit);

module.exports = router;
