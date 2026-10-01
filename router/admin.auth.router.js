const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate } = require("../validations/validate.middleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require("../validations/auth.validation");
const { authLimiter } = require("../config/rateLimiter");
const authController = require("../controller/admin.auth.controller");

// ─── Public routes ──────────────────────────────────────────────────────────
router.post("/register", validate(registerSchema), authController.register);

// Strict rate limit on login and refresh (anti brute-force)
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authLimiter, validate(refreshSchema), authController.refreshToken);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.post("/logout", authMiddleware, validate(logoutSchema), authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/profil", authMiddleware, authController.getProfil);

module.exports = router;
