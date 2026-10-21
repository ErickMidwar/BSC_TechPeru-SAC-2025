"use strict";

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/authController");
const { authenticate, requireAdmin } = require("../middleware/auth");

router.post("/login",    ctrl.login);
router.post("/register", authenticate, requireAdmin, ctrl.register);
router.get("/me",        authenticate, ctrl.me);

module.exports = router;
