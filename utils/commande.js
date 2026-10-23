// Flat delivery fee (TND) added to every new order. It is stored on the order
// (fraisLivraison) so a later change of this value never alters past orders.
const FRAIS_LIVRAISON = 10;

// What the client pays: items subtotal + delivery fee, rounded to 2 decimals
const totalAvecLivraison = (sousTotal, fraisLivraison = FRAIS_LIVRAISON) =>
  parseFloat((sousTotal + fraisLivraison).toFixed(2));

module.exports = { FRAIS_LIVRAISON, totalAvecLivraison };
