const express = require("express");
const router = express.Router();
const authMiddleware = require("../middelwhere/auth.middleware");
const { validate } = require("../validations/validate.middleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateProfilSchema,
  updatePasswordSchema,
} = require("../validations/auth.validation");
const { authLimiter } = require("../config/rateLimiter");
const authController = require("../controller/admin.auth.controller");

// Public routes
// Only an already-logged-in admin can create another admin (no public sign-up)
router.post("/register", authMiddleware, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authLimiter, validate(refreshSchema), authController.refreshToken);

// Protected routes
router.post("/logout", authMiddleware, validate(logoutSchema), authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/profil", authMiddleware, authController.getProfil);
router.put("/profil", authMiddleware, validate(updateProfilSchema), authController.updateProfil);
router.patch("/profil/password", authMiddleware, validate(updatePasswordSchema), authController.updatePassword);

module.exports = router;
