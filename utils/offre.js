// An offer is valid from dateDebut until dateFin (inclusive). Once dateFin is
// past it is simply ignored: never sent to the store, prices fall back to the
// initial ones. Nothing is deleted, the admin still sees it as expired.

const offreValideWhere = (now = new Date()) => ({
  dateDebut: { lte: now },
  dateFin:   { gte: now },
});

const estOffreValide = (offre, now = new Date()) =>
  now >= new Date(offre.dateDebut) && now <= new Date(offre.dateFin);

const appliquerReduction = (prix, pourcentage) =>
  Math.round(prix * (1 - pourcentage / 100) * 100) / 100;

// Prisma select for a product's offers, restricted to the valid ones
const offresValidesSelect = (now = new Date()) => ({
  where: offreValideWhere(now),
  select: { id: true, titre: true, pourcentageReduction: true, dateFin: true },
});

// Takes a product loaded with offresValidesSelect and replaces its offers with
// the best valid one: prix stays the initial price, prixFinal is what the
// client pays (equal to prix when there is no valid offer).
const avecOffreActive = ({ offres = [], ...produit }) => {
  const offre = offres.reduce(
    (best, o) => (!best || o.pourcentageReduction > best.pourcentageReduction ? o : best),
    null
  );
  return {
    ...produit,
    prixFinal: offre ? appliquerReduction(produit.prix, offre.pourcentageReduction) : produit.prix,
    offre,
  };
};

module.exports = {
  offreValideWhere,
  estOffreValide,
  appliquerReduction,
  offresValidesSelect,
  avecOffreActive,
};
