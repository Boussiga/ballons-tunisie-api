const prisma = require("../config/prisma");

/**
 * @desc  Place an order as a guest — validates stock, applies offers, atomic transaction
 * @route POST /api/store/commandes
 * @access Public
 */
const passerCommande = async (req, res) => {
  const { nomClient, telephoneClient, adresseLivraison, lignes } = req.body;
  try {
    const now = new Date();

    const produitIds = lignes.filter((l) => l.produitId).map((l) => l.produitId);
    const packIds    = lignes.filter((l) => l.packId).map((l) => l.packId);
    const offreIds   = lignes.filter((l) => l.offreId).map((l) => l.offreId);

    const [produits, packs, offres] = await Promise.all([
      prisma.produit.findMany({ where: { id: { in: produitIds } } }),
      prisma.pack.findMany({ where: { id: { in: packIds } } }),
      prisma.offre.findMany({ where: { id: { in: offreIds } } }),
    ]);

    // Validate each line
    const errors = [];
    for (const ligne of lignes) {
      if (ligne.produitId) {
        const p = produits.find((x) => x.id === ligne.produitId);
        if (!p) { errors.push(`Produit ID ${ligne.produitId} introuvable.`); continue; }
        if (p.stock < ligne.quantite)
          errors.push(`Stock insuffisant pour "${p.nom}" (disponible: ${p.stock}, demandé: ${ligne.quantite}).`);
      }
      if (ligne.packId) {
        if (!packs.find((x) => x.id === ligne.packId))
          errors.push(`Pack ID ${ligne.packId} introuvable.`);
      }
      if (ligne.offreId) {
        const o = offres.find((x) => x.id === ligne.offreId);
        if (!o) { errors.push(`Offre ID ${ligne.offreId} introuvable.`); continue; }
        if (now < new Date(o.dateDebut) || now > new Date(o.dateFin))
          errors.push(`L'offre "${o.titre}" n'est plus active.`);
      }
    }
    if (errors.length > 0) return res.status(400).json({ message: "Données invalides.", erreurs: errors });

    // Build lines and compute total
    let total = 0;
    const lignesData = lignes.map((ligne) => {
      let prixInitiale = 0;
      if (ligne.produitId) prixInitiale = produits.find((p) => p.id === ligne.produitId).prix;
      if (ligne.packId)    prixInitiale = packs.find((p) => p.id === ligne.packId).prixPack;

      let prixFinal = prixInitiale;
      if (ligne.offreId) {
        const o = offres.find((o) => o.id === ligne.offreId);
        prixFinal = prixInitiale * (1 - o.pourcentageReduction / 100);
      }
      total += prixFinal * ligne.quantite;

      return {
        quantite: ligne.quantite,
        prixInitiale,
        ...(ligne.produitId && { produitId: ligne.produitId }),
        ...(ligne.packId    && { packId: ligne.packId }),
        ...(ligne.offreId   && { offreId: ligne.offreId }),
      };
    });
    total = parseFloat(total.toFixed(2));

    // Atomic transaction: create order + decrement stock
    const commande = await prisma.$transaction(async (tx) => {
      const newCommande = await tx.commande.create({
        data: {
          nomClient, telephoneClient, adresseLivraison, total,
          lignes: { create: lignesData },
        },
        include: { lignes: { include: { produit: true, pack: true, offre: true } } },
      });

      for (const ligne of lignes) {
        if (ligne.produitId) {
          await tx.produit.update({
            where: { id: ligne.produitId },
            data: { stock: { decrement: ligne.quantite } },
          });
        }
      }
      return newCommande;
    });

    res.status(201).json({
      message: "Commande passée avec succès. Nous vous contacterons sous peu.",
      commande,
    });
  } catch (error) {
    console.error("Erreur passerCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Track an order by ID (public) — hides sensitive data
 * @route GET /api/store/commandes/:id
 * @access Public
 */
const suiviCommande = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: {
        lignes: {
          select: {
            quantite: true,
            prixInitiale: true,
            produit: { select: { nom: true, imageUrl: true } },
            pack:    { select: { nom: true } },
            offre:   { select: { titre: true, pourcentageReduction: true } },
          },
        },
      },
    });

    if (!commande) return res.status(404).json({ message: "Commande introuvable." });

    // Return tracking info only — no full address
    res.status(200).json({
      id: commande.id,
      statut: commande.statut,
      dateCommande: commande.dateCommande,
      total: commande.total,
      nomClient: commande.nomClient,
      lignes: commande.lignes,
    });
  } catch (error) {
    console.error("Erreur suiviCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { passerCommande, suiviCommande };
