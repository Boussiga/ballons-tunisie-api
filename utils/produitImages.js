// Product gallery rules, shared by the admin controller and the seed.

const MAX_IMAGES = 5;

// Prisma select for a product's images, main image (ordre 0) first
const imagesSelect = {
  orderBy: [{ ordre: "asc" }, { id: "asc" }],
  select: { id: true, url: true, ordre: true },
};

/**
 * Current images of a product, inside a transaction. A product created before the
 * gallery existed only has imageUrl: it is turned into the first gallery image.
 */
const imagesActuelles = async (tx, produit) => {
  const images = await tx.produitImage.findMany({ where: { produitId: produit.id }, ...imagesSelect });
  if (images.length === 0 && produit.imageUrl) {
    return [await tx.produitImage.create({ data: { produitId: produit.id, url: produit.imageUrl, ordre: 0 }, select: imagesSelect.select })];
  }
  return images;
};

/**
 * Renumbers the images 0..n-1 (keeping their order) and copies the first one into
 * produit.imageUrl. Returns the product with its images.
 */
const synchroniserImages = async (tx, produitId) => {
  const images = await tx.produitImage.findMany({ where: { produitId }, ...imagesSelect });
  for (let i = 0; i < images.length; i++) {
    if (images[i].ordre !== i) await tx.produitImage.update({ where: { id: images[i].id }, data: { ordre: i } });
  }
  return tx.produit.update({
    where: { id: produitId },
    data: { imageUrl: images.length ? images[0].url : null },
    include: { images: imagesSelect },
  });
};

module.exports = { MAX_IMAGES, imagesSelect, imagesActuelles, synchroniserImages };
