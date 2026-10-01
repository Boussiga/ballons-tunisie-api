const { z } = require("zod");
const { paginationQuery } = require("./validate.middleware");

// ─── Register ─────────────────────────────────────────────────────────────────
const registerSchema = {
  body: z.object({
    nom: z
      .string({ required_error: "Le nom est requis." })
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(100, "Le nom ne peut pas dépasser 100 caractères.")
      .trim(),
    email: z
      .string({ required_error: "L'email est requis." })
      .email("L'adresse email est invalide.")
      .toLowerCase()
      .trim(),
    motDePasse: z
      .string({ required_error: "Le mot de passe est requis." })
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre."
      ),
  }),
};

// ─── Login ────────────────────────────────────────────────────────────────────
const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: "L'email est requis." })
      .email("L'adresse email est invalide.")
      .toLowerCase()
      .trim(),
    motDePasse: z
      .string({ required_error: "Le mot de passe est requis." })
      .min(1, "Le mot de passe est requis."),
  }),
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshSchema = {
  body: z.object({
    refreshToken: z
      .string({ required_error: "Le refresh token est requis." })
      .min(1, "Le refresh token ne peut pas être vide."),
  }),
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logoutSchema = {
  body: z.object({
    refreshToken: z
      .string({ required_error: "Le refresh token est requis." })
      .min(1, "Le refresh token ne peut pas être vide."),
  }),
};

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
