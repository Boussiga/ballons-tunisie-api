const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// The shop only sells balls for now: one category per sport
const CATEGORIES = [
  { nom: "Football", description: "Ballons de football : match, entraînement et loisir" },
  { nom: "Futsal", description: "Ballons de futsal à rebond contrôlé" },
  { nom: "Handball", description: "Ballons de handball tailles 1 à 3" },
  { nom: "Basketball", description: "Ballons de basketball intérieur et extérieur" },
  { nom: "Volleyball", description: "Ballons de volleyball indoor et beach" },
];

// taille = official ball size (max 10 characters, see produit.validation.js)
const PRODUITS = [
  { nom: "Ballon de Match Football Pro", categorie: "Football", taille: "5", prix: 249.0, stock: 25,
    description: "Ballon de match thermosoudé, homologué FIFA Quality Pro." },
  { nom: "Ballon Football Entraînement", categorie: "Football", taille: "5", prix: 59.0, stock: 120,
    description: "Ballon d'entraînement cousu machine, résistant sur tous terrains." },
  { nom: "Ballon Football Junior", categorie: "Football", taille: "4", prix: 49.0, stock: 80,
    description: "Ballon taille 4 pour les jeunes de 8 à 12 ans." },
  { nom: "Mini-Ballon Football", categorie: "Football", taille: "1", prix: 25.0, stock: 60,
    description: "Mini-ballon taille 1 pour la jonglerie et les supporters." },
  { nom: "Ballon Futsal Pro", categorie: "Futsal", taille: "4", prix: 119.0, stock: 30,
    description: "Ballon de futsal à rebond réduit, pour salle." },
  { nom: "Ballon Handball Match", categorie: "Handball", taille: "3", prix: 129.0, stock: 20,
    description: "Ballon de handball taille 3 pour seniors hommes." },
  { nom: "Ballon Handball Entraînement", categorie: "Handball", taille: "2", prix: 69.0, stock: 40,
    description: "Ballon taille 2 pour femmes et juniors." },
  { nom: "Ballon Basketball Indoor", categorie: "Basketball", taille: "7", prix: 149.0, stock: 25,
    description: "Ballon en cuir composite pour parquet." },
  { nom: "Ballon Basketball Outdoor", categorie: "Basketball", taille: "7", prix: 79.0, stock: 45,
    description: "Ballon en caoutchouc résistant pour terrains extérieurs." },
  { nom: "Ballon Volleyball Indoor", categorie: "Volleyball", taille: "5", prix: 99.0, stock: 30,
    description: "Ballon de volleyball doux au toucher pour salle." },
  { nom: "Ballon Beach-Volley", categorie: "Volleyball", taille: "5", prix: 69.0, stock: 3,
    description: "Ballon de beach-volley résistant au sable et à l'eau." },
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

// Deterministic pseudo-random generator: the demo data is identical on every machine
const aleatoire = (() => {
  let graine = 20260101;
  return () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
})();
const choisir = (liste) => liste[Math.floor(aleatoire() * liste.length)];

// One-off customers are generated from these lists
const PRENOMS = ["Aziz", "Rim", "Skander", "Olfa", "Mehdi", "Yasmine", "Firas", "Asma", "Anis", "Emna", "Seif", "Chaima"];
const NOMS = ["Ben Ali", "Jebali", "Mabrouk", "Haddad", "Sassi", "Kammoun", "Brahmi", "Belhaj", "Masmoudi", "Chaouch"];
const VILLES = ["Tunis", "Sfax", "Sousse", "Ariana", "Nabeul", "Monastir", "Bizerte", "Kairouan", "Gabès", "Ben Arous",
  "Médenine", "Mahdia", "Jendouba", "Tozeur", "Sidi Bouzid", "Zaghouan", "Siliana", "Tataouine", "Kébili", "Manouba"];

// Same formula as calculerPrix in admin.pack.controller.js
const prixPack = (lignes, pourcentageRemise) =>
  Math.round(lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0) * (1 - pourcentageRemise / 100) * 100) / 100;

async function main() {
  console.log("Starting seed...");

  // Create default admin
  const hashedPassword = await bcrypt.hash("Admin@2024", 12);
  const admin = await prisma.administrateur.upsert({
    where: { email: "admin@football-tunisie.tn" },
    update: {},
    create: {
      nom: "Administrateur",
      email: "admin@football-tunisie.tn",
      motDePasse: hashedPassword,
    },
  });
  console.log("✅ Admin created:", admin.email);

  // Categories (nom is unique)
  const categories = {};
  for (const c of CATEGORIES) {
    categories[c.nom] = await prisma.categorie.upsert({ where: { nom: c.nom }, update: {}, create: c });
  }
  console.log(`✅ ${CATEGORIES.length} categories ready.`);

  // Products — matched by name so existing rows (and admin edits) are kept
  const produits = {};
  let crees = 0;
  for (const { categorie, ...data } of PRODUITS) {
    let produit = await prisma.produit.findFirst({ where: { nom: data.nom } });
    if (!produit) {
      produit = await prisma.produit.create({ data: { ...data, categorieId: categories[categorie].id } });
      crees += 1;
    }
    produits[data.nom] = produit;
  }
  console.log(`✅ ${crees} products created, ${PRODUITS.length - crees} already existed.`);

  // Pack (UUID auto-generated — no fixed id)
  const nomPack = "Pack Club Football";
  let pack = await prisma.pack.findFirst({ where: { nom: nomPack } });
  if (!pack) {
    const lignes = [
      { produit: produits["Ballon Football Entraînement"], quantite: 10 },
      { produit: produits["Ballon de Match Football Pro"], quantite: 1 },
    ];
    pack = await prisma.pack.create({
      data: {
        nom: nomPack,
        description: "10 ballons d'entraînement + 1 ballon de match, idéal pour les clubs et académies",
        prixPack: prixPack(lignes, 15),
        pourcentageRemise: 15,
        produits: { create: lignes.map((l) => ({ produitId: l.produit.id, quantite: l.quantite })) },
      },
    });
    console.log("✅ Pack created.");
  } else {
    console.log("⏭️  Pack already exists, skipped.");
  }

  // Offers (UUID auto-generated — matched by title)
  const now = new Date();
  const jour = (decalage, h = 0, m = 0, s = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + decalage, h, m, s);

  const creerOffre = async (titre, pourcentageReduction, dateDebut, dateFin, nomsProduits) => {
    const existing = await prisma.offre.findFirst({ where: { titre }, include: { produits: { select: { id: true } } } });
    if (existing) {
      console.log(`⏭️  Offre "${titre}" already exists, skipped.`);
      return existing;
    }
    const offre = await prisma.offre.create({
      data: {
        titre,
        pourcentageReduction,
        dateDebut,
        dateFin,
        produits: { connect: nomsProduits.map((nom) => ({ id: produits[nom].id })) },
      },
      include: { produits: { select: { id: true } } },
    });
    console.log(`✅ Offre "${titre}" created.`);
    return offre;
  };

  const offres = [
    // Past summer sale, so the order history includes discounted sales
    await creerOffre("Soldes d'Été", 20, jour(-100), jour(-70, 23, 59, 59), [
      "Ballon Football Entraînement",
      "Ballon Futsal Pro",
      "Ballon Basketball Indoor",
    ]),
    // Active from today for one month, so it shows up in the store right away
    await creerOffre("Rentrée Sportive", 15, jour(0), jour(30, 23, 59, 59), [
      "Ballon Football Junior",
      "Ballon Handball Entraînement",
      "Ballon Basketball Outdoor",
    ]),
  ];

  // Demo orders over the last 6 months, to feed the statistics dashboard.
  // Only on an empty table: never mixed with real orders.
  if ((await prisma.commande.count()) > 0) {
    console.log("⏭️  Orders already exist, demo orders skipped.");
  } else {
    // Best sellers appear several times so they are picked more often
    const populaires = [
      "Ballon Football Entraînement", "Ballon Football Entraînement", "Ballon Football Entraînement",
      "Ballon de Match Football Pro", "Ballon de Match Football Pro",
      "Ballon Football Junior", "Ballon Football Junior",
      "Mini-Ballon Football", "Ballon Futsal Pro", "Ballon Handball Match", "Ballon Handball Entraînement",
      "Ballon Basketball Indoor", "Ballon Basketball Outdoor", "Ballon Basketball Outdoor",
      "Ballon Volleyball Indoor", "Ballon Beach-Volley",
    ].map((nom) => produits[nom]);
    const heures = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22, 23];
    const NB_COMMANDES = 160;
    let creees = 0;

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
      if (aleatoire() < 0.06) {
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
        : joursAvant > 2 ? (r < 0.5 ? "livree" : r < 0.85 ? "confirmee" : r < 0.93 ? "en_attente" : "annulee")
        : r < 0.6 ? "en_attente" : "confirmee";

      await prisma.commande.create({
        data: {
          nomClient,
          telephoneClient,
          adresseLivraison,
          dateCommande,
          statut,
          total: parseFloat(total.toFixed(2)),
          lignes: { create: lignes.map(({ reduction, ...l }) => ({ ...l, createdAt: dateCommande })) },
          createdAt: dateCommande,
        },
      });
      creees += 1;
    }
    console.log(`✅ ${creees} demo orders created over the last 6 months.`);
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("📧 Admin email:", admin.email);
  console.log("🔑 Admin password: Admin@2024");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
