const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
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

// ─── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  allowedTypes.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Format non supporté. Utilisez JPG, PNG ou WebP."));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});



// GET list — pagination + filters (category, search, lowStock)
router.get("/getAllProduits", authMiddleware, readLimiter, validate(listProduitsSchema), produitController.getAllProduits);

// GET by ID
router.get("/getProduitById/:id", authMiddleware, readLimiter, validate({ params: idParam }), produitController.getProduitById);

// POST create
router.post("/createProduit", authMiddleware, uploadLimiter, upload.single("image"), validate(createProduitSchema), produitController.createProduit);

// PUT update
router.put("/updateProduit/:id", authMiddleware, uploadLimiter, upload.single("image"), validate({ params: idParam, ...updateProduitSchema }),produitController.updateProduit);

// DELETE remove
router.delete("/deleteProduit/:id", authMiddleware, validate({ params: idParam }), produitController.deleteProduit);

// GET check stock
router.get("/verifierStock/:id/stock", authMiddleware, readLimiter, validate({ params: idParam }), produitController.verifierStock);

// PATCH update stock
router.patch("/updateStock/:id/stock", authMiddleware, validate({ params: idParam, ...updateStockSchema }), produitController.updateStock);

module.exports = router;
