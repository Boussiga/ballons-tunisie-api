const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, idParam } = require("../validations/validate.middleware");
const {
  listOffresSchema,
  createOffreSchema,
  updateOffreSchema,
} = require("../validations/offre.validation");
const { readLimiter } = require("../config/rateLimiter");
const offreController = require("../controller/admin.offre.controller");

// GET list — pagination + active/search filter
router.get("/getAllOffres", authMiddleware, readLimiter, validate(listOffresSchema), offreController.getAllOffres,);

// GET by ID
router.get("/getOffreById/:id", authMiddleware, readLimiter, validate({ params: idParam }), offreController.getOffreById,);

// POST create
router.post("/createOffre", authMiddleware, validate(createOffreSchema), offreController.createOffre);

// PUT update
router.put("/updateOffre/:id", authMiddleware, validate({ params: idParam, ...updateOffreSchema }), offreController.updateOffre,);

// DELETE remove
router.delete("/deleteOffre/:id", authMiddleware, validate({ params: idParam }), offreController.deleteOffre,);

module.exports = router;
