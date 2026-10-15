const { z } = require("zod");

const GRANULARITES = ["jour", "semaine", "mois"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── GET detailed statistics: period + chart granularity ─────────────────────
const statistiquesQuery = z
  .object({
    dateDebut: z.string().regex(DATE_REGEX, "dateDebut doit être au format AAAA-MM-JJ.").optional(),
    dateFin: z.string().regex(DATE_REGEX, "dateFin doit être au format AAAA-MM-JJ.").optional(),
    granularite: z
      .enum(GRANULARITES, { message: `Granularité invalide. Valeurs: ${GRANULARITES.join(", ")}` })
      .optional(),
  })
  .refine((q) => !q.dateDebut || !q.dateFin || q.dateDebut <= q.dateFin, {
    message: "dateDebut doit être antérieure ou égale à dateFin.",
    path: ["dateDebut"],
  });

module.exports = { statistiquesQuery, GRANULARITES };
