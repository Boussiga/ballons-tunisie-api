const prisma = require("../config/prisma");
const { estOffreValide } = require("../utils/offre");

const produitsSelect = {
  select: { id: true, nom: true, prix: true, imageUrl: true, taille: true },
};

// Returns the IDs from the list that do not match an existing product
const produitsManquants = async (produitIds) => {
  const existants = await prisma.produit.findMany({
    where: { id: { in: produitIds } },
    select: { id: true },
  });
  return produitIds.filter((id) => !existants.find((p) => p.id === id));
};

/**
 * @desc  Get all offers — with pagination
 * @route GET /api/admin/offres
 * @access Private
 */
const getAllOffres = async (req, res) => {
  try {
    let { search, active, produitId, page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {};
    if (search) where.titre = { contains: search };
    if (produitId) where.produits = { some: { id: parseInt(produitId, 10) } };
    // Express 5 keeps req.query read-only, so the validated boolean never
    // replaces it: active arrives as the string "true" / "false".
    const isActive = active === true || active === "true";
    const isInactive = active === false || active === "false";
    if (isActive) {
      where.dateDebut = { lte: now };
      where.dateFin = { gte: now };
    } else if (isInactive) {
      where.OR = [{ dateFin: { lt: now } }, { dateDebut: { gt: now } }];
    }

    const [offres, total] = await Promise.all([
      prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateDebut: "desc" },
        include: { produits: produitsSelect },
      }),
      prisma.offre.count({ where }),
    ]);

    const offresAvecStatut = offres.map((o) => ({
      ...o,
      estValide: estOffreValide(o, now),
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
    const offre = await prisma.offre.findUnique({
      where: { id },
      include: { produits: produitsSelect },
    });

    if (!offre) {
      return res.status(404).json({ message: "Offre introuvable." });
    }

    const now = new Date();
    res.status(200).json({
      ...offre,
      estValide: estOffreValide(offre, now),
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
  const { titre, pourcentageReduction, dateDebut, dateFin, produitIds } = req.body;
  try {
    const missingIds = await produitsManquants(produitIds);
    if (missingIds.length > 0) {
      return res.status(404).json({
        message: `Produit(s) introuvable(s) : ID ${missingIds.join(", ")}`,
      });
    }

    const offre = await prisma.offre.create({
      data: {
        titre,
        pourcentageReduction,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        produits: { connect: produitIds.map((id) => ({ id })) },
      },
      include: { produits: produitsSelect },
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

    const { produitIds, ...data } = req.body;
    if (data.dateDebut) data.dateDebut = new Date(data.dateDebut);
    if (data.dateFin) data.dateFin = new Date(data.dateFin);

    // Only one date sent: compare it with the stored one
    if ((data.dateDebut ?? exists.dateDebut) >= (data.dateFin ?? exists.dateFin)) {
      return res.status(400).json({
        message: "La date de début doit être antérieure à la date de fin.",
      });
    }

    if (produitIds) {
      const missingIds = await produitsManquants(produitIds);
      if (missingIds.length > 0) {
        return res.status(404).json({
          message: `Produit(s) introuvable(s) : ID ${missingIds.join(", ")}`,
        });
      }
      // Replace the targeted products with the new selection
      data.produits = { set: produitIds.map((pid) => ({ id: pid })) };
    }

    const offre = await prisma.offre.update({
      where: { id },
      data,
      include: { produits: produitsSelect },
    });
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