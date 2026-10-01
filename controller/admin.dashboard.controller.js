const prisma = require("../config/prisma");

/**
 * @desc  Dashboard - global statistics
 * @route GET /api/admin/dashboard
 * @access Private
 */
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProduits,
      produitsEnRupture,
      totalPacks,
      totalOffres,
      offresActives,
      totalCommandes,
      commandesEnAttente,
      commandesCeMois,
      chiffreAffairesMois,
      stockFaible,
    ] = await Promise.all([
      prisma.produit.count(),
      prisma.produit.count({ where: { stock: 0 } }),
      prisma.pack.count(),
      prisma.offre.count(),
      prisma.offre.count({
        where: {
          dateDebut: { lte: now },
          dateFin: { gte: now },
        },
      }),
      prisma.commande.count(),
      prisma.commande.count({ where: { statut: "en_attente" } }),
      prisma.commande.count({
        where: { dateCommande: { gte: debutMois } },
      }),
      prisma.commande.aggregate({
        _sum: { total: true },
        where: {
          dateCommande: { gte: debutMois },
          statut: { not: "annulee" },
        },
      }),
      prisma.produit.findMany({
        where: { stock: { gt: 0, lt: 5 } },
        select: { id: true, nom: true, stock: true },
      }),
    ]);

    res.status(200).json({
      produits: {
        total: totalProduits,
        enRupture: produitsEnRupture,
        stockFaible,
      },
      packs: { total: totalPacks },
      offres: { total: totalOffres, actives: offresActives },
      commandes: {
        total: totalCommandes,
        enAttente: commandesEnAttente,
        ceMois: commandesCeMois,
      },
      chiffreAffairesMois: chiffreAffairesMois._sum.total || 0,
    });
  } catch (error) {
    console.error("Erreur getDashboard:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Sales statistics by period
 * @route GET /api/admin/dashboard/ventes
 * @access Private
 */
const getStatistiquesVentes = async (req, res) => {
  try {
    const { periode = "mois" } = req.query; // month | week | year
    const now = new Date();
    let dateDebut;

    if (periode === "semaine") {
      dateDebut = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periode === "annee") {
      dateDebut = new Date(now.getFullYear(), 0, 1);
    } else {
      dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const commandes = await prisma.commande.findMany({
      where: {
        dateCommande: { gte: dateDebut },
        statut: { not: "annulee" },
      },
      select: {
        id: true,
        dateCommande: true,
        total: true,
        statut: true,
      },
      orderBy: { dateCommande: "asc" },
    });

    const totalCA = commandes.reduce((sum, c) => sum + c.total, 0);
    const totalCommandes = commandes.length;

    res.status(200).json({
      periode,
      dateDebut,
      totalCommandes,
      chiffreAffaires: parseFloat(totalCA.toFixed(2)),
      commandes,
    });
  } catch (error) {
    console.error("Erreur getStatistiquesVentes:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getDashboard, getStatistiquesVentes };
