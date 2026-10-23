// An offer only discounts the products the admin selected: with a 10 % offer,
// a selected product costs 90 % of its price and the other products keep theirs.

jest.mock("../../../config/prisma", () => ({
  produit: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  pack: { findMany: jest.fn() },
  offre: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { createOffre, updateOffre } = require("../../../controller/admin.offre.controller");
const { getAllProduitsPublic, getProduitPublic } = require("../../../controller/store.produit.controller");
const { getOffresActives } = require("../../../controller/store.offre.controller");
const { passerCommande } = require("../../../controller/store.commande.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

const OFFRE_ID = "22222222-2222-4222-8222-222222222222";
const OFFRE_10 = { id: OFFRE_ID, titre: "Promo -10", pourcentageReduction: 10, dateFin: new Date(Date.now() + 86400000) };

// Catalogue: the admin selects products 1 and 2, not 3
const BALLON_A = { id: 1, nom: "Ballon A", prix: 50, stock: 20 };
const BALLON_B = { id: 2, nom: "Ballon B", prix: 89.9, stock: 20 };
const BALLON_C = { id: 3, nom: "Ballon C", prix: 40, stock: 20 };
const SELECTION = [1, 2];

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

describe("admin: the offer is linked to the selected products only", () => {
  const body = {
    titre: "Promo -10",
    pourcentageReduction: 10,
    dateDebut: "2026-10-01T00:00:00Z",
    dateFin: "2026-12-31T00:00:00Z",
    produitIds: SELECTION,
  };

  it("connects exactly the selected products on creation", async () => {
    prisma.produit.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.offre.create.mockResolvedValue({ id: OFFRE_ID });
    const res = mockResponse();

    await createOffre(mockRequest({ body }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.offre.create.mock.calls[0][0].data).toMatchObject({
      pourcentageReduction: 10,
      produits: { connect: [{ id: 1 }, { id: 2 }] },
    });
  });

  it("refuses a selection containing an unknown product", async () => {
    prisma.produit.findMany.mockResolvedValue([{ id: 1 }]);
    const res = mockResponse();

    await createOffre(mockRequest({ body: { ...body, produitIds: [1, 99] } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain("99");
    expect(prisma.offre.create).not.toHaveBeenCalled();
  });

  it("replaces the selection on update", async () => {
    prisma.offre.findUnique.mockResolvedValue({ id: OFFRE_ID, dateDebut: new Date(2026, 9, 1), dateFin: new Date(2026, 11, 31) });
    prisma.produit.findMany.mockResolvedValue([{ id: 3 }]);
    prisma.offre.update.mockResolvedValue({ id: OFFRE_ID });
    const res = mockResponse();

    await updateOffre(mockRequest({ params: { id: OFFRE_ID }, body: { produitIds: [3] } }), res);

    expect(prisma.offre.update.mock.calls[0][0].data.produits).toEqual({ set: [{ id: 3 }] });
  });
});

describe("store: a 10 % offer lowers the price of the selected products by 10 %", () => {
  // Prisma returns, for each product, only the valid offers linked to it
  const avecOffres = (p) => ({ ...p, offres: SELECTION.includes(p.id) ? [OFFRE_10] : [] });

  it("catalogue: prixFinal = prix × 0.9 for selected products, unchanged for the others", async () => {
    prisma.produit.findMany.mockResolvedValue([BALLON_A, BALLON_B, BALLON_C].map(avecOffres));
    prisma.produit.count.mockResolvedValue(3);
    const res = mockResponse();

    await getAllProduitsPublic(mockRequest(), res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.map(({ id, prix, prixFinal }) => ({ id, prix, prixFinal }))).toEqual([
      { id: 1, prix: 50, prixFinal: 45 },
      { id: 2, prix: 89.9, prixFinal: 80.91 },
      { id: 3, prix: 40, prixFinal: 40 },
    ]);
    expect(data[0].offre).toMatchObject({ id: OFFRE_ID, pourcentageReduction: 10 });
    expect(data[2].offre).toBeNull();
  });

  it("product page: same reduced price", async () => {
    prisma.produit.findUnique.mockResolvedValue(avecOffres(BALLON_A));
    const res = mockResponse();

    await getProduitPublic(mockRequest({ params: { id: "1" } }), res);

    expect(res.json.mock.calls[0][0]).toMatchObject({ prix: 50, prixFinal: 45 });
  });

  it("offers page: lists the selected products with their reduced price", async () => {
    prisma.offre.findMany.mockResolvedValue([{ ...OFFRE_10, produits: [BALLON_A, BALLON_B] }]);
    const res = mockResponse();

    await getOffresActives(mockRequest(), res);

    const [offre] = res.json.mock.calls[0][0].data;
    expect(offre.produits.map((p) => [p.id, p.prixFinal])).toEqual([[1, 45], [2, 80.91]]);
  });
});

describe("order: the 10 % is charged only on the selected products", () => {
  const client = { nomClient: "Ali", telephoneClient: "98123456", adresseLivraison: "12 rue de Sfax" };
  const tx = { commande: { create: jest.fn() }, produit: { update: jest.fn() } };

  beforeEach(() => {
    prisma.produit.findMany.mockResolvedValue([BALLON_A, BALLON_C]);
    prisma.pack.findMany.mockResolvedValue([]);
    prisma.offre.findMany.mockResolvedValue([{ ...OFFRE_10, produits: SELECTION.map((id) => ({ id })) }]);
    prisma.$transaction.mockImplementation((fn) => fn(tx));
    tx.commande.create.mockImplementation(({ data }) => Promise.resolve({ id: "c1", ...data }));
  });

  it("charges 90 % of the price of a selected product", async () => {
    const res = mockResponse();

    await passerCommande(
      mockRequest({
        body: {
          ...client,
          lignes: [
            { produitId: 1, offreId: OFFRE_ID, quantite: 2 }, // 2 × 45
            { produitId: 3, quantite: 1 }, // 40, not selected
          ],
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const { data } = tx.commande.create.mock.calls[0][0];
    expect(data.total).toBe(140); // 90 + 40 + 10 delivery
    expect(data.lignes.create[0]).toMatchObject({ produitId: 1, prixInitiale: 50, offreId: OFFRE_ID });
    expect(data.lignes.create[1]).not.toHaveProperty("offreId");
  });

  it("refuses the offer on a product the admin did not select", async () => {
    const res = mockResponse();

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 3, offreId: OFFRE_ID, quantite: 1 }] } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].erreurs).toEqual(['L\'offre "Promo -10" ne s\'applique pas à cet article.']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
