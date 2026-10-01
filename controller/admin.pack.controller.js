const prisma = require("../config/prisma");

/**
 * @desc  Get all packs — with pagination
 * @route GET /api/admin/packs
 * @access Private
 */
const getAllPacks = async (req, res) => {
  try {
    let { search, page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { nom: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [packs, total] = await Promise.all([
      prisma.pack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produits: { include: { produit: true } },
        },
      }),
      prisma.pack.count({ where }),
    ]);

    res.status(200).json({
      data: packs,
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
    console.error("Erreur getAllPacks:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get a pack by ID
 * @route GET /api/admin/packs/:id
 * @access Private
 */
const getPackById = async (req, res) => {
  const { id } = req.params;
  try {
    const pack = await prisma.pack.findUnique({
      where: { id },
      include: { produits: { include: { produit: true } } },
    });

    if (!pack) {
      return res.status(404).json({ message: "Pack introuvable." });
    }

    res.status(200).json(pack);
  } catch (error) {
    console.error("Erreur getPackById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Create a pack with automatic price calculation
 * @route POST /api/admin/packs
 * @access Private
 */
const createPack = async (req, res) => {
  const { nom, description, produits } = req.body;

  try {
    const produitIds = produits.map((p) => p.produitId);
    const produitsDB = await prisma.produit.findMany({
      where: { id: { in: produitIds } },
    });

    // Check if all products exist
    const missingIds = produitIds.filter(
      (id) => !produitsDB.find((p) => p.id === id)
    );
    if (missingIds.length > 0) {
      return res.status(404).json({
        message: `Produit(s) introuvable(s) : ID ${missingIds.join(", ")}`,
      });
    }

    // Calculate pack price
    let prixPack = 0;
    produits.forEach((item) => {
      const produit = produitsDB.find((p) => p.id === item.produitId);
      prixPack += produit.prix * item.quantite;
    });

    const pack = await prisma.pack.create({
      data: {
        nom,
        description: description || null,
        prixPack,
        produits: {
          create: produits.map((p) => ({
            produitId: p.produitId,
            quantite: p.quantite,
          })),
        },
      },
      include: { produits: { include: { produit: true } } },
    });

    res.status(201).json({ message: "Pack créé avec succès.", pack });
  } catch (error) {
    console.error("Erreur createPack:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update a pack
 * @route PUT /api/admin/packs/:id
 * @access Private
 */
const updatePack = async (req, res) => {
  const { id } = req.params;
  const { nom, description, produits } = req.body;

  try {
    const exists = await prisma.pack.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Pack introuvable." });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (description !== undefined) data.description = description;

    if (produits && produits.length > 0) {
      const produitIds = produits.map((p) => p.produitId);
      const produitsDB = await prisma.produit.findMany({
        where: { id: { in: produitIds } },
      });

      const missingIds = produitIds.filter(
        (pid) => !produitsDB.find((p) => p.id === pid)
      );
      if (missingIds.length > 0) {
        return res.status(404).json({
          message: `Produit(s) introuvable(s) : ID ${missingIds.join(", ")}`,
        });
      }

      let prixPack = 0;
      produits.forEach((item) => {
        const produit = produitsDB.find((p) => p.id === item.produitId);
        prixPack += produit.prix * item.quantite;
      });

      data.prixPack = prixPack;
      await prisma.packProduit.deleteMany({ where: { packId: id } });
      data.produits = {
        create: produits.map((p) => ({
          produitId: p.produitId,
          quantite: p.quantite,
        })),
      };
    }

    const pack = await prisma.pack.update({
      where: { id },
      data,
      include: { produits: { include: { produit: true } } },
    });

    res.status(200).json({ message: "Pack mis à jour.", pack });
  } catch (error) {
    console.error("Erreur updatePack:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Delete a pack
 * @route DELETE /api/admin/packs/:id
 * @access Private
 */
const deletePack = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.pack.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Pack introuvable." });
    }

    await prisma.pack.delete({ where: { id } });
    res.status(200).json({ message: "Pack supprimé avec succès." });
  } catch (error) {
    console.error("Erreur deletePack:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getAllPacks, getPackById, createPack, updatePack, deletePack };
