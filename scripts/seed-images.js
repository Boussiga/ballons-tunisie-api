// Usage: npm run images:seed
// Gives a picture to every product that has none: uploads the illustration of its
// sport (scripts/ball-images/<sport>.png) to Cloudinary and saves the URL on the product.
// Safe to re-run: products that already have an image are never touched.
// Replace these demo pictures later with real photos from the back office.
require("dotenv").config();
const path = require("path");
const { cloudinary, FOLDER, isConfigured } = require("../config/cloudinary");
const prisma = require("../config/prisma");

const SPORTS = ["football", "futsal", "handball", "basketball", "volleyball"];
const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Pick the sport from the category name first, then from the product name.
const sportOf = (p) => {
  const cat = normalize(p.categorie && p.categorie.nom);
  const nom = normalize(p.nom);
  const hit = (txt) => SPORTS.find((s) => txt.includes(s)) || (txt.includes("volley") ? "volleyball" : null);
  return hit(cat) || hit(nom) || "football";
};

(async () => {
  if (!isConfigured()) throw new Error("Variables CLOUDINARY_* manquantes dans .env");
  const produits = await prisma.produit.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: { startsWith: "/uploads/" } }] }, // no image, or a legacy local path whose file is gone
    include: { categorie: { select: { nom: true } } },
  });
  console.log(`${produits.length} produit(s) sans image\n`);

  for (const p of produits) {
    const sport = sportOf(p);
    const file = path.join(__dirname, "ball-images", `${sport}.png`);
    const r = await cloudinary.uploader.upload(file, { folder: FOLDER, resource_type: "image" });
    await prisma.produit.update({ where: { id: p.id }, data: { imageUrl: r.secure_url } });
    console.log(`#${p.id} ${p.nom}  <-  ${sport}`);
  }
  console.log("\nTerminé. Vérifiez avec : npm run images:list");
})()
  .catch((e) => console.error("Erreur :", e.message))
  .finally(() => prisma.$disconnect());
