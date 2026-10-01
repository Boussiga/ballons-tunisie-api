const { z } = require("zod");

const createCategorieSchema = {
  body: z.object({
    nom: z
      .string({ required_error: "Le nom est requis." })
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(100, "Le nom ne peut pas dépasser 100 caractères.")
      .trim(),
    description: z
      .string()
      .max(500, "La description ne peut pas dépasser 500 caractères.")
      .trim()
      .optional(),
  }),
};

const updateCategorieSchema = {
  body: z.object({
    nom: z
      .string()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(100, "Le nom ne peut pas dépasser 100 caractères.")
      .trim()
      .optional(),
    description: z
      .string()
      .max(500, "La description ne peut pas dépasser 500 caractères.")
      .trim()
      .optional(),
  }),
};

module.exports = {
  createCategorieSchema,
  updateCategorieSchema,
};
