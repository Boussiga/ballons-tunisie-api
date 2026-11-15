const prisma = require("../config/prisma");
const { deleteImage, supprimerEnvois } = require("../middelwhere/upload.middleware");
const { MAX_IMAGES, imagesSelect, imagesActuelles, synchroniserImages } = require("../utils/produitImages");

/**
 * @desc  Get all products: with Zod pagination
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
        include: { images: imagesSelect },
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
      include: { packs: { include: { pack: true } }, images: imagesSelect },
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
 * @desc  Create a product with up to 5 images (MAX_IMAGES) (multipart field "images", the first one is the main image)
 * @route POST /api/admin/produits
 * @access Private
 */
const createProduit = async (req, res) => {
  const files = req.files || [];
  try {
    const { nom, categorieId, taille, prix, stock, description } = req.body;

    const produit = await prisma.produit.create({
      data: {
        nom, categorieId, taille, prix, stock, description,
        imageUrl: files.length ? files[0].url : null,
        images: { create: files.map((f, ordre) => ({ url: f.url, ordre })) },
      },
      include: { images: imagesSelect },
    });

    res.status(201).json({ message: "Produit créé avec succès.", produit });
  } catch (error) {
    await supprimerEnvois(files); // DB failed: don't leave orphan images
    console.error("Erreur createProduit:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Update a product. Images sent in "images" are added to the gallery;
 *        an image sent in "image" replaces the main image.
 * @route PUT /api/admin/produits/:id
 * @access Private
 */
const updateProduit = async (req, res) => {
  const { id } = req.params;
  const files = req.files || [];
  try {
    const exists = await prisma.produit.findUnique({ where: { id } });
    if (!exists) {
      await supprimerEnvois(files);
      return res.status(404).json({ message: "Produit introuvable." });
    }

    let remplacee = null;
    const produit = await prisma.$transaction(async (tx) => {
      const images = await imagesActuelles(tx, exists);
      if (req.imagePrincipale && images.length) remplacee = images[0];
      const total = images.length - (remplacee ? 1 : 0) + files.length;
      if (total > MAX_IMAGES) {
        throw Object.assign(new Error(), { status: 400 });
      }

      await tx.produit.update({ where: { id }, data: { ...req.body } });
      if (remplacee) await tx.produitImage.delete({ where: { id: remplacee.id } });
      if (files.length) {
        // The replacing image goes first, the added ones after the current images
        const debut = req.imagePrincipale ? -1 : images.length;
        await tx.produitImage.createMany({
          data: files.map((f, i) => ({ produitId: id, url: f.url, ordre: debut + i })),
        });
        return synchroniserImages(tx, id);
      }
      return tx.produit.findUnique({ where: { id }, include: { images: imagesSelect } });
    });

    if (remplacee) await deleteImage(remplacee.url);
    res.status(200).json({ message: "Produit mis à jour.", produit });
  } catch (error) {
    await supprimerEnvois(files);
    if (error.status === 400) {
      return res.status(400).json({ message: `Un produit ne peut pas avoir plus de ${MAX_IMAGES} images. Supprimez-en avant d'en ajouter.` });
    }
    console.error("Erreur updateProduit:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Remove one image from a product gallery
 * @route DELETE /api/admin/produits/deleteImage/:id/images/:imageId
 * @access Private
 */
const supprimerImage = async (req, res) => {
  const { id, imageId } = req.params;
  try {
    const image = await prisma.produitImage.findFirst({ where: { id: imageId, produitId: id } });
    if (!image) return res.status(404).json({ message: "Image introuvable pour ce produit." });

    const produit = await prisma.$transaction(async (tx) => {
      await tx.produitImage.delete({ where: { id: imageId } });
      return synchroniserImages(tx, id);
    });
    await deleteImage(image.url);
    res.status(200).json({ message: "Image supprimée.", produit });
  } catch (error) {
    console.error("Erreur supprimerImage:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Make one image the main image (shown first in the store)
 * @route PATCH /api/admin/produits/setImagePrincipale/:id/images/:imageId
 * @access Private
 */
const definirImagePrincipale = async (req, res) => {
  const { id, imageId } = req.params;
  try {
    const image = await prisma.produitImage.findFirst({ where: { id: imageId, produitId: id } });
    if (!image) return res.status(404).json({ message: "Image introuvable pour ce produit." });

    const produit = await prisma.$transaction(async (tx) => {
      await tx.produitImage.update({ where: { id: imageId }, data: { ordre: -1 } });
      return synchroniserImages(tx, id);
    });
    res.status(200).json({ message: "Image principale mise à jour.", produit });
  } catch (error) {
    console.error("Erreur definirImagePrincipale:", error);
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
    const exists = await prisma.produit.findUnique({ where: { id }, include: { images: { select: { url: true } } } });
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
    const urls = new Set([exists.imageUrl, ...exists.images.map((i) => i.url)].filter(Boolean));
    await Promise.all([...urls].map(deleteImage));
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
  supprimerImage,
  definirImagePrincipale,
  deleteProduit,
  verifierStock,
  updateStock,
};
