// Demo data for the client validation sessions.
// Usage: npm run db:seed
//
// WARNING: this script EMPTIES the database (and the product images it references on
// Cloudinary) before loading the demo data, so every demo starts from the same state.
// It refuses to run when NODE_ENV=production.

require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { FRAIS_LIVRAISON, totalAvecLivraison } = require("../utils/commande");
const { cloudinary, FOLDER, isConfigured } = require("../config/cloudinary");
const { deleteImage } = require("../middelwhere/upload.middleware");
const { genererSvg, NB_VUES } = require("./demo-visuels");

const prisma = new PrismaClient();

// The shop only sells balls for now: one category per sport
const CATEGORIES = [
  { nom: "Football", description: "Ballons de football : match, entraînement, jeunes et supporters" },
  { nom: "Futsal", description: "Ballons de futsal à rebond contrôlé pour la salle" },
  { nom: "Handball", description: "Ballons de handball tailles 1 à 3" },
  { nom: "Basketball", description: "Ballons de basketball intérieur et extérieur" },
  { nom: "Volleyball", description: "Ballons de volleyball indoor, loisir et beach" },
];

// taille = official ball size (max 10 characters, see produit.validation.js)
// visuel = demo illustration (see demo-visuels.js): pattern, background gradient and ball colours
// A few products are out of stock or running low, so the dashboard alerts have something to show.
const PRODUITS = [
  { nom: "Ballon de Match Football Pro", categorie: "Football", taille: "5", prix: 249, stock: 25,
    description: "Ballon de match thermosoudé, homologué FIFA Quality Pro. Trajectoire stable et toucher précis.",
    visuel: { motif: "football", decor: ["#0f3d2e", "#1f7a55"], fond: "#ffffff", patch: "#111827", couture: "#1f2937" } },
  { nom: "Ballon Football Entraînement", categorie: "Football", taille: "5", prix: 59, stock: 120,
    description: "Ballon d'entraînement cousu machine, résistant sur gazon naturel, synthétique et stabilisé.",
    visuel: { motif: "football", decor: ["#14532d", "#4ade80"], fond: "#f8fafc", patch: "#15803d", couture: "#334155" } },
  { nom: "Ballon Football Junior", categorie: "Football", taille: "4", prix: 49, stock: 80,
    description: "Ballon taille 4, plus léger, pour les jeunes de 8 à 12 ans.",
    visuel: { motif: "football", decor: ["#1e3a8a", "#60a5fa"], fond: "#ffffff", patch: "#2563eb", couture: "#1e293b" } },
  { nom: "Ballon Football Kids", categorie: "Football", taille: "3", prix: 39, stock: 4,
    description: "Ballon taille 3 souple et coloré pour les moins de 8 ans.",
    visuel: { motif: "football", decor: ["#9a3412", "#fdba74"], fond: "#fef3c7", patch: "#f97316", couture: "#7c2d12" } },
  { nom: "Ballon Football Street", categorie: "Football", taille: "5", prix: 69, stock: 0,
    description: "Revêtement renforcé pour le béton et le bitume, idéal pour le foot de quartier.",
    visuel: { motif: "football", decor: ["#18181b", "#52525b"], fond: "#facc15", patch: "#18181b", couture: "#27272a" } },
  { nom: "Mini-Ballon Supporter", categorie: "Football", taille: "1", prix: 25, stock: 60,
    description: "Mini-ballon rouge et blanc taille 1, pour la jonglerie et les supporters.",
    visuel: { motif: "football", decor: ["#7f1d1d", "#ef4444"], fond: "#ffffff", patch: "#dc2626", couture: "#450a0a" } },

  { nom: "Ballon Futsal Pro", categorie: "Futsal", taille: "4", prix: 119, stock: 30,
    description: "Ballon de futsal à rebond réduit, homologué pour la compétition en salle.",
    visuel: { motif: "football", decor: ["#312e81", "#818cf8"], fond: "#facc15", patch: "#1e3a8a", couture: "#1e1b4b" } },
  { nom: "Ballon Futsal Entraînement", categorie: "Futsal", taille: "4", prix: 65, stock: 50,
    description: "Ballon de futsal robuste pour les séances d'entraînement et le loisir.",
    visuel: { motif: "football", decor: ["#155e75", "#67e8f9"], fond: "#ffffff", patch: "#f97316", couture: "#164e63" } },

  { nom: "Ballon Handball Match", categorie: "Handball", taille: "3", prix: 129, stock: 20,
    description: "Ballon de handball taille 3 pour seniors hommes, excellente adhérence.",
    visuel: { motif: "hand", decor: ["#7c2d12", "#fb923c"], fond: "#f8fafc", bande: "#ea580c", couture: "#431407" } },
  { nom: "Ballon Handball Entraînement", categorie: "Handball", taille: "2", prix: 69, stock: 40,
    description: "Ballon taille 2 pour les femmes et les juniors.",
    visuel: { motif: "hand", decor: ["#581c87", "#c084fc"], fond: "#fef08a", bande: "#7e22ce", couture: "#3b0764" } },
  { nom: "Ballon Handball Mini", categorie: "Handball", taille: "1", prix: 45, stock: 3,
    description: "Ballon taille 1 pour l'initiation au handball à l'école.",
    visuel: { motif: "hand", decor: ["#065f46", "#34d399"], fond: "#ecfdf5", bande: "#059669", couture: "#064e3b" } },

  { nom: "Ballon Basketball Indoor", categorie: "Basketball", taille: "7", prix: 149, stock: 25,
    description: "Ballon en cuir composite pour parquet, prise en main premium.",
    visuel: { motif: "basket", decor: ["#1c1917", "#78716c"], fond: "#c2410c", couture: "#1c1917" } },
  { nom: "Ballon Basketball Outdoor", categorie: "Basketball", taille: "7", prix: 79, stock: 45,
    description: "Ballon en caoutchouc résistant pour les terrains extérieurs.",
    visuel: { motif: "basket", decor: ["#0c4a6e", "#38bdf8"], fond: "#ea580c", couture: "#27272a" } },
  { nom: "Ballon Basketball Taille 6", categorie: "Basketball", taille: "6", prix: 75, stock: 18,
    description: "Ballon taille 6 pour les équipes féminines et les cadets.",
    visuel: { motif: "basket", decor: ["#831843", "#f472b6"], fond: "#f97316", couture: "#3f3f46" } },
  { nom: "Ballon Basketball Mini", categorie: "Basketball", taille: "5", prix: 49, stock: 2,
    description: "Ballon taille 5 pour les enfants et le mini-basket.",
    visuel: { motif: "basket", decor: ["#3f6212", "#a3e635"], fond: "#fb923c", couture: "#27272a" } },

  { nom: "Ballon Volleyball Indoor", categorie: "Volleyball", taille: "5", prix: 99, stock: 30,
    description: "Ballon de volleyball doux au toucher pour la compétition en salle.",
    visuel: { motif: "volley", decor: ["#0f172a", "#475569"], couleurs: ["#facc15", "#1d4ed8", "#f8fafc"], couture: "#1e293b" } },
  { nom: "Ballon Beach-Volley", categorie: "Volleyball", taille: "5", prix: 69, stock: 3,
    description: "Ballon de beach-volley résistant au sable, au soleil et à l'eau.",
    visuel: { motif: "volley", decor: ["#0e7490", "#fde68a"], couleurs: ["#f97316", "#06b6d4", "#fef9c3"], couture: "#334155" } },
  // Never ordered in the demo: shows up in the "unsold products" statistics
  { nom: "Ballon Volleyball Loisir", categorie: "Volleyball", taille: "5", prix: 45, stock: 70,
    description: "Ballon léger pour le volley loisir, à la plage comme au jardin.",
    visuel: { motif: "volley", decor: ["#166534", "#86efac"], couleurs: ["#ffffff", "#16a34a", "#dc2626"], couture: "#14532d" } },
];

const PACKS = [
  { nom: "Pack Club Football", remise: 15,
    description: "10 ballons d'entraînement + 1 ballon de match : idéal pour les clubs et les académies.",
    lignes: [["Ballon Football Entraînement", 10], ["Ballon de Match Football Pro", 1]] },
  { nom: "Pack École de Basket", remise: 10,
    description: "6 ballons outdoor + 2 ballons mini pour les écoles et les centres de formation.",
    lignes: [["Ballon Basketball Outdoor", 6], ["Ballon Basketball Mini", 2]] },
  { nom: "Pack Handball Équipe", remise: 12,
    description: "8 ballons d'entraînement + 2 ballons de match pour une équipe complète.",
    lignes: [["Ballon Handball Entraînement", 8], ["Ballon Handball Match", 2]] },
];

// Sample customers for the demo orders (phone = customer identity, guest checkout)
const CLIENTS = [
  ["Ahmed Ben Salah", "20123456", "12 Rue de Marseille, Tunis"],
  ["Sami Trabelsi", "22345678", "Avenue Habib Bourguiba, Sfax"],
  ["Mariem Jlassi", "23456789", "Cité Ennasr 2, Ariana"],
  ["Youssef Gharbi", "24567890", "Route de la Plage, Sousse"],
  ["Ines Bouazizi", "25678901", "Rue Ibn Khaldoun, Monastir"],
  ["Karim Mejri", "26789012", "Hammamet Nord, Nabeul"],
  ["Nour Hammami", "27890123", "Rue de la République, Bizerte"],
  ["Mohamed Ayari", "28901234", "Avenue de France, Gabès"],
  ["Rania Chebbi", "29012345", "Houmt Souk, Djerba"],
  ["Bilel Khelifi", "50123456", "Cité El Khadra, Tunis"],
  ["Amine Zouari", "51234567", "Route de Tunis km 4, Sfax"],
  ["Hela Mansouri", "52345678", "Rue Okba Ibn Nafaa, Kairouan"],
  ["Club Espoir Rades", "53456789", "Stade municipal, Rades"],
  ["Académie Foot Sahel", "54567890", "Hammam Sousse"],
  ["Oussama Riahi", "55678901", "Rue de Gafsa, Gafsa"],
  ["Salma Ferchichi", "56789012", "Avenue Bourguiba, Le Kef"],
  ["Hamza Saidi", "58901234", "La Marsa Plage, Tunis"],
  ["Fatma Dridi", "90123456", "Centre ville, Béja"],
  ["Walid Jaziri", "92345678", "Mahdia corniche"],
  ["Ghassen Toumi", "94567890", "Cité Ezzouhour, Kasserine"],
];

// One-off customers are generated from these lists
const PRENOMS = ["Aziz", "Rim", "Skander", "Olfa", "Mehdi", "Yasmine", "Firas", "Asma", "Anis", "Emna", "Seif", "Chaima"];
const NOMS = ["Ben Ali", "Jebali", "Mabrouk", "Haddad", "Sassi", "Kammoun", "Brahmi", "Belhaj", "Masmoudi", "Chaouch"];
const VILLES = ["Tunis", "Sfax", "Sousse", "Ariana", "Nabeul", "Monastir", "Bizerte", "Kairouan", "Gabès", "Ben Arous",
  "Médenine", "Mahdia", "Jendouba", "Tozeur", "Sidi Bouzid", "Zaghouan", "Siliana", "Tataouine", "Kébili", "Manouba"];

// Best sellers appear several times so they are picked more often.
// "Ballon Volleyball Loisir" is left out on purpose (unsold product).
const POPULAIRES = [
  "Ballon Football Entraînement", "Ballon Football Entraînement", "Ballon Football Entraînement",
  "Ballon de Match Football Pro", "Ballon de Match Football Pro",
  "Ballon Football Junior", "Ballon Football Junior", "Ballon Football Kids", "Ballon Football Street",
  "Mini-Ballon Supporter", "Mini-Ballon Supporter",
  "Ballon Futsal Pro", "Ballon Futsal Entraînement",
  "Ballon Handball Match", "Ballon Handball Entraînement", "Ballon Handball Mini",
  "Ballon Basketball Indoor", "Ballon Basketball Outdoor", "Ballon Basketball Outdoor",
  "Ballon Basketball Taille 6", "Ballon Basketball Mini",
  "Ballon Volleyball Indoor", "Ballon Beach-Volley",
];

const NB_COMMANDES = 220;

// Deterministic pseudo-random generator: the demo data is identical on every run
const aleatoire = (() => {
  let graine = 20260101;
  return () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
})();
const choisir = (liste) => liste[Math.floor(aleatoire() * liste.length)];

// Same formula as calculerPrix in admin.pack.controller.js
const prixPack = (lignes, pourcentageRemise) =>
  Math.round(lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0) * (1 - pourcentageRemise / 100) * 100) / 100;

// Empties every table. Product images referenced in the database are removed from
// Cloudinary too, so repeated demos do not pile up orphan files.
async function viderBase() {
  if (isConfigured()) {
    const produits = await prisma.produit.findMany({ select: { imageUrl: true, images: { select: { url: true } } } });
    const urls = new Set(produits.flatMap((p) => [p.imageUrl, ...p.images.map((i) => i.url)]).filter(Boolean));
    await Promise.all([...urls].map(deleteImage));
  }
  // Children first (foreign keys); the offer <-> product links go with the offers
  await prisma.produitImage.deleteMany();
  await prisma.ligneCommande.deleteMany();
  await prisma.commande.deleteMany();
  await prisma.packProduit.deleteMany();
  await prisma.pack.deleteMany();
  await prisma.offre.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.administrateur.deleteMany();
}

// Uploads one view of the product illustration, converted to PNG by Cloudinary
async function envoyerImage(produit, vue) {
  const svg = genererSvg(produit.visuel, vue);
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const r = await cloudinary.uploader.upload(dataUri, { folder: FOLDER, resource_type: "image", format: "png" });
  return r.secure_url;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de démonstration : il vide la base, il ne doit pas être lancé en production.");
  }

  console.log("Emptying the database...");
  await viderBase();

  // Admin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from .env, otherwise a random password printed at the end
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@football-tunisie.tn";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url") + "A1!";
  const admin = await prisma.administrateur.create({
    data: { nom: "Administrateur", email: adminEmail, motDePasse: await bcrypt.hash(adminPassword, 12) },
  });

  const categories = {};
  for (const c of CATEGORIES) categories[c.nom] = await prisma.categorie.create({ data: c });
  console.log(`${CATEGORIES.length} categories created.`);

  // Products, with a gallery of 3 images each (NB_VUES) when Cloudinary is configured
  const avecImages = isConfigured();
  if (!avecImages) console.log("CLOUDINARY_* missing in .env: products are created without images.");
  const produits = {};
  for (const p of PRODUITS) {
    const urls = avecImages
      ? await Promise.all(Array.from({ length: NB_VUES }, (_, vue) => envoyerImage(p, vue)))
      : [];
    produits[p.nom] = await prisma.produit.create({
      data: {
        nom: p.nom, taille: p.taille, prix: p.prix, stock: p.stock, description: p.description,
        categorieId: categories[p.categorie].id,
        imageUrl: urls[0] || null,
        images: { create: urls.map((url, ordre) => ({ url, ordre })) },
      },
    });
    if (avecImages) process.stdout.write(".");
  }
  if (avecImages) process.stdout.write("\n");
  console.log(`${PRODUITS.length} products created${avecImages ? ` with ${NB_VUES} images each` : ""}.`);

  const packs = [];
  for (const { nom, description, remise, lignes } of PACKS) {
    const contenu = lignes.map(([nomProduit, quantite]) => ({ produit: produits[nomProduit], quantite }));
    packs.push(await prisma.pack.create({
      data: {
        nom, description, pourcentageRemise: remise, prixPack: prixPack(contenu, remise),
        produits: { create: contenu.map((l) => ({ produitId: l.produit.id, quantite: l.quantite })) },
      },
    }));
  }
  console.log(`${PACKS.length} packs created.`);

  // Offers: one finished (in the order history), one running (visible in the store), one planned
  const now = new Date();
  const jour = (decalage, h = 0, m = 0, s = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + decalage, h, m, s);
  const creerOffre = (titre, pourcentageReduction, dateDebut, dateFin, nomsProduits) =>
    prisma.offre.create({
      data: {
        titre, pourcentageReduction, dateDebut, dateFin,
        produits: { connect: nomsProduits.map((nom) => ({ id: produits[nom].id })) },
      },
      include: { produits: { select: { id: true } } },
    });
  const offres = [
    await creerOffre("Soldes d'Été", 20, jour(-100), jour(-70, 23, 59, 59),
      ["Ballon Football Entraînement", "Ballon Futsal Pro", "Ballon Basketball Indoor", "Ballon Beach-Volley"]),
    await creerOffre("Promo du Mois", 15, jour(-5), jour(25, 23, 59, 59),
      ["Ballon Football Junior", "Ballon Handball Entraînement", "Ballon Basketball Outdoor", "Ballon Volleyball Indoor"]),
    await creerOffre("Week-end Spécial Clubs", 25, jour(10), jour(13, 23, 59, 59),
      ["Ballon de Match Football Pro", "Ballon Handball Match"]),
  ];
  console.log(`${offres.length} offers created (finished, running, planned).`);

  // Orders over the last 6 months, to feed the statistics dashboard
  const heures = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22, 23];
  const populaires = POPULAIRES.map((nom) => produits[nom]);
  let derniere = null;

  for (let i = 0; i < NB_COMMANDES; i++) {
    // More orders in recent weeks: the business is growing
    const joursAvant = Math.floor(180 * (1 - Math.sqrt(aleatoire())));
    let dateCommande = jour(-joursAvant, choisir(heures), Math.floor(aleatoire() * 60));
    if (dateCommande > now) dateCommande = new Date(now.getTime() - 60 * 60 * 1000);

    // A core of loyal customers, regular ones, and many one-off buyers
    const r0 = aleatoire();
    const [nomClient, telephoneClient, adresseLivraison] =
      r0 < 0.3 ? choisir(CLIENTS.slice(0, 8))
      : r0 < 0.5 ? choisir(CLIENTS)
      : [`${choisir(PRENOMS)} ${choisir(NOMS)}`, String(97000000 + i), `Rue ${i + 1}, ${choisir(VILLES)}`];

    const lignes = [];
    if (aleatoire() < 0.07) {
      const pack = choisir(packs);
      lignes.push({ quantite: 1, prixInitiale: pack.prixPack, packId: pack.id });
    } else {
      const nbArticles = 1 + Math.floor(aleatoire() * aleatoire() * 3);
      const choisis = new Set();
      while (choisis.size < nbArticles) choisis.add(choisir(populaires));
      for (const produit of choisis) {
        const offre = offres.find(
          (o) => dateCommande >= o.dateDebut && dateCommande <= o.dateFin && o.produits.some((p) => p.id === produit.id)
        );
        lignes.push({
          quantite: aleatoire() < 0.75 ? 1 : 2 + Math.floor(aleatoire() * 2),
          prixInitiale: produit.prix,
          produitId: produit.id,
          ...(offre && { offreId: offre.id, reduction: offre.pourcentageReduction }),
        });
      }
    }

    // Same total computation as passerCommande
    const total = lignes.reduce((s, l) => s + l.prixInitiale * (1 - (l.reduction || 0) / 100) * l.quantite, 0);

    // Older orders are settled, recent ones are still being processed
    const r = aleatoire();
    const statut =
      joursAvant > 7 ? (r < 0.88 ? "livree" : "annulee")
      : joursAvant > 2 ? (r < 0.5 ? "livree" : r < 0.8 ? "confirmee" : r < 0.92 ? "en_attente" : "annulee")
      : r < 0.6 ? "en_attente" : "confirmee";

    const commande = await prisma.commande.create({
      data: {
        nomClient, telephoneClient, adresseLivraison, dateCommande, statut,
        fraisLivraison: FRAIS_LIVRAISON,
        total: totalAvecLivraison(total),
        lignes: { create: lignes.map(({ reduction, ...l }) => ({ ...l, createdAt: dateCommande })) },
        createdAt: dateCommande,
      },
    });
    if (!derniere || dateCommande > derniere.dateCommande) derniere = commande;
  }
  console.log(`${NB_COMMANDES} orders created over the last 6 months.`);

  console.log("\nDemo data ready.");
  console.log(`Back office login: ${adminEmail} / ${adminPassword}`);
  console.log(`Order to try the store tracking page: ${derniere.id}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
