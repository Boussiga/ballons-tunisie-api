const { FRAIS_LIVRAISON, totalAvecLivraison } = require("../../../utils/commande");

describe("frais de livraison", () => {
  it("is 10 TND", () => {
    expect(FRAIS_LIVRAISON).toBe(10);
  });

  it("adds the default fee to the subtotal", () => {
    expect(totalAvecLivraison(90)).toBe(100);
  });

  it("uses the given fee, including 0 for older orders", () => {
    expect(totalAvecLivraison(90, 7)).toBe(97);
    expect(totalAvecLivraison(90, 0)).toBe(90);
  });

  it("rounds to 2 decimals", () => {
    expect(totalAvecLivraison(0.1 + 0.2)).toBe(10.3);
    expect(totalAvecLivraison(127.474999)).toBe(137.47);
  });
});
