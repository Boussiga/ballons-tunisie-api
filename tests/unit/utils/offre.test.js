const {
  offreValideWhere,
  estOffreValide,
  appliquerReduction,
  offresValidesSelect,
  avecOffreActive,
} = require("../../../utils/offre");

const NOW = new Date("2026-06-15T12:00:00Z");

describe("offreValideWhere", () => {
  it("filters offers that started and are not yet finished", () => {
    expect(offreValideWhere(NOW)).toEqual({
      dateDebut: { lte: NOW },
      dateFin: { gte: NOW },
    });
  });
});

describe("estOffreValide", () => {
  const offre = { dateDebut: "2026-06-01T00:00:00Z", dateFin: "2026-06-30T23:59:59Z" };

  it("is true inside the period", () => {
    expect(estOffreValide(offre, NOW)).toBe(true);
  });

  it("is inclusive on both bounds", () => {
    expect(estOffreValide(offre, new Date(offre.dateDebut))).toBe(true);
    expect(estOffreValide(offre, new Date(offre.dateFin))).toBe(true);
  });

  it("is false before the start and after the end", () => {
    expect(estOffreValide(offre, new Date("2026-05-31T23:59:59Z"))).toBe(false);
    expect(estOffreValide(offre, new Date("2026-07-01T00:00:00Z"))).toBe(false);
  });
});

describe("appliquerReduction", () => {
  it("applies the percentage", () => {
    expect(appliquerReduction(100, 20)).toBe(80);
  });

  it("rounds to 2 decimals", () => {
    expect(appliquerReduction(49.99, 15)).toBe(42.49);
    expect(appliquerReduction(10, 33.333)).toBe(6.67);
  });

  it("handles 0 % and 100 %", () => {
    expect(appliquerReduction(75, 0)).toBe(75);
    expect(appliquerReduction(75, 100)).toBe(0);
  });
});

describe("offresValidesSelect", () => {
  it("restricts to valid offers and selects only the public fields", () => {
    expect(offresValidesSelect(NOW)).toEqual({
      where: offreValideWhere(NOW),
      select: { id: true, titre: true, pourcentageReduction: true, dateFin: true },
    });
  });
});

describe("avecOffreActive", () => {
  it("keeps the initial price when there is no offer", () => {
    expect(avecOffreActive({ id: 1, prix: 50, offres: [] })).toEqual({
      id: 1,
      prix: 50,
      prixFinal: 50,
      offre: null,
    });
  });

  it("works when offres is missing", () => {
    expect(avecOffreActive({ id: 1, prix: 50 })).toMatchObject({ prixFinal: 50, offre: null });
  });

  it("picks the best offer and computes prixFinal", () => {
    const petite = { id: "a", pourcentageReduction: 10 };
    const grande = { id: "b", pourcentageReduction: 30 };
    const result = avecOffreActive({ id: 1, prix: 80, offres: [petite, grande] });

    expect(result.offre).toBe(grande);
    expect(result.prix).toBe(80);
    expect(result.prixFinal).toBe(56);
    expect(result).not.toHaveProperty("offres");
  });

  it("keeps the first offer on a tie", () => {
    const a = { id: "a", pourcentageReduction: 20 };
    const b = { id: "b", pourcentageReduction: 20 };
    expect(avecOffreActive({ prix: 10, offres: [a, b] }).offre).toBe(a);
  });
});
