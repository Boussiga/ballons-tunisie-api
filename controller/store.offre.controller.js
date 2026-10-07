const prisma = require("../config/prisma");

/**
 * @desc  Get currently active offers only
 * @route GET /api/store/offres
 * @access Public
 */
const getOffresActives = async (req, res) => {
  try {
    const now = new Date();

    const offres = await prisma.offre.findMany({
      where: {
        dateDebut: { lte: now },
        dateFin:   { gte: now },
      },
      orderBy: { dateFin: "asc" }, // Soonest to expire first
    });

    const data = offres.map((o) => {
      const msLeft = new Date(o.dateFin) - now;
      const joursRestants = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      return { ...o, joursRestants };
    });

    res.status(200).json({ data });
  } catch (error) {
    console.error("Erreur getOffresActives:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getOffresActives };
