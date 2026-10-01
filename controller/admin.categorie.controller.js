const prisma = require("../config/prisma");

/**
 * @desc  Get all categories
 * @route GET /api/admin/categories
 * @access Private
 */
const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.categorie.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ data: categories });
  } catch (error) {
    console.error("Erreur getAllCategories:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Get category by ID
 * @route GET /api/admin/categories/:id
 * @access Private
 */
const getCategorieById = async (req, res) => {
  const { id } = req.params;
  try {
    const categorie = await prisma.categorie.findUnique({
      where: { id: Number(id) },
    });

    if (!categorie) {
      return res.status(404).json({ message: "Catégorie introuvable." });
    }

    res.status(200).json(categorie);
  } catch (error) {
    console.error("Erreur getCategorieById:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Create a category
 * @route POST /api/admin/categories
 * @access Private
 */
const createCategorie = async (req, res) => {
  try {
    const { nom, description } = req.body;

    const exist = await prisma.categorie.findUnique({ where: { nom } });
    if (exist) {
      return res.status(400).json({ message: "Cette catégorie existe déjà." });
    }

    const categorie = await prisma.categorie.create({
      data: { nom, description },
    });

    res.status(201).json({ message: "Catégorie créée avec succès.", categorie });
  } catch (error) {
    console.error("Erreur createCategorie:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update a category
 * @route PUT /api/admin/categories/:id
 * @access Private
 */
const updateCategorie = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.categorie.findUnique({ where: { id: Number(id) } });
    if (!exists) {
      return res.status(404).json({ message: "Catégorie introuvable." });
    }

    const { nom, description } = req.body;
    if (nom && nom !== exists.nom) {
      const nameTaken = await prisma.categorie.findUnique({ where: { nom } });
      if (nameTaken) {
        return res.status(400).json({ message: "Le nom de cette catégorie est déjà utilisé." });
      }
    }

    const categorie = await prisma.categorie.update({
      where: { id: Number(id) },
      data: { nom, description },
    });

    res.status(200).json({ message: "Catégorie mise à jour.", categorie });
  } catch (error) {
    console.error("Erreur updateCategorie:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Delete a category
 * @route DELETE /api/admin/categories/:id
 * @access Private
 */
const deleteCategorie = async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await prisma.categorie.findUnique({ where: { id: Number(id) } });
    if (!exists) {
      return res.status(404).json({ message: "Catégorie introuvable." });
    }

    await prisma.categorie.delete({ where: { id: Number(id) } });
    res.status(200).json({ message: "Catégorie supprimée avec succès." });
  } catch (error) {
    console.error("Erreur deleteCategorie:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  getAllCategories,
  getCategorieById,
  createCategorie,
  updateCategorie,
  deleteCategorie,
};
