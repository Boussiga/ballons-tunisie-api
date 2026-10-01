const prisma = require("../config/prisma");

/**
 * @desc  Get all offers — with pagination
 * @route GET /api/admin/offres
 * @access Private
 */
const getAllOffres = async (req, res) => {
  try {
    let { search, active, page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {};
    if (search) where.titre = { contains: search };
    if (active === true) {
      where.dateDebut = { lte: now };
      where.dateFin = { gte: now };
    } else if (active === false) {
      where.OR = [{ dateFin: { lt: now } }, { dateDebut: { gt: now } }];
    }

    const [offres, total] = await Promise.all([
      prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateDebut: "desc" },
      }),
      prisma.offre.count({ where }),
    ]);

    const offresAvecStatut = offres.map((o) => ({
      ...o,
      estValide: now >= new Date(o.dateDebut) && now <= new Date(o.dateFin),
    }));

    res.status(200).json({
      data: offresAvecStatut,
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
    console.error("Erreur getAllOffres:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get an offer by ID
 * @route GET /api/admin/offres/:id
 * @access Private
 */
const getOffreById = async (req, res) => {
  const { id } = req.params;
  try {
    const offre = await prisma.offre.findUnique({ where: { id } });

    if (!offre) {
      return res.status(404).json({ message: "Offre introuvable." });
    }

    const now = new Date();
    res.status(200).json({
      ...offre,
      estValide: now >= new Date(offre.dateDebut) && now <= new Date(offre.dateFin),
    });
  } catch (error) {
    console.error("Erreur getOffreById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Create an offer
 * @route POST /api/admin/offres
 * @access Private
 */
const createOffre = async (req, res) => {
  const { titre, pourcentageReduction, dateDebut, dateFin } = req.body;
  try {
    const offre = await prisma.offre.create({
      data: {
        titre,
        pourcentageReduction,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
      },
    });
    res.status(201).json({ message: "Offre créée avec succès.", offre });
  } catch (error) {
    console.error("Erreur createOffre:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update an offer
 * @route PUT /api/admin/offres/:id
 * @access Private
 */
const updateOffre = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.offre.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Offre introuvable." });
    }

    const data = { ...req.body };
    if (data.dateDebut) data.dateDebut = new Date(data.dateDebut);
    if (data.dateFin) data.dateFin = new Date(data.dateFin);

    const offre = await prisma.offre.update({ where: { id }, data });
    res.status(200).json({ message: "Offre mise à jour.", offre });
  } catch (error) {
    console.error("Erreur updateOffre:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Delete an offer
 * @route DELETE /api/admin/offres/:id
 * @access Private
 */
const deleteOffre = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.offre.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Offre introuvable." });
    }

    await prisma.offre.delete({ where: { id } });
    res.status(200).json({ message: "Offre supprimée avec succès." });
  } catch (error) {
    console.error("Erreur deleteOffre:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  getAllOffres,
  getOffreById,
  createOffre,
  updateOffre,
  deleteOffre,
};
