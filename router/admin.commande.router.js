const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate, idParam } = require("../validations/validate.middleware");
const { listCommandesSchema, updateStatutSchema } = require("../validations/commande.validation");
const { readLimiter } = require("../config/rateLimiter");
const commandController = require("../controller/admin.commande.controller");

// GET list — pagination + status + dates filter
router.get("/getAllCommandes", authMiddleware, readLimiter, validate(listCommandesSchema), commandController.getAllCommandes,);

// GET by ID
router.get("/getCommandeById/:id", authMiddleware, readLimiter, validate({ params: idParam }), commandController.getCommandeById,);

// GET calculate total
router.get("/calculerTotal/:id/total", authMiddleware, readLimiter, validate({ params: idParam }), commandController.calculerTotal,);

// PATCH update status
router.patch("/updateStatutCommande/:id/statut", authMiddleware, validate({ params: idParam, ...updateStatutSchema }), commandController.updateStatutCommande,);

// PATCH cancel order
router.patch("/annulerCommande/:id/annuler", authMiddleware, validate({ params: idParam }), commandController.annulerCommande,);

module.exports = router;
