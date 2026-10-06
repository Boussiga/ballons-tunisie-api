const { z } = require("zod");
const { paginationQuery } = require("./validate.middleware");



// ─── GET list: pagination + filters ─────────────────────────────────────────
const listProduitsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    categorieId: z.coerce.number().int().optional(),
    search: z
      .string()
      .max(100, "La recherche ne peut pas dépasser 100 caractères.")
      .trim()
      .optional(),
    stockFaible: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  }),
};

// ─── Creation ─────────────────────────────────────────────────────────────────
const createProduitSchema = {
  body: z.object({
    nom: z
      .string({ required_error: "Le nom est requis." })
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(200, "Le nom ne peut pas dépasser 200 caractères.")
      .trim(),
    categorieId: z.coerce.number({ required_error: "La catégorie est requise.", invalid_type_error: "La catégorie doit être un ID valide." }).int().positive(),
    taille: z
      .string()
      .max(10, "La taille ne peut pas dépasser 10 caractères.")
      .trim()
      .optional(),
    prix: z.coerce.number({ required_error: "Le prix est requis.", invalid_type_error: "Le prix doit être un nombre." })
      .positive("Le prix doit être supérieur à 0.")
      .max(99999.99, "Le prix ne peut pas dépasser 99 999,99."),
    stock: z.coerce.number({ invalid_type_error: "Le stock doit être un nombre entier." })
      .int("Le stock doit être un entier.")
      .min(0, "Le stock ne peut pas être négatif.")
      .default(0),
    description: z
      .string()
      .max(1000, "La description ne peut pas dépasser 1000 caractères.")
      .trim()
      .optional(),
  }),
};

// ─── Modification ─────────────────────────────────────────────────────────────
const updateProduitSchema = {
  body: z.object({
    nom: z
      .string()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(200)
      .trim()
      .optional(),
    categorieId: z.coerce.number().int().positive().optional(),
    taille: z.string().max(10).trim().optional(),
    prix: z.coerce.number({ invalid_type_error: "Le prix doit être un nombre." })
      .positive("Le prix doit être supérieur à 0.")
      .max(99999.99)
      .optional(),
    stock: z.coerce.number({ invalid_type_error: "Le stock doit être un entier." })
      .int()
      .min(0, "Le stock ne peut pas être négatif.")
      .optional(),
    description: z.string().max(1000).trim().optional(),
  }),
};

// ─── Stock update ────────────────────────────────────────────────────────
const updateStockSchema = {
  body: z.object({
    stock: z.coerce.number({ required_error: "Le stock est requis.", invalid_type_error: "Le stock doit être un entier." })
      .int("Le stock doit être un entier.")
      .min(0, "Le stock ne peut pas être négatif."),
  }),
};

module.exports = {
  listProduitsSchema,
  createProduitSchema,
  updateProduitSchema,
  updateStockSchema,
};