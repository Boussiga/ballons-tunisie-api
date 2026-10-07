const prisma = require("../config/prisma");

/**
 * @desc  Public product catalog — only in-stock items, hides exact stock count
 * @route GET /api/store/produits
 * @access Public
 */
const getAllProduitsPublic = async (req, res) => {
  try {
    let { search, categorieId, taille, page = 1, limit = 12 } = req.query;
    page  = parseInt(page, 10)  || 1;
    limit = parseInt(limit, 10) || 12;
    const skip = (page - 1) * limit;

    const where = { stock: { gt: 0 } }; // Only available products
    if (search)      where.OR = [{ nom: { contains: search } }, { description: { contains: search } }];
    if (categorieId) where.categorieId = parseInt(categorieId, 10);
    if (taille)      where.taille = taille;

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, nom: true, prix: true, taille: true, description: true, imageUrl: true, stock: true,
          categorie: { select: { id: true, nom: true } },
        },
      }),
      prisma.produit.count({ where }),
    ]);

    // Replace raw stock with availability label
    const data = produits.map(({ stock, ...p }) => ({
      ...p,
      disponibilite: stock === 0 ? "rupture" : stock < 5 ? "stock_faible" : "disponible",
    }));

    res.status(200).json({
      data,
      pagination: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Erreur getAllProduitsPublic:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get single product detail (public)
 * @route GET /api/store/produits/:id
 * @access Public
 */
const getProduitPublic = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "ID invalide." });

  try {
    const produit = await prisma.produit.findUnique({
      where: { id },
      select: {
        id: true, nom: true, prix: true, taille: true, description: true, imageUrl: true, stock: true,
        categorie: { select: { id: true, nom: true } },
      },
    });

    if (!produit) return res.status(404).json({ message: "Produit introuvable." });

    const { stock, ...rest } = produit;
    res.status(200).json({
      ...rest,
      disponibilite: stock === 0 ? "rupture" : stock < 5 ? "stock_faible" : "disponible",
    });
  } catch (error) {
    console.error("Erreur getProduitPublic:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getAllProduitsPublic, getProduitPublic };
