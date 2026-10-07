const prisma = require("../config/prisma");

/**
 * @desc  Get all orders — pagination + filters
 * @route GET /api/admin/commandes/getAllCommandes
 * @access Private
 */
const getAllCommandes = async (req, res) => {
  try {
    let { statut, search, dateDebut, dateFin, page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (statut) where.statut = statut;
    if (search) {
      where.OR = [
        { nomClient: { contains: search } },
        { telephoneClient: { contains: search } },
      ];
    }
    if (dateDebut || dateFin) {
      where.dateCommande = {};
      if (dateDebut) where.dateCommande.gte = new Date(dateDebut);
      if (dateFin) where.dateCommande.lte = new Date(dateFin);
    }

    const [commandes, total] = await Promise.all([
      prisma.commande.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateCommande: "desc" },
        include: { lignes: { include: { produit: true, pack: true, offre: true } } },
      }),
      prisma.commande.count({ where }),
    ]);

    res.status(200).json({
      data: commandes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Erreur getAllCommandes:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get an order by ID
 * @route GET /api/admin/commandes/getCommandeById/:id
 * @access Private
 */
const getCommandeById = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: { lignes: { include: { produit: true, pack: true, offre: true } } },
    });

    if (!commande) return res.status(404).json({ message: "Commande introuvable." });
    res.status(200).json(commande);
  } catch (error) {
    console.error("Erreur getCommandeById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Create an order manually (admin) — calculates total + decrements stock
 * @route POST /api/admin/commandes/createCommande
 * @access Private
 */
const createCommande = async (req, res) => {
  const { nomClient, telephoneClient, adresseLivraison, lignes } = req.body;
  try {
    const now = new Date();

    // Collect all IDs to fetch in one shot
    const produitIds = lignes.filter((l) => l.produitId).map((l) => l.produitId);
    const packIds    = lignes.filter((l) => l.packId).map((l) => l.packId);
    const offreIds   = lignes.filter((l) => l.offreId).map((l) => l.offreId);

    const [produits, packs, offres] = await Promise.all([
      prisma.produit.findMany({ where: { id: { in: produitIds } } }),
      prisma.pack.findMany({ where: { id: { in: packIds } } }),
      prisma.offre.findMany({ where: { id: { in: offreIds } } }),
    ]);

    // Validate every line
    const errors = [];
    for (const ligne of lignes) {
      if (ligne.produitId) {
        const p = produits.find((x) => x.id === ligne.produitId);
        if (!p) { errors.push(`Produit ID ${ligne.produitId} introuvable.`); continue; }
        if (p.stock < ligne.quantite) errors.push(`Stock insuffisant pour "${p.nom}" (dispo: ${p.stock}).`);
      }
      if (ligne.packId) {
        const pk = packs.find((x) => x.id === ligne.packId);
        if (!pk) errors.push(`Pack ID ${ligne.packId} introuvable.`);
      }
      if (ligne.offreId) {
        const o = offres.find((x) => x.id === ligne.offreId);
        if (!o) { errors.push(`Offre ID ${ligne.offreId} introuvable.`); continue; }
        if (now < new Date(o.dateDebut) || now > new Date(o.dateFin))
          errors.push(`L'offre "${o.titre}" n'est pas active.`);
      }
    }
    if (errors.length > 0) return res.status(400).json({ message: "Données invalides.", erreurs: errors });

    // Build lines and calculate total
    let total = 0;
    const lignesData = lignes.map((ligne) => {
      let prixInitiale = 0;
      if (ligne.produitId) prixInitiale = produits.find((p) => p.id === ligne.produitId).prix;
      if (ligne.packId)    prixInitiale = packs.find((p) => p.id === ligne.packId).prixPack;

      let prixFinal = prixInitiale;
      if (ligne.offreId) {
        const offre = offres.find((o) => o.id === ligne.offreId);
        prixFinal = prixInitiale * (1 - offre.pourcentageReduction / 100);
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
          nomClient,
          telephoneClient,
          adresseLivraison,
          total,
          lignes: { create: lignesData },
        },
        include: { lignes: { include: { produit: true, pack: true, offre: true } } },
      });

      // Decrement stock for each product line
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

    res.status(201).json({ message: "Commande créée avec succès.", commande });
  } catch (error) {
    console.error("Erreur createCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update an order status
 * @route PATCH /api/admin/commandes/updateStatutCommande/:id/statut
 * @access Private
 */
const updateStatutCommande = async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  try {
    const exists = await prisma.commande.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Commande introuvable." });

    const commande = await prisma.commande.update({ where: { id }, data: { statut } });
    res.status(200).json({ message: "Statut mis à jour.", commande });
  } catch (error) {
    console.error("Erreur updateStatutCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Cancel an order
 * @route PATCH /api/admin/commandes/annulerCommande/:id/annuler
 * @access Private
 */
const annulerCommande = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({ where: { id } });
    if (!commande) return res.status(404).json({ message: "Commande introuvable." });
    if (commande.statut === "livree")
      return res.status(400).json({ message: "Impossible d'annuler une commande déjà livrée." });

    const updated = await prisma.commande.update({ where: { id }, data: { statut: "annulee" } });
    res.status(200).json({ message: "Commande annulée.", commande: updated });
  } catch (error) {
    console.error("Erreur annulerCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Recalculate and update an order total
 * @route GET /api/admin/commandes/calculerTotal/:id/total
 * @access Private
 */
const calculerTotal = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: { lignes: { include: { offre: true } } },
    });
    if (!commande) return res.status(404).json({ message: "Commande introuvable." });

    let total = 0;
    commande.lignes.forEach((ligne) => {
      let prix = ligne.prixInitiale;
      if (ligne.offre) prix *= 1 - ligne.offre.pourcentageReduction / 100;
      total += prix * ligne.quantite;
    });
    total = parseFloat(total.toFixed(2));

    await prisma.commande.update({ where: { id }, data: { total } });
    res.status(200).json({ commandeId: id, total });
  } catch (error) {
    console.error("Erreur calculerTotal:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getAllCommandes, getCommandeById, createCommande, updateStatutCommande, annulerCommande, calculerTotal };
