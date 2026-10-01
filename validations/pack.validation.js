const { z } = require("zod");
const { paginationQuery } = require("./validate.middleware");

// ─── Product schema in a pack ─────────────────────────────────────────
const packProduitItem = z.object({
  produitId: z
    .number({ required_error: "produitId est requis.", invalid_type_error: "produitId doit être un nombre." })
    .int("produitId doit être un entier.")
    .positive("produitId doit être positif."),
  quantite: z
    .number({ invalid_type_error: "La quantité doit être un nombre." })
    .int("La quantité doit être un entier.")
    .min(1, "La quantité doit être au moins 1.")
    .default(1),
});

// ─── GET list: pagination ────────────────────────────────────────────────────
const listPacksSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z
      .string()
      .max(100, "La recherche ne peut pas dépasser 100 caractères.")
      .trim()
      .optional(),
  }),
};

// ─── Creation ─────────────────────────────────────────────────────────────────
const createPackSchema = {
  body: z.object({
    nom: z
      .string({ required_error: "Le nom du pack est requis." })
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(200, "Le nom ne peut pas dépasser 200 caractères.")
      .trim(),
    description: z
      .string()
      .max(1000, "La description ne peut pas dépasser 1000 caractères.")
      .trim()
      .optional(),
    produits: z
      .array(packProduitItem, { required_error: "La liste de produits est requise." })
      .min(1, "Un pack doit contenir au moins un produit.")
      .max(20, "Un pack ne peut pas contenir plus de 20 produits."),
  }),
};

// ─── Modification ─────────────────────────────────────────────────────────────
const updatePackSchema = {
  body: z.object({
    nom: z
      .string()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(200)
      .trim()
      .optional(),
    description: z.string().max(1000).trim().optional(),
    produits: z
      .array(packProduitItem)
      .min(1, "Un pack doit contenir au moins un produit.")
      .max(20)
      .optional(),
  }),
};

module.exports = { listPacksSchema, createPackSchema, updatePackSchema };
