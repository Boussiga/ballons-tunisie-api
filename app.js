require("dotenv").config();
const http = require("http");
const express = require("express");
const path = require("path");
const morgan = require("morgan");
const { globalLimiter } = require("./config/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3000;
const cors = require("cors");

app.use(cors({
  origin: process.env.FRONTEND_URL
}));


// ─── Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (méthode, url, status, temps de réponse)
app.use(morgan("dev"));

// Global rate limiter applied to all /api routes
app.use("/api", globalLimiter);

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Admin Routes
app.use("/api/auth", require("./router/admin.auth.router"));
app.use("/api/admin/produits", require("./router/admin.produit.router"));
app.use("/api/admin/categories", require("./router/admin.categorie.router"));
app.use("/api/admin/packs", require("./router/admin.pack.router"));
app.use("/api/admin/offres", require("./router/admin.offre.router"));
app.use("/api/admin/commandes", require("./router/admin.commande.router"));
app.use("/api/admin/dashboard", require("./router/admin.dashboard.router"));

// ─── 404
app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable." });
});

// ─── Global Error Handler
app.use((err, req, res, next) => {
  console.error(`Unhandled error: ${err.message}`);

  // Multer error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Fichier trop volumineux. Max 5 Mo." });
  }

  res.status(500).json({ message: err.message || "Erreur serveur interne." });
});

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(app);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(` Le port ${PORT} est déjà utilisé.`);
  } else if (error.code === "EACCES") {
    console.error(` Permission refusée pour le port ${PORT}.`);
  } else {
    console.error(`Erreur serveur : ${error.message}`);
  }
  process.exit(1);
});

server.listen(PORT, async () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);

  // Test database connection
  try {
    const prisma = require("./config/prisma");
    await prisma.$connect();
    console.log("Connexion à la base de données réussie !");
  } catch (error) {
    console.error(`❌ Erreur de connexion à la base de données : ${error.message}`);
  }
});
