const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

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

  // Create categories
  const [catMaillots, catShorts, catAccessoires] = await Promise.all([
    prisma.categorie.upsert({
      where: { nom: "Maillots" },
      update: {},
      create: { nom: "Maillots", description: "Maillots de football officiels" },
    }),
    prisma.categorie.upsert({
      where: { nom: "Shorts" },
      update: {},
      create: { nom: "Shorts", description: "Shorts de football" },
    }),
    prisma.categorie.upsert({
      where: { nom: "Accessoires" },
      update: {},
      create: { nom: "Accessoires", description: "Chaussettes, gants, etc." },
    }),
  ]);
  console.log("✅ 3 categories created.");

  // Create products using categorieId (relation)
  const [p1, p2, p3] = await Promise.all([
    prisma.produit.upsert({
      where: { id: 1 },
      update: {},
      create: {
        nom: "Maillot Équipe Nationale Tunisie 2024",
        categorieId: catMaillots.id,
        taille: "M",
        prix: 89.99,
        stock: 50,
        description: "Maillot officiel de l'équipe nationale tunisienne.",
      },
    }),
    prisma.produit.upsert({
      where: { id: 2 },
      update: {},
      create: {
        nom: "Short Football Blanc",
        categorieId: catShorts.id,
        taille: "L",
        prix: 34.99,
        stock: 30,
        description: "Short de football léger et confortable.",
      },
    }),
    prisma.produit.upsert({
      where: { id: 3 },
      update: {},
      create: {
        nom: "Chaussettes Football Rouge",
        categorieId: catAccessoires.id,
        taille: "Unique",
        prix: 12.99,
        stock: 100,
        description: "Chaussettes football anti-dérapantes.",
      },
    }),
  ]);
  console.log("✅ 3 products created.");

  // Create pack (UUID auto-generated — no fixed id)
  const existingPack = await prisma.pack.findFirst({ where: { nom: "Pack Complet Tunisie 2024" } });
  if (!existingPack) {
    await prisma.pack.create({
      data: {
        nom: "Pack Complet Tunisie 2024",
        description: "Maillot + Short + Chaussettes",
        prixPack: 129.99,
        produits: {
          create: [
            { produitId: p1.id, quantite: 1 },
            { produitId: p2.id, quantite: 1 },
            { produitId: p3.id, quantite: 1 },
          ],
        },
      },
    });
    console.log("✅ Pack created.");
  } else {
    console.log("⏭️  Pack already exists, skipped.");
  }

  // Create offer (UUID auto-generated — no fixed id)
  const existingOffre = await prisma.offre.findFirst({ where: { titre: "Soldes Automne 2024" } });
  if (!existingOffre) {
    await prisma.offre.create({
      data: {
        titre: "Soldes Automne 2024",
        pourcentageReduction: 15,
        dateDebut: new Date("2024-10-01"),
        dateFin: new Date("2024-10-31"),
      },
    });
    console.log("✅ Offre created.");
  } else {
    console.log("⏭️  Offre already exists, skipped.");
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
