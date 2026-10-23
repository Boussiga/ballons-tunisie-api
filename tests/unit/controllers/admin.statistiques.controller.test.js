jest.mock("../../../config/prisma", () => ({
  commande: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  produit: { findMany: jest.fn() },
}));

const prisma = require("../../../config/prisma");
const { getStatistiquesDetaillees } = require("../../../controller/admin.statistiques.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

// Dates are built in local time, like the controller does, so the tests do not depend on the timezone
const NOW = new Date(2026, 6, 1, 12); // 2026-07-01 12:00

const P1 = { id: 1, nom: "Ballon Pro", categorie: { id: 10, nom: "Ballons" } };
const P2 = { id: 2, nom: "Ballon Mini", categorie: null };
const PACK = { id: "pack-1", nom: "Pack Duo" };
const OFFRE = { id: "offre-1", titre: "Promo été", pourcentageReduction: 20 };

let seq = 0;
const commande = ({ date, statut = "livree", total, tel = "11111111", nom = "Ali", adresse = "Tunis", lignes = [] }) => ({
  id: `c${++seq}`,
  dateCommande: date,
  statut,
  total,
  nomClient: nom,
  telephoneClient: tel,
  adresseLivraison: adresse,
  lignes,
});

const ligne = ({ produit = null, pack = null, offre = null, quantite, prixInitiale }) => ({
  produit, pack, offre, quantite, prixInitiale,
});

// Mocks the 4 parallel queries + the customers history query
const setData = ({ commandes = [], precedentes = [], produits = [], enAttente = 0, historique = [] }) => {
  prisma.commande.findMany.mockResolvedValueOnce(commandes).mockResolvedValueOnce(precedentes);
  prisma.produit.findMany.mockResolvedValue(produits);
  prisma.commande.count.mockResolvedValue(enAttente);
  prisma.commande.groupBy.mockResolvedValue(historique);
};

const appeler = async (query = {}) => {
  const res = mockResponse();
  await getStatistiquesDetaillees(mockRequest({ query }), res);
  return { res, body: res.json.mock.calls[0]?.[0] };
};

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  // clearMocks does not reset queued mockResolvedValueOnce values
  prisma.commande.findMany.mockReset();
});

afterEach(() => jest.useRealTimers());

describe("getStatistiquesDetaillees — validation & period", () => {
  it("returns 422 for an invalid query without touching the database", async () => {
    const { res, body } = await appeler({ dateDebut: "2026-02-01", dateFin: "2026-01-01" });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(body.erreurs[0].champ).toBe("query.dateDebut");
    expect(prisma.commande.findMany).not.toHaveBeenCalled();
  });

  it("defaults to the last 30 days, today included, compared with the 30 days before", async () => {
    setData({});

    const { body } = await appeler();

    expect(body.periode).toEqual({
      dateDebut: "2026-06-02",
      dateFin: "2026-07-01",
      nbJours: 30,
      granularite: "jour",
      periodePrecedente: { dateDebut: "2026-05-03", dateFin: "2026-06-01" },
    });
    expect(prisma.commande.findMany.mock.calls[0][0].where).toEqual({
      dateCommande: { gte: new Date(2026, 5, 2), lt: new Date(2026, 6, 2) },
    });
    expect(prisma.commande.findMany.mock.calls[1][0].where).toEqual({
      dateCommande: { gte: new Date(2026, 4, 3), lt: new Date(2026, 5, 2) },
    });
  });

  it("counts pending orders older than 48h", async () => {
    setData({});
    await appeler();
    expect(prisma.commande.count).toHaveBeenCalledWith({
      where: { statut: "en_attente", dateCommande: { lt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000) } },
    });
  });

  it("uses weekly buckets starting on Monday for a ~3 months period", async () => {
    setData({});

    const { body } = await appeler({ dateDebut: "2026-01-01", dateFin: "2026-03-31" });

    expect(body.periode.granularite).toBe("semaine");
    // 2026-01-01 is a Thursday → first bucket is Monday 2025-12-29
    expect(body.evolution[0].periode).toBe("2025-12-29");
    expect(body.evolution).toHaveLength(14);
    expect(body.evolution.at(-1).periode).toBe("2026-03-30");
  });

  it("uses monthly buckets for a full year", async () => {
    setData({});

    const { body } = await appeler({ dateDebut: "2025-01-01", dateFin: "2025-12-31" });

    expect(body.periode).toMatchObject({ nbJours: 365, granularite: "mois" });
    expect(body.evolution.map((p) => p.periode)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`)
    );
  });

  it("respects an explicit granularity", async () => {
    setData({});
    const { body } = await appeler({ dateDebut: "2026-06-01", dateFin: "2026-06-30", granularite: "mois" });
    expect(body.evolution.map((p) => p.periode)).toEqual(["2026-06"]);
  });

  it("returns 500 when the database fails", async () => {
    prisma.commande.findMany.mockRejectedValue(new Error("db down"));
    const { res } = await appeler();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("getStatistiquesDetaillees — empty period", () => {
  it("returns zeros everywhere and skips the customers query", async () => {
    setData({});

    const { res, body } = await appeler({ dateDebut: "2026-06-01", dateFin: "2026-06-30" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.commande.groupBy).not.toHaveBeenCalled();
    expect(body.resume).toMatchObject({
      chiffreAffaires: 0,
      nombreCommandes: 0,
      panierMoyen: 0,
      articlesParCommande: 0,
      tauxAnnulation: 0,
      tauxLivraison: 0,
      clientsUniques: 0,
    });
    expect(body.comparaison.chiffreAffaires.evolution).toBe(0);
    expect(body.evolution).toHaveLength(30);
    expect(body.evolution.every((p) => p.commandes === 0 && p.chiffreAffaires === 0)).toBe(true);
    expect(body.commandesParStatut).toEqual({
      en_attente: { nombre: 0, montant: 0 },
      confirmee: { nombre: 0, montant: 0 },
      livree: { nombre: 0, montant: 0 },
      annulee: { nombre: 0, montant: 0 },
    });
    expect(body.clients.valeurMoyenneClient).toBe(0);
    expect(body.alertes).toEqual([]);
  });
});

describe("getStatistiquesDetaillees — full period (June 2026)", () => {
  // 2026-06-15 is a Monday
  const c1 = commande({
    date: new Date(2026, 5, 15, 10), statut: "livree", total: 100, tel: "A", nom: "Ali", adresse: "Rue X, Sfax",
    lignes: [ligne({ produit: P1, quantite: 2, prixInitiale: 50 })],
  });
  const c2 = commande({
    date: new Date(2026, 5, 16, 14), statut: "confirmee", total: 80, tel: "B", nom: "Sami", adresse: "Avenue Habib Bourguiba, Hammamet",
    lignes: [
      ligne({ produit: P1, offre: OFFRE, quantite: 1, prixInitiale: 50 }), // 40 paid, 10 discount
      ligne({ pack: PACK, quantite: 1, prixInitiale: 40 }),
    ],
  });
  const c3 = commande({
    date: new Date(2026, 5, 16, 18), statut: "en_attente", total: 50, tel: "A", nom: "Ali", adresse: "Midoun, Djerba",
    lignes: [ligne({ produit: P2, quantite: 1, prixInitiale: 50 })],
  });
  const c4 = commande({
    date: new Date(2026, 5, 20, 9), statut: "annulee", total: 200, tel: "C", adresse: "Inconnue",
    lignes: [ligne({ produit: P1, quantite: 4, prixInitiale: 50 })],
  });

  const precedentes = [
    { statut: "livree", total: 115, telephoneClient: "A", lignes: [{ quantite: 1 }] },
    { statut: "annulee", total: 30, telephoneClient: "D", lignes: [{ quantite: 1 }] },
  ];

  const produits = [
    { id: 1, nom: "Ballon Pro", prix: 50, stock: 1, categorie: { nom: "Ballons" } },
    { id: 2, nom: "Ballon Mini", prix: 50, stock: 100, categorie: null },
    { id: 3, nom: "Ballon Futsal", prix: 20, stock: 0, categorie: null },
    { id: 4, nom: "Ballon Plage", prix: 30, stock: 3, categorie: null },
  ];

  const historique = [
    { telephoneClient: "A", _min: { dateCommande: new Date(2026, 4, 10) }, _count: { _all: 3 } },
    { telephoneClient: "B", _min: { dateCommande: new Date(2026, 5, 16) }, _count: { _all: 1 } },
  ];

  let body;

  beforeEach(async () => {
    setData({ commandes: [c1, c2, c3, c4], precedentes, produits, enAttente: 2, historique });
    ({ body } = await appeler({ dateDebut: "2026-06-01", dateFin: "2026-06-30" }));
  });

  it("only queries the history of the period's customers, without cancelled orders", () => {
    expect(prisma.commande.groupBy.mock.calls[0][0].where).toEqual({
      telephoneClient: { in: ["A", "B"] },
      statut: { not: "annulee" },
    });
  });

  it("computes the summary, ignoring cancelled orders in revenue", () => {
    expect(body.resume).toEqual({
      chiffreAffaires: 230,
      chiffreAffairesEncaisse: 100,
      chiffreAffairesEnCours: 130,
      chiffreAffairesPerdu: 200,
      caMoyenParJour: 7.67,
      nombreCommandes: 4,
      commandesValides: 3,
      commandesAnnulees: 1,
      panierMoyen: 76.67,
      articlesVendus: 5,
      articlesParCommande: 1.67,
      remisesAccordees: 10,
      tauxAnnulation: 25,
      tauxLivraison: 33.33,
      clientsUniques: 2,
    });
  });

  it("groups orders by status", () => {
    expect(body.commandesParStatut).toEqual({
      en_attente: { nombre: 1, montant: 50 },
      confirmee: { nombre: 1, montant: 80 },
      livree: { nombre: 1, montant: 100 },
      annulee: { nombre: 1, montant: 200 },
    });
  });

  it("compares with the previous period", () => {
    expect(body.comparaison).toEqual({
      chiffreAffaires: { actuel: 230, precedent: 115, evolution: 100 },
      commandes: { actuel: 3, precedent: 1, evolution: 200 },
      panierMoyen: { actuel: 76.67, precedent: 115, evolution: -33.33 },
      articlesVendus: { actuel: 5, precedent: 1, evolution: 400 },
      clients: { actuel: 2, precedent: 1, evolution: 100 },
      commandesAnnulees: { actuel: 1, precedent: 1, evolution: 0 },
    });
  });

  it("builds a daily series with empty days and cancelled orders apart", () => {
    expect(body.evolution).toHaveLength(30);
    const jour = (d) => body.evolution.find((p) => p.periode === d);

    expect(jour("2026-06-01")).toEqual({
      periode: "2026-06-01", chiffreAffaires: 0, commandes: 0, commandesAnnulees: 0, articlesVendus: 0, panierMoyen: 0,
    });
    expect(jour("2026-06-15")).toMatchObject({ chiffreAffaires: 100, commandes: 1, articlesVendus: 2, panierMoyen: 100 });
    expect(jour("2026-06-16")).toMatchObject({ chiffreAffaires: 130, commandes: 2, articlesVendus: 3, panierMoyen: 65 });
    expect(jour("2026-06-20")).toMatchObject({ chiffreAffaires: 0, commandes: 0, commandesAnnulees: 1 });
  });

  it("ranks products using the amount actually paid after offers", () => {
    expect(body.produits).toEqual({
      topParChiffreAffaires: [
        { id: 1, nom: "Ballon Pro", quantite: 3, chiffreAffaires: 140, commandes: 2 },
        { id: 2, nom: "Ballon Mini", quantite: 1, chiffreAffaires: 50, commandes: 1 },
      ],
      topParQuantite: [
        { id: 1, nom: "Ballon Pro", quantite: 3, chiffreAffaires: 140, commandes: 2 },
        { id: 2, nom: "Ballon Mini", quantite: 1, chiffreAffaires: 50, commandes: 1 },
      ],
      nombreProduitsVendus: 2,
    });
  });

  it("splits revenue by category, with packs and uncategorised products apart", () => {
    expect(body.categories).toEqual([
      { id: 10, nom: "Ballons", quantite: 3, chiffreAffaires: 140, commandes: 2, part: 60.87 },
      { id: null, nom: "Sans catégorie", quantite: 1, chiffreAffaires: 50, commandes: 1, part: 21.74 },
      { id: null, nom: "Packs", quantite: 1, chiffreAffaires: 40, commandes: 1, part: 17.39 },
    ]);
  });

  it("reports packs and offers with the discount granted", () => {
    expect(body.packs).toEqual([{ id: "pack-1", nom: "Pack Duo", quantite: 1, chiffreAffaires: 40, commandes: 1 }]);
    expect(body.offres).toEqual({
      commandesAvecOffre: 1,
      partCommandesAvecOffre: 33.33,
      remisesAccordees: 10,
      details: [
        { id: "offre-1", titre: "Promo été", pourcentageReduction: 20, quantite: 1, chiffreAffaires: 40, remiseAccordee: 10, commandes: 1 },
      ],
    });
  });

  it("identifies new, returning and loyal customers by phone", () => {
    expect(body.clients).toEqual({
      uniques: 2,
      nouveaux: 1,
      recurrents: 1,
      fideles: 1,
      tauxFidelite: 50,
      valeurMoyenneClient: 115,
      topClients: [
        { nomClient: "Ali", telephoneClient: "A", chiffreAffaires: 150, commandes: 2 },
        { nomClient: "Sami", telephoneClient: "B", chiffreAffaires: 80, commandes: 1 },
      ],
    });
  });

  it("detects the governorate from the address, cities included", () => {
    expect(body.regions).toEqual([
      { gouvernorat: "Sfax", chiffreAffaires: 100, commandes: 1, part: 43.48 },
      { gouvernorat: "Nabeul", chiffreAffaires: 80, commandes: 1, part: 34.78 },
      { gouvernorat: "Médenine", chiffreAffaires: 50, commandes: 1, part: 21.74 },
    ]);
  });

  it("aggregates buying habits by weekday and hour", () => {
    const { parJourSemaine, parHeure } = body.habitudes;
    expect(parJourSemaine).toHaveLength(7);
    expect(parJourSemaine[0]).toEqual({ jour: "Lundi", commandes: 1, chiffreAffaires: 100 });
    expect(parJourSemaine[1]).toEqual({ jour: "Mardi", commandes: 2, chiffreAffaires: 130 });
    expect(parJourSemaine[5]).toEqual({ jour: "Samedi", commandes: 0, chiffreAffaires: 0 }); // cancelled order
    expect(parHeure).toHaveLength(24);
    expect(parHeure[10]).toEqual({ heure: 10, commandes: 1, chiffreAffaires: 100 });
    expect(parHeure[14]).toEqual({ heure: 14, commandes: 1, chiffreAffaires: 80 });
    expect(parHeure[9].commandes).toBe(0);
  });

  it("reports stock health from direct product sales", () => {
    expect(body.stock).toEqual({
      valeurStock: 5140,
      totalProduits: 4,
      ruptures: [{ id: 3, nom: "Ballon Futsal" }],
      stockFaible: [
        { id: 1, nom: "Ballon Pro", stock: 1 },
        { id: 4, nom: "Ballon Plage", stock: 3 },
      ],
      // 3 sold over 30 days → 0.1 / day → 1 in stock lasts 10 days
      risqueRupture: [{ id: 1, nom: "Ballon Pro", stock: 1, ventesParJour: 0.1, joursRestants: 10 }],
      sansVente: {
        nombre: 1,
        valeurImmobilisee: 90,
        produits: [{ id: 4, nom: "Ballon Plage", stock: 3, valeurStock: 90 }],
      },
    });
  });

  it("raises the matching alerts, most urgent first", () => {
    expect(body.alertes).toEqual([
      { niveau: "danger", message: "2 commande(s) en attente depuis plus de 48h." },
      { niveau: "danger", message: "1 produit(s) en rupture de stock." },
      { niveau: "warning", message: "1 produit(s) risquent la rupture dans moins de 14 jours au rythme actuel." },
      { niveau: "info", message: "Chiffre d'affaires en hausse de 100% par rapport à la période précédente." },
      { niveau: "info", message: "1 produit(s) en stock sans aucune vente sur la période." },
    ]);
  });
});

describe("getStatistiquesDetaillees — specific rules", () => {
  const periode = { dateDebut: "2026-06-01", dateFin: "2026-06-30" };
  const jour = new Date(2026, 5, 10, 12);

  it("returns a null evolution when there is nothing to compare to", async () => {
    setData({ commandes: [commande({ date: jour, total: 50 })] });

    const { body } = await appeler(periode);

    expect(body.comparaison.chiffreAffaires).toEqual({ actuel: 50, precedent: 0, evolution: null });
    expect(body.alertes.some((a) => a.message.includes("hausse"))).toBe(false);
  });

  it("warns about a high cancellation rate from 5 orders and a revenue drop", async () => {
    const commandes = [
      ...Array.from({ length: 4 }, () => commande({ date: jour, total: 10 })),
      commande({ date: jour, statut: "annulee", total: 10 }),
    ];
    setData({ commandes, precedentes: [{ statut: "livree", total: 100, telephoneClient: "X", lignes: [] }] });

    const { body } = await appeler(periode);

    expect(body.resume.tauxAnnulation).toBe(20);
    expect(body.alertes).toEqual([
      { niveau: "warning", message: "Taux d'annulation élevé : 20%." },
      { niveau: "warning", message: "Chiffre d'affaires en baisse de 60% par rapport à la période précédente." },
    ]);
  });

  it("does not warn about cancellations below 5 orders", async () => {
    setData({
      commandes: [commande({ date: jour, total: 10 }), commande({ date: jour, statut: "annulee", total: 10 })],
    });
    const { body } = await appeler(periode);
    expect(body.resume.tauxAnnulation).toBe(50);
    expect(body.alertes.some((a) => a.message.includes("annulation"))).toBe(false);
  });

  it.each([
    ["Rue de Tunis, Sousse", "Sousse"], // last governorate in the address wins
    ["Cité El Amal, Gabès", "Gabès"], // accent-insensitive
    ["LA MARSA", "Tunis"], // case-insensitive alias
    ["Route de Menzel Bourguiba", "Bizerte"],
    ["Quelque part", "Non identifié"],
    [null, "Non identifié"],
  ])("maps the address %p to %p", async (adresse, gouvernorat) => {
    setData({ commandes: [commande({ date: jour, total: 10, adresse })] });
    const { body } = await appeler(periode);
    expect(body.regions.map((r) => r.gouvernorat)).toEqual([gouvernorat]);
  });

  it("does not match an alias inside another word", async () => {
    // "kef" must not be found in "Skefa"
    setData({ commandes: [commande({ date: jour, total: 10, adresse: "Rue Skefa" })] });
    const { body } = await appeler(periode);
    expect(body.regions[0].gouvernorat).toBe("Non identifié");
  });

  it("does not count pack sales in the stock coverage", async () => {
    setData({
      commandes: [commande({ date: jour, total: 40, lignes: [ligne({ pack: PACK, quantite: 1, prixInitiale: 40 })] })],
      produits: [{ id: 1, nom: "Ballon Pro", prix: 50, stock: 1, categorie: null }],
    });

    const { body } = await appeler(periode);

    expect(body.stock.risqueRupture).toEqual([]);
    expect(body.stock.sansVente.nombre).toBe(1);
  });
});
