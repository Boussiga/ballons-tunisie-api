jest.mock("../../../config/prisma", () => ({
  produit: { findMany: jest.fn() },
  pack: { findMany: jest.fn() },
  offre: { findMany: jest.fn() },
  commande: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { passerCommande, suiviCommande } = require("../../../controller/store.commande.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

const PACK_ID = "11111111-1111-4111-8111-111111111111";
const OFFRE_ID = "22222222-2222-4222-8222-222222222222";

const client = { nomClient: "Ali", telephoneClient: "98123456", adresseLivraison: "12 rue de Sfax" };

// Fake transaction client: records created orders and stock updates
const tx = { commande: { create: jest.fn() }, produit: { update: jest.fn() } };

const setCatalogue = ({ produits = [], packs = [], offres = [] }) => {
  prisma.produit.findMany.mockResolvedValue(produits);
  prisma.pack.findMany.mockResolvedValue(packs);
  prisma.offre.findMany.mockResolvedValue(offres);
};

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

beforeEach(() => {
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  tx.commande.create.mockImplementation(({ data }) => Promise.resolve({ id: "cmd-1", ...data }));
});

describe("passerCommande", () => {
  it("returns 400 for an unknown product or pack", async () => {
    setCatalogue({});
    const res = mockResponse();

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 5, quantite: 1 }, { packId: PACK_ID, quantite: 1 }] } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].erreurs).toEqual([
      "Produit ID 5 introuvable.",
      `Pack ID ${PACK_ID} introuvable.`,
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when stock is insufficient", async () => {
    setCatalogue({ produits: [{ id: 1, nom: "Ballon", prix: 50, stock: 2 }] });
    const res = mockResponse();

    await passerCommande(mockRequest({ body: { ...client, lignes: [{ produitId: 1, quantite: 3 }] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].erreurs[0]).toMatch(/Stock insuffisant/);
  });

  it("returns 400 when the offer does not target the product", async () => {
    setCatalogue({
      produits: [{ id: 1, nom: "Ballon", prix: 50, stock: 10 }],
      offres: [{ id: OFFRE_ID, titre: "Promo", pourcentageReduction: 20, produits: [{ id: 2 }] }],
    });
    const res = mockResponse();

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 1, offreId: OFFRE_ID, quantite: 1 }] } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].erreurs).toEqual(['L\'offre "Promo" ne s\'applique pas à cet article.']);
  });

  it("only queries valid offers", async () => {
    setCatalogue({ produits: [{ id: 1, nom: "Ballon", prix: 50, stock: 10 }] });

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 1, offreId: OFFRE_ID, quantite: 1 }] } }),
      mockResponse()
    );

    const { where } = prisma.offre.findMany.mock.calls[0][0];
    expect(where.id).toEqual({ in: [OFFRE_ID] });
    expect(where.dateDebut.lte).toBeInstanceOf(Date);
    expect(where.dateFin.gte).toBeInstanceOf(Date);
  });

  it("ignores an expired offer and charges the initial price", async () => {
    setCatalogue({ produits: [{ id: 1, nom: "Ballon", prix: 50, stock: 10 }], offres: [] });
    const res = mockResponse();

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 1, offreId: OFFRE_ID, quantite: 2 }] } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const { data } = tx.commande.create.mock.calls[0][0];
    expect(data.total).toBe(110); // 2 × 50 + 10 delivery
    expect(data.lignes.create[0]).not.toHaveProperty("offreId");
  });

  it("applies offers, prices packs and decrements product stock in a transaction", async () => {
    setCatalogue({
      produits: [{ id: 1, nom: "Ballon", prix: 49.99, stock: 10 }],
      packs: [{ id: PACK_ID, prixPack: 120 }],
      offres: [{ id: OFFRE_ID, titre: "Promo", pourcentageReduction: 15, produits: [{ id: 1 }] }],
    });
    const res = mockResponse();

    await passerCommande(
      mockRequest({
        body: {
          ...client,
          lignes: [
            { produitId: 1, offreId: OFFRE_ID, quantite: 3 },
            { packId: PACK_ID, quantite: 1 },
          ],
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const { data } = tx.commande.create.mock.calls[0][0];
    // 49.99 * 0.85 = 42.49 → 3 × 42.49 + 120 + 10 delivery
    expect(data.total).toBe(257.47);
    expect(data.fraisLivraison).toBe(10);
    expect(data).toMatchObject(client);
    expect(data.lignes.create).toEqual([
      { quantite: 3, prixInitiale: 49.99, produitId: 1, offreId: OFFRE_ID },
      { quantite: 1, prixInitiale: 120, packId: PACK_ID },
    ]);
    expect(tx.produit.update).toHaveBeenCalledTimes(1);
    expect(tx.produit.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { stock: { decrement: 3 } } });
  });

  it("adds the delivery fee once per order, whatever the quantity", async () => {
    setCatalogue({ produits: [{ id: 1, nom: "Ballon", prix: 25, stock: 10 }, { id: 2, nom: "Mini", prix: 15, stock: 10 }] });
    const res = mockResponse();

    await passerCommande(
      mockRequest({ body: { ...client, lignes: [{ produitId: 1, quantite: 4 }, { produitId: 2, quantite: 1 }] } }),
      res
    );

    const { data } = tx.commande.create.mock.calls[0][0];
    expect(data).toMatchObject({ fraisLivraison: 10, total: 125 }); // 4 × 25 + 15 + 10
    expect(res.json.mock.calls[0][0].commande).toMatchObject({ fraisLivraison: 10, total: 125 });
  });

  it("returns 500 when the transaction fails", async () => {
    setCatalogue({ produits: [{ id: 1, nom: "Ballon", prix: 50, stock: 10 }] });
    prisma.$transaction.mockRejectedValue(new Error("deadlock"));
    const res = mockResponse();

    await passerCommande(mockRequest({ body: { ...client, lignes: [{ produitId: 1, quantite: 1 }] } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("suiviCommande", () => {
  it("returns 404 for an unknown order", async () => {
    prisma.commande.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await suiviCommande(mockRequest({ params: { id: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("hides the delivery address and phone", async () => {
    prisma.commande.findUnique.mockResolvedValue({
      id: "cmd-1",
      statut: "en_attente",
      dateCommande: new Date(),
      fraisLivraison: 10,
      total: 110,
      ...client,
      lignes: [],
    });
    const res = mockResponse();

    await suiviCommande(mockRequest({ params: { id: "cmd-1" } }), res);

    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ id: "cmd-1", statut: "en_attente", nomClient: "Ali", fraisLivraison: 10, total: 110 });
    expect(body).not.toHaveProperty("adresseLivraison");
    expect(body).not.toHaveProperty("telephoneClient");
  });
});
