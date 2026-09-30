require("dotenv").config();
const express = require("express");
const path = require("path");
const { globalLimiter } = require("./config/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter global appliqué à toutes les routes /api
app.use("/api", globalLimiter);

// Servir les images uploadées
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes Admin
app.use("/api/admin", require("./router/admin.auth.router"));
app.use("/api/admin/produits", require("./router/admin.produit.router"));
app.use("/api/admin/packs", require("./router/admin.pack.router"));
app.use("/api/admin/offres", require("./router/admin.offre.router"));
app.use("/api/admin/commandes", require("./router/admin.commande.router"));
app.use("/api/admin/dashboard", require("./router/admin.dashboard.router"));


// ─── Gestionnaire d'erreurs global 
app.use((err, req, res, next) => {
  console.error("Erreur non gérée:", err.message);

  // Erreur multer
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Fichier trop volumineux. Max 5 Mo." });
  }

  res.status(500).json({ message: err.message || "Erreur serveur interne." });
});

// ─── Démarrage du serveur 
app.listen(PORT, async () => {
  console.log(` Serveur démarré sur http://localhost:${PORT}`);
  
  // Test de connexion à la base de données
  try {
    const prisma = require("./config/prisma");
    await prisma.$connect();
    console.log(" Connexion à la base de données réussie avec succès !");
  } catch (error) {
    console.error(" Erreur de connexion à la base de données :", error.message);
  }
});