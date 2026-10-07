const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, uuidParam } = require("../validations/validate.middleware");
const { listCommandesSchema, updateStatutSchema, createCommandeSchema } = require("../validations/commande.validation");
const { readLimiter } = require("../config/rateLimiter");
const commandeController = require("../controller/admin.commande.controller");

// GET list — pagination + status + dates filter
router.get("/getAllCommandes", authMiddleware, readLimiter, validate(listCommandesSchema), commandeController.getAllCommandes);

// GET by ID
router.get("/getCommandeById/:id", authMiddleware, readLimiter, validate({ params: uuidParam }), commandeController.getCommandeById);

// GET calculate total
router.get("/calculerTotal/:id/total", authMiddleware, readLimiter, validate({ params: uuidParam }), commandeController.calculerTotal);

// POST create order (admin manual entry)
router.post("/createCommande", authMiddleware, validate(createCommandeSchema), commandeController.createCommande);

// PATCH update status
router.patch("/updateStatutCommande/:id/statut", authMiddleware, validate({ params: uuidParam, ...updateStatutSchema }), commandeController.updateStatutCommande);

// PATCH cancel order
router.patch("/annulerCommande/:id/annuler", authMiddleware, validate({ params: uuidParam }), commandeController.annulerCommande);

module.exports = router;
