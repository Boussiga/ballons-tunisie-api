const prisma = require("../config/prisma");

/**
 * @desc  Get all orders — pagination + filters
 * @route GET /api/admin/commandes
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
        include: {
          lignes: { include: { produit: true, pack: true, offre: true } },
        },
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
 * @route GET /api/admin/commandes/:id
 * @access Private
 */
const getCommandeById = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: {
        lignes: { include: { produit: true, pack: true, offre: true } },
      },
    });

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable." });
    }

    res.status(200).json(commande);
  } catch (error) {
    console.error("Erreur getCommandeById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update an order status
 * @route PATCH /api/admin/commandes/:id/statut
 * @access Private
 */
const updateStatutCommande = async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  try {
    const exists = await prisma.commande.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Commande introuvable." });
    }

    const commande = await prisma.commande.update({
      where: { id },
      data: { statut },
    });
    res.status(200).json({ message: "Statut mis à jour.", commande });
  } catch (error) {
    console.error("Erreur updateStatutCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Cancel an order
 * @route PATCH /api/admin/commandes/:id/annuler
 * @access Private
 */
const annulerCommande = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({ where: { id } });
    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable." });
    }

    if (commande.statut === "livree") {
      return res
        .status(400)
        .json({ message: "Impossible d'annuler une commande déjà livrée." });
    }

    const updated = await prisma.commande.update({
      where: { id },
      data: { statut: "annulee" },
    });
    res.status(200).json({ message: "Commande annulée.", commande: updated });
  } catch (error) {
    console.error("Erreur annulerCommande:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Calculate and update an order total
 * @route GET /api/admin/commandes/:id/total
 * @access Private
 */
const calculerTotal = async (req, res) => {
  const { id } = req.params;
  try {
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: {
        lignes: { include: { produit: true, pack: true, offre: true } },
      },
    });

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable." });
    }

    let total = 0;
    commande.lignes.forEach((ligne) => {
      let prixBase = ligne.prixInitiale;
      if (ligne.offre) {
        prixBase = prixBase * (1 - ligne.offre.pourcentageReduction / 100);
      }
      total += prixBase * ligne.quantite;
    });

    total = parseFloat(total.toFixed(2));

    await prisma.commande.update({ where: { id }, data: { total } });

    res.status(200).json({ commandeId: id, total });
  } catch (error) {
    console.error("Erreur calculerTotal:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  getAllCommandes,
  getCommandeById,
  updateStatutCommande,
  annulerCommande,
  calculerTotal,
};
