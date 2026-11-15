const express = require("express");
const router = express.Router();
const { parseImages, uploadToCloudinary } = require("../middelwhere/upload.middleware");
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, idParam } = require("../validations/validate.middleware");
const { imageParams } = require("../validations/produit.validation");
const {
  listProduitsSchema,
  createProduitSchema,
  updateProduitSchema,
  updateStockSchema,
} = require("../validations/produit.validation");
const { uploadLimiter, readLimiter } = require("../config/rateLimiter");
const  produitController = require("../controller/admin.produit.controller");

// GET list: pagination + filters (category, search, lowStock)
router.get("/getAllProduits", authMiddleware, readLimiter, validate(listProduitsSchema), produitController.getAllProduits);

// GET by ID
router.get("/getProduitById/:id", authMiddleware, readLimiter, validate({ params: idParam }), produitController.getProduitById);

// POST create
router.post("/createProduit", authMiddleware, uploadLimiter, parseImages, validate(createProduitSchema), uploadToCloudinary, produitController.createProduit);

// PUT update
router.put("/updateProduit/:id", authMiddleware, uploadLimiter, parseImages, validate({ params: idParam, ...updateProduitSchema }), uploadToCloudinary,produitController.updateProduit);

// Gallery (up to 5 images): remove one image, choose the main image
router.delete("/deleteImage/:id/images/:imageId", authMiddleware, validate({ params: imageParams }), produitController.supprimerImage);
router.patch("/setImagePrincipale/:id/images/:imageId", authMiddleware, validate({ params: imageParams }), produitController.definirImagePrincipale);

// DELETE remove
router.delete("/deleteProduit/:id", authMiddleware, validate({ params: idParam }), produitController.deleteProduit);

// GET check stock
router.get("/verifierStock/:id/stock", authMiddleware, readLimiter, validate({ params: idParam }), produitController.verifierStock);

// PATCH update stock
router.patch("/updateStock/:id/stock", authMiddleware, validate({ params: idParam, ...updateStockSchema }), produitController.updateStock);

module.exports = router;
