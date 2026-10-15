const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { readLimiter } = require("../config/rateLimiter");
const dashboardController = require("../controller/admin.dashboard.controller");
const statistiquesController = require("../controller/admin.statistiques.controller");

// Toutes les routes dashboard sont protégées (consulterDashboard)
router.get("/getDashboard", authMiddleware, dashboardController.getDashboard);
router.get("/getStatistiquesVentes/ventes", authMiddleware, dashboardController.getStatistiquesVentes);

// Detailed statistics — period + granularity are validated in the controller (Express 5 req.query is read-only)
router.get("/getStatistiquesDetaillees", authMiddleware, readLimiter, statistiquesController.getStatistiquesDetaillees);

module.exports = router;
