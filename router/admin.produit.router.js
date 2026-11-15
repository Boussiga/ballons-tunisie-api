const express = require("express");
const router = express.Router();
const { parseImage, uploadToCloudinary } = require("../middelwhere/upload.middleware");
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, idParam } = require("../validations/validate.middleware");
const {
  listProduitsSchema,
  createProduitSchema,
  updateProduitSchema,
  updateStockSchema,
} = require("../validations/produit.validation");
const { uploadLimiter, readLimiter } = require("../config/rateLimiter");
const  produitController = require("../controller/admin.produit.controller");

// GET list — pagination + filters (category, search, lowStock)
router.get("/getAllProduits", authMiddleware, readLimiter, validate(listProduitsSchema), produitController.getAllProduits);

// GET by ID
router.get("/getProduitById/:id", authMiddleware, readLimiter, validate({ params: idParam }), produitController.getProduitById);

// POST create
router.post("/createProduit", authMiddleware, uploadLimiter, parseImage, validate(createProduitSchema), uploadToCloudinary, produitController.createProduit);

// PUT update
router.put("/updateProduit/:id", authMiddleware, uploadLimiter, parseImage, validate({ params: idParam, ...updateProduitSchema }), uploadToCloudinary,produitController.updateProduit);

// DELETE remove
router.delete("/deleteProduit/:id", authMiddleware, validate({ params: idParam }), produitController.deleteProduit);

// GET check stock
router.get("/verifierStock/:id/stock", authMiddleware, readLimiter, validate({ params: idParam }), produitController.verifierStock);

// PATCH update stock
router.patch("/updateStock/:id/stock", authMiddleware, validate({ params: idParam, ...updateStockSchema }), produitController.updateStock);

module.exports = router;
