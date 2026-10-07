const { z } = require("zod");

// Valid order statuses
const STATUTS = ["en_attente", "confirmee", "livree", "annulee"];

// ─── GET list: pagination + filters ──────────────────────────────────────────
const listCommandesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    statut: z.enum(STATUTS, { errorMap: () => ({ message: `Statut invalide. Valeurs: ${STATUTS.join(", ")}` }) }).optional(),
    search: z.string().max(100).trim().optional(),
    dateDebut: z.string().datetime({ message: "dateDebut doit être une date ISO 8601 valide." }).optional(),
    dateFin: z.string().datetime({ message: "dateFin doit être une date ISO 8601 valide." }).optional(),
  }),
};

// ─── Status update ────────────────────────────────────────────────────────────
const updateStatutSchema = {
  body: z.object({
    statut: z.enum(STATUTS, {
      required_error: "Le statut est requis.",
      errorMap: () => ({ message: `Statut invalide. Valeurs: ${STATUTS.join(", ")}` }),
    }),
  }),
};

// ─── Create order (admin) ─────────────────────────────────────────────────────
const ligneItem = z
  .object({
    produitId: z.number().int().positive().optional(),
    packId: z.string().uuid("packId doit être un UUID valide.").optional(),
    offreId: z.string().uuid("offreId doit être un UUID valide.").optional(),
    quantite: z.number({ required_error: "La quantité est requise." }).int().min(1).max(100),
  })
  .refine((d) => d.produitId || d.packId, {
    message: "Chaque ligne doit avoir un produitId ou un packId.",
  });

const createCommandeSchema = {
  body: z.object({
    nomClient: z.string({ required_error: "Le nom du client est requis." }).min(2).max(100).trim(),
    telephoneClient: z
      .string({ required_error: "Le téléphone est requis." })
      .regex(/^[0-9+]{8,15}$/, "Le numéro de téléphone est invalide."),
    adresseLivraison: z.string({ required_error: "L'adresse est requise." }).min(5).max(300).trim(),
    lignes: z.array(ligneItem, { required_error: "Les lignes de commande sont requises." }).min(1, "La commande doit avoir au moins une ligne."),
  }),
};

module.exports = { listCommandesSchema, updateStatutSchema, createCommandeSchema, STATUTS };
