-- CreateTable
CREATE TABLE "administrateurs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "produits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "taille" TEXT,
    "prix" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "packs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prixPack" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pack_produits" (
    "packId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("packId", "produitId"),
    CONSTRAINT "pack_produits_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pack_produits_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "produits" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "offres" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titre" TEXT NOT NULL,
    "pourcentageReduction" REAL NOT NULL,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomClient" TEXT NOT NULL,
    "telephoneClient" TEXT NOT NULL,
    "adresseLivraison" TEXT NOT NULL,
    "dateCommande" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ligne_commandes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commandeId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixInitiale" REAL NOT NULL,
    "produitId" INTEGER,
    "packId" INTEGER,
    "offreId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ligne_commandes_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ligne_commandes_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "produits" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ligne_commandes_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ligne_commandes_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "offres" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "administrateurs_email_key" ON "administrateurs"("email");
