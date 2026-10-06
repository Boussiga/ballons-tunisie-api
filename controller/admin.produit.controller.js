const prisma = require("../config/prisma");

/**
 * @desc  Get all products — with Zod pagination
 * @route GET /api/admin/produits
 * @access Private
 */
const getAllProduits = async (req, res) => {
  try {
    // Ensure they are integers for Prisma
    let { categorieId, search, stockFaible, page = 1, limit = 10 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (categorieId) where.categorieId = parseInt(categorieId, 10);
    if (stockFaible === true) where.stock = { lt: 5 };
    if (search) {
      where.OR = [
        { nom: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.produit.count({ where }),
    ]);

    res.status(200).json({
      data: produits,
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
    console.error("Erreur getAllProduits:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get a product by ID
 * @route GET /api/admin/produits/:id
 * @access Private
 */
const getProduitById = async (req, res) => {
  const { id } = req.params; // already a Number thanks to Zod
  try {
    const produit = await prisma.produit.findUnique({
      where: { id },
      include: { packs: { include: { pack: true } } },
    });

    if (!produit) {
      return res.status(404).json({ message: "Produit introuvable." });
    }

    res.status(200).json(produit);
  } catch (error) {
    console.error("Erreur getProduitById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Create a product
 * @route POST /api/admin/produits
 * @access Private
 */
const createProduit = async (req, res) => {
  try {
    const { nom, categorieId, taille, prix, stock, description } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const produit = await prisma.produit.create({
      data: { nom, categorieId, taille, prix, stock, description, imageUrl },
    });

    res.status(201).json({ message: "Produit créé avec succès.", produit });
  } catch (error) {
    console.error("Erreur createProduit:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update a product
 * @route PUT /api/admin/produits/:id
 * @access Private
 */
const updateProduit = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.produit.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Produit introuvable." });
    }

    const data = { ...req.body };
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const produit = await prisma.produit.update({ where: { id }, data });
    res.status(200).json({ message: "Produit mis à jour.", produit });
  } catch (error) {
    console.error("Erreur updateProduit:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Delete a product
 * @route DELETE /api/admin/produits/:id
 * @access Private
 */
const deleteProduit = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.produit.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Produit introuvable." });
    }
    const nbLignes = await prisma.ligneCommande.count({ where: { produitId: id } });
    if (nbLignes > 0) {
      return res.status(409).json({
        message: "Ce produit est lié à des commandes et ne peut pas être supprimé. Mettez son stock à 0 à la place.",
    });
  }

    await prisma.produit.delete({ where: { id } });
    res.status(200).json({ message: "Produit supprimé avec succès." });
  } catch (error) {
    console.error("Erreur deleteProduit:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Check a product stock
 * @route GET /api/admin/produits/:id/stock
 * @access Private
 */
const verifierStock = async (req, res) => {
  const { id } = req.params;
  try {
    const produit = await prisma.produit.findUnique({
      where: { id },
      select: { id: true, nom: true, stock: true },
    });

    if (!produit) {
      return res.status(404).json({ message: "Produit introuvable." });
    }

    const statut =
      produit.stock === 0
        ? "rupture"
        : produit.stock < 5
        ? "stock_faible"
        : "disponible";

    res.status(200).json({ ...produit, statut });
  } catch (error) {
    console.error("Erreur verifierStock:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update a product stock
 * @route PATCH /api/admin/produits/:id/stock
 * @access Private
 */
const updateStock = async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  try {
    const produit = await prisma.produit.update({
      where: { id },
      data: { stock },
    });
    res.status(200).json({ message: "Stock mis à jour.", produit });
  } catch (error) {
    console.error("Erreur updateStock:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  getAllProduits,
  getProduitById,
  createProduit,
  updateProduit,
  deleteProduit,
  verifierStock,
  updateStock,
};
