const { z } = require("zod");
const { paginationQuery } = require("./validate.middleware");

// ─── Valid statuses ───────────────────────────────────────────────────────────
const STATUTS = ["en_attente", "confirmee", "livree", "annulee"];

// ─── GET list: pagination + status filter ────────────────────────────────────
const listCommandesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    statut: z
      .enum(STATUTS, {
        errorMap: () => ({
          message: `Statut invalide. Valeurs acceptées: ${STATUTS.join(", ")}`,
        }),
      })
      .optional(),
    search: z
      .string()
      .max(100, "La recherche ne peut pas dépasser 100 caractères.")
      .trim()
      .optional(),
    dateDebut: z
      .string()
      .datetime({ message: "dateDebut doit être une date ISO 8601 valide." })
      .optional(),
    dateFin: z
      .string()
      .datetime({ message: "dateFin doit être une date ISO 8601 valide." })
      .optional(),
  }),
};

// ─── Status update ───────────────────────────────────────────────────────
const updateStatutSchema = {
  body: z.object({
    statut: z.enum(STATUTS, {
      required_error: "Le statut est requis.",
      errorMap: () => ({
        message: `Statut invalide. Valeurs acceptées: ${STATUTS.join(", ")}`,
      }),
    }),
  }),
};

module.exports = { listCommandesSchema, updateStatutSchema, STATUTS };
