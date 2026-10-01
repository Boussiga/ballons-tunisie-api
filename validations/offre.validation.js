const { z } = require("zod");
const { paginationQuery } = require("./validate.middleware");

// ─── Helper: ISO 8601 date ────────────────────────────────────────────────────
const isoDateString = (label) =>
  z
    .string({ required_error: `${label} est requise.` })
    .datetime({ message: `${label} doit être une date ISO 8601 valide (ex: 2024-10-01T00:00:00Z).` });

// ─── GET list: pagination + active filter ─────────────────────────────────────
const listOffresSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    active: z
      .enum(["true", "false"], {
        errorMap: () => ({ message: "active doit être 'true' ou 'false'." }),
      })
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
    search: z
      .string()
      .max(100, "La recherche ne peut pas dépasser 100 caractères.")
      .trim()
      .optional(),
  }),
};

// ─── Creation ─────────────────────────────────────────────────────────────────
const createOffreSchema = {
  body: z
    .object({
      titre: z
        .string({ required_error: "Le titre est requis." })
        .min(3, "Le titre doit contenir au moins 3 caractères.")
        .max(200, "Le titre ne peut pas dépasser 200 caractères.")
        .trim(),
      pourcentageReduction: z
        .number({
          required_error: "Le pourcentage de réduction est requis.",
          invalid_type_error: "Le pourcentage doit être un nombre.",
        })
        .gt(0, "Le pourcentage doit être supérieur à 0.")
        .lte(100, "Le pourcentage ne peut pas dépasser 100."),
      dateDebut: isoDateString("La date de début"),
      dateFin: isoDateString("La date de fin"),
    })
    .refine(
      (data) => new Date(data.dateDebut) < new Date(data.dateFin),
      {
        message: "La date de début doit être antérieure à la date de fin.",
        path: ["dateDebut"],
      }
    ),
};

// ─── Modification ─────────────────────────────────────────────────────────────
const updateOffreSchema = {
  body: z
    .object({
      titre: z
        .string()
        .min(3, "Le titre doit contenir au moins 3 caractères.")
        .max(200)
        .trim()
        .optional(),
      pourcentageReduction: z
        .number({ invalid_type_error: "Le pourcentage doit être un nombre." })
        .gt(0, "Le pourcentage doit être supérieur à 0.")
        .lte(100)
        .optional(),
      dateDebut: z
        .string()
        .datetime({ message: "dateDebut doit être une date ISO 8601 valide." })
        .optional(),
      dateFin: z
        .string()
        .datetime({ message: "dateFin doit être une date ISO 8601 valide." })
        .optional(),
    })
    .refine(
      (data) => {
        if (data.dateDebut && data.dateFin) {
          return new Date(data.dateDebut) < new Date(data.dateFin);
        }
        return true;
      },
      {
        message: "La date de début doit être antérieure à la date de fin.",
        path: ["dateDebut"],
      }
    ),
};

module.exports = { listOffresSchema, createOffreSchema, updateOffreSchema };
