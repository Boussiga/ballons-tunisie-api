const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const dashboardController = require("../controller/admin.dashboard.controller");

// Toutes les routes dashboard sont protégées (consulterDashboard)
router.get("/getDashboard", authMiddleware, dashboardController.getDashboard);
router.get("/getStatistiquesVentes/ventes", authMiddleware, dashboardController.getStatistiquesVentes);

module.exports = router;
