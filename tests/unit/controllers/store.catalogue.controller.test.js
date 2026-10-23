jest.mock("../../../config/prisma", () => ({
  produit: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  offre: { findMany: jest.fn() },
}));

const prisma = require("../../../config/prisma");
const { getAllProduitsPublic, getProduitPublic } = require("../../../controller/store.produit.controller");
const { getOffresActives } = require("../../../controller/store.offre.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

describe("getAllProduitsPublic", () => {
  it("lists in-stock products with availability labels and best offer", async () => {
    prisma.produit.findMany.mockResolvedValue([
      { id: 1, prix: 100, stock: 3, offres: [{ id: "o", pourcentageReduction: 25 }] },
      { id: 2, prix: 40, stock: 20, offres: [] },
    ]);
    prisma.produit.count.mockResolvedValue(25);
    const res = mockResponse();

    await getAllProduitsPublic(mockRequest({ query: { page: "2", limit: "12" } }), res);

    const { data, pagination } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({ id: 1, prixFinal: 75, disponibilite: "stock_faible" });
    expect(data[1]).toMatchObject({ id: 2, prixFinal: 40, disponibilite: "disponible", offre: null });
    expect(data[0]).not.toHaveProperty("stock");
    expect(pagination).toEqual({ total: 25, page: 2, limit: 12, totalPages: 3, hasNextPage: true, hasPrevPage: true });
    expect(prisma.produit.findMany.mock.calls[0][0]).toMatchObject({ skip: 12, take: 12 });
  });

  it("builds the filters from the query", async () => {
    prisma.produit.findMany.mockResolvedValue([]);
    prisma.produit.count.mockResolvedValue(0);

    await getAllProduitsPublic(mockRequest({ query: { search: "adidas", categorieId: "4", taille: "5" } }), mockResponse());

    expect(prisma.produit.findMany.mock.calls[0][0].where).toEqual({
      stock: { gt: 0 },
      OR: [{ nom: { contains: "adidas" } }, { description: { contains: "adidas" } }],
      categorieId: 4,
      taille: "5",
    });
  });

  it("returns 500 on database error", async () => {
    prisma.produit.findMany.mockRejectedValue(new Error("db"));
    prisma.produit.count.mockResolvedValue(0);
    const res = mockResponse();
    await getAllProduitsPublic(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("getProduitPublic", () => {
  it("returns 400 for a non numeric id", async () => {
    const res = mockResponse();
    await getProduitPublic(mockRequest({ params: { id: "abc" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when the product does not exist", async () => {
    prisma.produit.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await getProduitPublic(mockRequest({ params: { id: "9" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("marks an out-of-stock product as 'rupture'", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 9, prix: 30, stock: 0, offres: [] });
    const res = mockResponse();
    await getProduitPublic(mockRequest({ params: { id: "9" } }), res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ id: 9, disponibilite: "rupture", prixFinal: 30 });
  });
});

describe("getOffresActives", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("adds the discounted price of each product and the days left", async () => {
    prisma.offre.findMany.mockResolvedValue([
      {
        id: "o1",
        pourcentageReduction: 10,
        dateFin: "2026-06-17T00:00:00Z",
        produits: [{ id: 1, prix: 59.9 }],
      },
    ]);
    const res = mockResponse();

    await getOffresActives(mockRequest(), res);

    const { data } = res.json.mock.calls[0][0];
    expect(data[0].joursRestants).toBe(2);
    expect(data[0].produits[0]).toEqual({ id: 1, prix: 59.9, prixFinal: 53.91 });
    expect(prisma.offre.findMany.mock.calls[0][0].where).toEqual({
      dateDebut: { lte: new Date("2026-06-15T12:00:00Z") },
      dateFin: { gte: new Date("2026-06-15T12:00:00Z") },
    });
  });
});
