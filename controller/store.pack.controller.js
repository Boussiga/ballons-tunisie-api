const prisma = require("../config/prisma");

/**
 * @desc  Public packs list
 * @route GET /api/store/packs
 * @access Public
 */
const getAllPacksPublic = async (req, res) => {
  try {
    let { search, page = 1, limit = 12 } = req.query;
    page  = parseInt(page, 10)  || 1;
    limit = parseInt(limit, 10) || 12;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) where.OR = [{ nom: { contains: search } }, { description: { contains: search } }];

    const [packs, total] = await Promise.all([
      prisma.pack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produits: {
            include: {
              produit: { select: { id: true, nom: true, prix: true, imageUrl: true, taille: true } },
            },
          },
        },
      }),
      prisma.pack.count({ where }),
    ]);

    res.status(200).json({
      data: packs,
      pagination: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Erreur getAllPacksPublic:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get single pack detail (public)
 * @route GET /api/store/packs/:id
 * @access Public
 */
const getPackPublic = async (req, res) => {
  const { id } = req.params;
  try {
    const pack = await prisma.pack.findUnique({
      where: { id },
      include: {
        produits: {
          include: {
            produit: { select: { id: true, nom: true, prix: true, imageUrl: true, taille: true } },
          },
        },
      },
    });

    if (!pack) return res.status(404).json({ message: "Pack introuvable." });
    res.status(200).json(pack);
  } catch (error) {
    console.error("Erreur getPackPublic:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getAllPacksPublic, getPackPublic };
