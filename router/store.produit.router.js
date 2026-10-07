const express = require("express");
const router = express.Router();
const { readLimiter } = require("../config/rateLimiter");
const produitController = require("../controller/store.produit.controller");

// GET all products — public catalog with pagination + filters
router.get("/getAllProduitsPublic", readLimiter, produitController.getAllProduitsPublic);

// GET single product by ID
router.get("/getProduitPublic/:id", readLimiter, produitController.getProduitPublic);

module.exports = router;
