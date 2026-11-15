// Usage: npm run images:list
// Lists every image stored on Cloudinary (folder ballons-tunisie/) and flags
// the ones no product uses anymore ("ORPHAN").
require("dotenv").config();
const { cloudinary, isConfigured } = require("../config/cloudinary");
const prisma = require("../config/prisma");

(async () => {
  if (!isConfigured()) throw new Error("Variables CLOUDINARY_* manquantes dans .env");
  const { resources } = await cloudinary.api.resources({ type: "upload", prefix: "ballons-tunisie/", max_results: 500 });
  const produits = await prisma.produit.findMany({ select: { id: true, nom: true, imageUrl: true } });
  const used = new Map(produits.filter((p) => p.imageUrl).map((p) => [p.imageUrl, p]));

  console.log(`\n${resources.length} image(s) sur Cloudinary\n`);
  for (const r of resources) {
    const p = used.get(r.secure_url);
    console.log(`${p ? "OK    " : "ORPHAN"}  ${r.public_id}.${r.format}  ${Math.round(r.bytes / 1024)} Ko  ${p ? `-> produit #${p.id} ${p.nom}` : ""}`);
    console.log(`      ${r.secure_url}`);
  }
  console.log(`\nProduits sans image : ${produits.filter((p) => !p.imageUrl || p.imageUrl.startsWith("/uploads/")).map((p) => `#${p.id} ${p.nom}`).join(", ") || "aucun"}`);
})()
  .catch((e) => console.error("Erreur :", e.message))
  .finally(() => prisma.$disconnect());
