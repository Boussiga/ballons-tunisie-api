jest.mock("../../../config/prisma", () => ({
  produit: { count: jest.fn(), findMany: jest.fn() },
  pack: { count: jest.fn() },
  offre: { count: jest.fn() },
  commande: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
}));

const prisma = require("../../../config/prisma");
const { getDashboard, getStatistiquesVentes } = require("../../../controller/admin.dashboard.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

const NOW = new Date(2026, 6, 15, 12); // 2026-07-15 12:00, local time

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  for (const m of [prisma.produit.count, prisma.offre.count, prisma.commande.count]) m.mockReset();
});

afterEach(() => jest.useRealTimers());

describe("getDashboard", () => {
  const setCounts = (chiffreAffaires) => {
    prisma.produit.count.mockResolvedValueOnce(40).mockResolvedValueOnce(3);
    prisma.pack.count.mockResolvedValue(5);
    prisma.offre.count.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    prisma.commande.count.mockResolvedValueOnce(120).mockResolvedValueOnce(7).mockResolvedValueOnce(18);
    prisma.commande.aggregate.mockResolvedValue({ _sum: { total: chiffreAffaires } });
    prisma.produit.findMany.mockResolvedValue([{ id: 1, nom: "Ballon", stock: 2 }]);
  };

  it("returns the global counters", async () => {
    setCounts(1530.5);
    const res = mockResponse();

    await getDashboard(mockRequest(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      produits: { total: 40, enRupture: 3, stockFaible: [{ id: 1, nom: "Ballon", stock: 2 }] },
      packs: { total: 5 },
      offres: { total: 8, actives: 2 },
      commandes: { total: 120, enAttente: 7, ceMois: 18 },
      chiffreAffairesMois: 1530.5,
    });
  });

  it("filters the monthly revenue from the 1st of the month, without cancelled orders", async () => {
    setCounts(100);

    await getDashboard(mockRequest(), mockResponse());

    expect(prisma.commande.aggregate).toHaveBeenCalledWith({
      _sum: { total: true },
      where: { dateCommande: { gte: new Date(2026, 6, 1) }, statut: { not: "annulee" } },
    });
    expect(prisma.offre.count).toHaveBeenNthCalledWith(2, {
      where: { dateDebut: { lte: NOW }, dateFin: { gte: NOW } },
    });
    expect(prisma.produit.findMany.mock.calls[0][0].where).toEqual({ stock: { gt: 0, lt: 5 } });
  });

  it("returns 0 revenue when there is no order this month", async () => {
    setCounts(null);
    const res = mockResponse();
    await getDashboard(mockRequest(), res);
    expect(res.json.mock.calls[0][0].chiffreAffairesMois).toBe(0);
  });

  it("returns 500 when the database fails", async () => {
    prisma.produit.count.mockRejectedValue(new Error("db"));
    const res = mockResponse();
    await getDashboard(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("getStatistiquesVentes", () => {
  const appeler = async (query) => {
    const res = mockResponse();
    await getStatistiquesVentes(mockRequest({ query }), res);
    return res;
  };

  it.each([
    [undefined, "mois", new Date(2026, 6, 1)],
    ["mois", "mois", new Date(2026, 6, 1)],
    ["semaine", "semaine", new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)],
    ["annee", "annee", new Date(2026, 0, 1)],
  ])("periode=%p starts at the right date", async (periode, attendu, dateDebut) => {
    prisma.commande.findMany.mockResolvedValue([]);

    const res = await appeler(periode ? { periode } : {});

    expect(prisma.commande.findMany.mock.calls[0][0].where).toEqual({
      dateCommande: { gte: dateDebut },
      statut: { not: "annulee" },
    });
    expect(res.json.mock.calls[0][0]).toMatchObject({ periode: attendu, dateDebut, totalCommandes: 0, chiffreAffaires: 0 });
  });

  it("sums the revenue rounded to 2 decimals", async () => {
    const commandes = [{ total: 10.1 }, { total: 20.2 }, { total: 0.033 }];
    prisma.commande.findMany.mockResolvedValue(commandes);

    const res = await appeler({});

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ totalCommandes: 3, chiffreAffaires: 30.33, commandes });
  });

  it("returns 500 when the database fails", async () => {
    prisma.commande.findMany.mockRejectedValue(new Error("db"));
    const res = await appeler({});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
