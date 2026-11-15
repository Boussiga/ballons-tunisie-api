// Usage: npm run admin:create
// Creates the first back-office account, and nothing else: safe on the production database.
// Reads SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from the environment (.env).
// If the account already exists it is left unchanged (its password is not replaced).
// Other admins are then created from the back office.
require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { registerSchema } = require("../validations/auth.validation");

const PRODUCTION = process.env.NODE_ENV === "production";
const MIN_PRODUCTION = 12;

(async () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const motDePasse = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !motDePasse) {
    throw new Error("Définissez SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD dans l'environnement (.env).");
  }

  // Same rules as an admin created from the back office, longer password in production
  const resultat = registerSchema.body.safeParse({ nom: "Administrateur", email, motDePasse });
  if (!resultat.success) throw new Error(resultat.error.issues.map((i) => i.message).join(" "));
  if (PRODUCTION && motDePasse.length < MIN_PRODUCTION) {
    throw new Error(`En production, le mot de passe doit contenir au moins ${MIN_PRODUCTION} caractères.`);
  }

  const existant = await prisma.administrateur.findUnique({ where: { email: resultat.data.email } });
  if (existant) {
    console.log(`Le compte ${existant.email} existe déjà : rien n'a été modifié.`);
    return;
  }

  await prisma.administrateur.create({
    data: { nom: "Administrateur", email: resultat.data.email, motDePasse: await bcrypt.hash(motDePasse, 12) },
  });
  console.log(`Compte administrateur créé : ${resultat.data.email}`);
  console.log("Retirez SEED_ADMIN_PASSWORD du .env du serveur une fois connecté, et changez le mot de passe depuis le profil.");
})()
  .catch((e) => {
    console.error("Erreur :", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
