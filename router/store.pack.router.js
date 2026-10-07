const express = require("express");
const router = express.Router();
const { readLimiter } = require("../config/rateLimiter");
const packController = require("../controller/store.pack.controller");

// GET all packs — public catalog with pagination
router.get("/getAllPacksPublic", readLimiter, packController.getAllPacksPublic);

// GET single pack by UUID
router.get("/getPackPublic/:id", readLimiter, packController.getPackPublic);

module.exports = router;
