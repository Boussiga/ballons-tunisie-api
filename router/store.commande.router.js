const express = require("express");
const router = express.Router();
const { validate, uuidParam } = require("../validations/validate.middleware");
const { passerCommandeSchema } = require("../validations/store.commande.validation");
const commandeController = require("../controller/store.commande.controller");
const { globalLimiter } = require("../config/rateLimiter");

// POST place an order as a guest
router.post("/passerCommande", globalLimiter, validate(passerCommandeSchema), commandeController.passerCommande);

// GET track an order by UUID
router.get("/suiviCommande/:id", validate({ params: uuidParam }), commandeController.suiviCommande);

module.exports = router;
