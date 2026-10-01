const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, idParam } = require("../validations/validate.middleware");
const {
  listPacksSchema,
  createPackSchema,
  updatePackSchema,
} = require("../validations/pack.validation");
const { readLimiter } = require("../config/rateLimiter");
const packController = require("../controller/admin.pack.controller");

// GET list — pagination + search
router.get("/getAllPacks", authMiddleware, readLimiter, validate(listPacksSchema),packController.getAllPacks);

// GET by ID
router.get("/getPackById/:id", authMiddleware, readLimiter, validate({ params: idParam }), packController.getPackById);

// POST create
router.post("/createPack", authMiddleware, validate(createPackSchema), packController.createPack);

// PUT update
router.put("/updatePack/:id", authMiddleware, validate({ params: idParam, ...updatePackSchema }), packController.updatePack);

// DELETE remove
router.delete("/deletePack/:id", authMiddleware, validate({ params: idParam }), packController.deletePack);

module.exports = router;
