const { z } = require("zod");

// ─── Line item (product or pack, optional offer) ──────────────────────────────
const ligneItem = z
  .object({
    produitId: z.number().int().positive("produitId doit être un entier positif.").optional(),
    packId:    z.string().uuid("packId doit être un UUID valide.").optional(),
    offreId:   z.string().uuid("offreId doit être un UUID valide.").optional(),
    quantite:  z.number({ required_error: "La quantité est requise." }).int().min(1).max(50),
  })
  .refine((d) => d.produitId || d.packId, {
    message: "Chaque ligne doit avoir un produitId ou un packId.",
  });

// ─── Place order schema ───────────────────────────────────────────────────────
const passerCommandeSchema = {
  body: z.object({
    nomClient: z
      .string({ required_error: "Le nom du client est requis." })
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(100)
      .trim(),
    telephoneClient: z
      .string({ required_error: "Le téléphone est requis." })
      .regex(/^[0-9+]{8,15}$/, "Le numéro de téléphone est invalide (8 à 15 chiffres)."),
    adresseLivraison: z
      .string({ required_error: "L'adresse de livraison est requise." })
      .min(5, "L'adresse doit contenir au moins 5 caractères.")
      .max(300)
      .trim(),
    lignes: z
      .array(ligneItem, { required_error: "Les lignes de commande sont requises." })
      .min(1, "La commande doit avoir au moins une ligne."),
  }),
};

module.exports = { passerCommandeSchema };
