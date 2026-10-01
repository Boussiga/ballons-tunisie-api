const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Démarrage du seed...");

  // Créer l'administrateur par défaut
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
  console.log("Admin créé:", admin.email);

  // Créer des produits de base
  const produits = await Promise.all([
    prisma.produit.upsert({
      where: { id: 1 },
      update: {},
      create: {
        nom: "Maillot Équipe Nationale Tunisie 2024",
        categorie: "Maillots",
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
        categorie: "Shorts",
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
        categorie: "Accessoires",
        taille: "Unique",
        prix: 12.99,
        stock: 100,
        description: "Chaussettes football anti-dérapantes.",
      },
    }),
  ]);
  console.log(`✅ ${produits.length} produits créés.`);

  // Créer un pack
  const pack = await prisma.pack.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nom: "Pack Complet Tunisie 2024",
      description: "Maillot + Short + Chaussettes",
      prixPack: 129.99,
      produits: {
        create: [
          { produitId: produits[0].id, quantite: 1 },
          { produitId: produits[1].id, quantite: 1 },
          { produitId: produits[2].id, quantite: 1 },
        ],
      },
    },
  });
  console.log("✅ Pack créé:", pack.nom);

  // Créer une offre
  const offre = await prisma.offre.upsert({
    where: { id: 1 },
    update: {},
    create: {
      titre: "Soldes Automne 2024",
      pourcentageReduction: 15,
      dateDebut: new Date("2024-10-01"),
      dateFin: new Date("2024-10-31"),
    },
  });
  console.log("✅ Offre créée:", offre.titre);

  console.log("\n🎉 Seed terminé avec succès!");
  console.log("📧 Email admin:", admin.email);
  console.log("🔑 Mot de passe admin: Admin@2024");
}

main()
  .catch((e) => {
    console.error("Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
