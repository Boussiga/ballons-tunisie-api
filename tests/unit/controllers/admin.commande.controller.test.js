jest.mock("../../../config/prisma", () => ({
  commande: { findUnique: jest.fn(), update: jest.fn() },
  produit: { findMany: jest.fn() },
  pack: { findMany: jest.fn() },
  offre: { findMany: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { calculerTotal, createCommande } = require("../../../controller/admin.commande.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

describe("calculerTotal", () => {
  const lignes = [
    { prixInitiale: 50, quantite: 2, offre: { pourcentageReduction: 20 } },
    { prixInitiale: 33.33, quantite: 1, offre: null },
  ];

  it("returns 404 for an unknown order", async () => {
    prisma.commande.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await calculerTotal(mockRequest({ params: { id: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.commande.update).not.toHaveBeenCalled();
  });

  it("recomputes the total with offers and the stored delivery fee, and saves it", async () => {
    prisma.commande.findUnique.mockResolvedValue({ id: "c1", fraisLivraison: 10, lignes });
    const res = mockResponse();

    await calculerTotal(mockRequest({ params: { id: "c1" } }), res);

    // 2 × 40 + 33.33 + 10
    expect(prisma.commande.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { total: 123.33 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ commandeId: "c1", total: 123.33 });
  });

  it("does not add a fee to orders placed before delivery fees existed", async () => {
    prisma.commande.findUnique.mockResolvedValue({ id: "old", fraisLivraison: 0, lignes });
    const res = mockResponse();

    await calculerTotal(mockRequest({ params: { id: "old" } }), res);

    expect(res.json).toHaveBeenCalledWith({ commandeId: "old", total: 113.33 });
  });
});

describe("createCommande", () => {
  const tx = { commande: { create: jest.fn() }, produit: { update: jest.fn() } };
  const body = {
    nomClient: "Ali",
    telephoneClient: "98123456",
    adresseLivraison: "12 rue de Sfax",
    lignes: [{ produitId: 1, quantite: 2 }],
  };

  beforeEach(() => {
    prisma.produit.findMany.mockResolvedValue([{ id: 1, nom: "Ballon", prix: 45, stock: 5 }]);
    prisma.pack.findMany.mockResolvedValue([]);
    prisma.offre.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((fn) => fn(tx));
    tx.commande.create.mockImplementation(({ data }) => Promise.resolve({ id: "c1", ...data }));
  });

  it("adds the delivery fee to the total and stores it", async () => {
    const res = mockResponse();

    await createCommande(mockRequest({ body }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(tx.commande.create.mock.calls[0][0].data).toMatchObject({ fraisLivraison: 10, total: 100 }); // 2 × 45 + 10
    expect(tx.produit.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { stock: { decrement: 2 } } });
  });

  it("returns 400 without creating anything when stock is insufficient", async () => {
    const res = mockResponse();

    await createCommande(mockRequest({ body: { ...body, lignes: [{ produitId: 1, quantite: 9 }] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
