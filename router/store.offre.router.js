const express = require("express");
const router = express.Router();
const { readLimiter } = require("../config/rateLimiter");
const offreController = require("../controller/store.offre.controller");

// GET active offers only — no auth required
router.get("/getOffresActives", readLimiter, offreController.getOffresActives);

module.exports = router;
