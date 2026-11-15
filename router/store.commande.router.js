const express = require("express");
const router = express.Router();
const { validate, uuidParam } = require("../validations/validate.middleware");
const { passerCommandeSchema } = require("../validations/store.commande.validation");
const commandeController = require("../controller/store.commande.controller");

// POST place an order as a guest (rate limited by globalLimiter, applied to /api in app.js)
router.post("/passerCommande", validate(passerCommandeSchema), commandeController.passerCommande);

// GET track an order by UUID
router.get("/suiviCommande/:id", validate({ params: uuidParam }), commandeController.suiviCommande);

module.exports = router;
