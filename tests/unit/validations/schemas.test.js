const { registerSchema, loginSchema, updateProfilSchema } = require("../../../validations/auth.validation");
const { createOffreSchema, updateOffreSchema, listOffresSchema } = require("../../../validations/offre.validation");
const { createPackSchema } = require("../../../validations/pack.validation");
const { createProduitSchema, listProduitsSchema } = require("../../../validations/produit.validation");
const { statistiquesQuery } = require("../../../validations/statistiques.validation");
const { passerCommandeSchema } = require("../../../validations/store.commande.validation");
const { updateStatutSchema } = require("../../../validations/commande.validation");

const UUID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";

const messages = (result) => result.error.issues.map((i) => i.message);

describe("auth validation", () => {
  const valid = { nom: "Admin", email: "ADMIN@Test.TN", motDePasse: "Secret123" };

  it("lowercases the email on register", () => {
    expect(registerSchema.body.parse(valid).email).toBe("admin@test.tn");
  });

  // .email() runs before .trim() in the schema, so surrounding spaces are rejected
  it("rejects an email with surrounding spaces", () => {
    expect(registerSchema.body.safeParse({ ...valid, email: " admin@test.tn " }).success).toBe(false);
  });

  it.each([
    ["too short", "Ab1"],
    ["no uppercase", "secret123"],
    ["no lowercase", "SECRET123"],
    ["no digit", "SecretSecret"],
  ])("rejects a weak password (%s)", (_, motDePasse) => {
    expect(registerSchema.body.safeParse({ ...valid, motDePasse }).success).toBe(false);
  });

  it("rejects an invalid email on login", () => {
    expect(loginSchema.body.safeParse({ email: "pas-un-email", motDePasse: "x" }).success).toBe(false);
  });

  it("makes the password optional on profile update", () => {
    expect(updateProfilSchema.body.safeParse({ nom: "Admin", email: "a@b.tn" }).success).toBe(true);
  });
});

describe("offre validation", () => {
  const valid = {
    titre: "Soldes été",
    pourcentageReduction: 20,
    dateDebut: "2026-06-01T00:00:00Z",
    dateFin: "2026-06-30T00:00:00Z",
    produitIds: [1, 2],
  };

  it("accepts a valid offer", () => {
    expect(createOffreSchema.body.safeParse(valid).success).toBe(true);
  });

  it("rejects dateDebut after dateFin", () => {
    const result = createOffreSchema.body.safeParse({ ...valid, dateDebut: "2026-07-01T00:00:00Z" });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(["dateDebut"]);
  });

  it.each([0, -5, 101])("rejects pourcentageReduction = %p", (pourcentageReduction) => {
    expect(createOffreSchema.body.safeParse({ ...valid, pourcentageReduction }).success).toBe(false);
  });

  it("requires at least one product, without duplicates", () => {
    expect(createOffreSchema.body.safeParse({ ...valid, produitIds: [] }).success).toBe(false);
    const dup = createOffreSchema.body.safeParse({ ...valid, produitIds: [1, 1] });
    expect(messages(dup)).toContain("Un produit ne peut apparaître qu'une seule fois dans une offre.");
  });

  it("only checks dates on update when both are sent", () => {
    expect(updateOffreSchema.body.safeParse({ dateDebut: "2027-01-01T00:00:00Z" }).success).toBe(true);
    expect(
      updateOffreSchema.body.safeParse({ dateDebut: "2027-01-02T00:00:00Z", dateFin: "2027-01-01T00:00:00Z" }).success
    ).toBe(false);
  });

  it("turns the active query flag into a boolean", () => {
    expect(listOffresSchema.query.parse({ active: "true" }).active).toBe(true);
    expect(listOffresSchema.query.parse({ active: "false" }).active).toBe(false);
    expect(listOffresSchema.query.parse({}).active).toBeUndefined();
  });
});

describe("pack validation", () => {
  const produits = [{ produitId: 1 }, { produitId: 2, quantite: 3 }];

  it("defaults quantite to 1 and pourcentageRemise to 0", () => {
    const pack = createPackSchema.body.parse({ nom: "Pack duo", produits });
    expect(pack.produits[0].quantite).toBe(1);
    expect(pack.pourcentageRemise).toBe(0);
  });

  it("requires at least 2 distinct products", () => {
    expect(createPackSchema.body.safeParse({ nom: "Pack", produits: [{ produitId: 1 }] }).success).toBe(false);
    expect(
      createPackSchema.body.safeParse({ nom: "Pack", produits: [{ produitId: 1 }, { produitId: 1 }] }).success
    ).toBe(false);
  });

  it("rejects a remise over 100 %", () => {
    expect(createPackSchema.body.safeParse({ nom: "Pack", produits, pourcentageRemise: 120 }).success).toBe(false);
  });
});

describe("produit validation", () => {
  it("coerces multipart string fields to numbers", () => {
    const produit = createProduitSchema.body.parse({ nom: "Ballon", categorieId: "3", prix: "49.9" });
    expect(produit).toMatchObject({ categorieId: 3, prix: 49.9, stock: 0 });
  });

  it("rejects a negative stock and a zero price", () => {
    expect(createProduitSchema.body.safeParse({ nom: "Ballon", categorieId: 1, prix: 10, stock: -1 }).success).toBe(false);
    expect(createProduitSchema.body.safeParse({ nom: "Ballon", categorieId: 1, prix: 0 }).success).toBe(false);
  });

  it("parses the stockFaible flag", () => {
    expect(listProduitsSchema.query.parse({ stockFaible: "true" }).stockFaible).toBe(true);
    expect(listProduitsSchema.query.parse({}).stockFaible).toBe(false);
  });
});

describe("statistiques validation", () => {
  it("accepts an ordered period and a known granularity", () => {
    expect(
      statistiquesQuery.safeParse({ dateDebut: "2026-01-01", dateFin: "2026-01-31", granularite: "semaine" }).success
    ).toBe(true);
  });

  it("rejects a reversed period, a bad format and an unknown granularity", () => {
    expect(statistiquesQuery.safeParse({ dateDebut: "2026-02-01", dateFin: "2026-01-01" }).success).toBe(false);
    expect(statistiquesQuery.safeParse({ dateDebut: "01/02/2026" }).success).toBe(false);
    expect(statistiquesQuery.safeParse({ granularite: "annee" }).success).toBe(false);
  });
});

describe("commande validation", () => {
  const valid = {
    nomClient: "Ali",
    telephoneClient: "+21698123456",
    adresseLivraison: "12 rue de Sfax",
    lignes: [{ produitId: 1, quantite: 2 }],
  };

  it("accepts a valid order", () => {
    expect(passerCommandeSchema.body.safeParse(valid).success).toBe(true);
  });

  it("requires each line to have a produitId or a packId", () => {
    const result = passerCommandeSchema.body.safeParse({ ...valid, lignes: [{ quantite: 1 }] });
    expect(messages(result)).toContain("Chaque ligne doit avoir un produitId ou un packId.");
  });

  it("accepts a pack line with an offer UUID", () => {
    expect(
      passerCommandeSchema.body.safeParse({ ...valid, lignes: [{ packId: UUID, offreId: UUID, quantite: 1 }] }).success
    ).toBe(true);
  });

  it.each(["1234", "abcdefghij", "1234567890123456"])("rejects phone %p", (telephoneClient) => {
    expect(passerCommandeSchema.body.safeParse({ ...valid, telephoneClient }).success).toBe(false);
  });

  it("caps the quantity at 50 in the store", () => {
    expect(passerCommandeSchema.body.safeParse({ ...valid, lignes: [{ produitId: 1, quantite: 51 }] }).success).toBe(false);
  });

  it("only accepts known statuses", () => {
    expect(updateStatutSchema.body.safeParse({ statut: "livree" }).success).toBe(true);
    expect(updateStatutSchema.body.safeParse({ statut: "perdue" }).success).toBe(false);
  });
});
