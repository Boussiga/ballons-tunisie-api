const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/prisma");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère un access token JWT (courte durée : 15 minutes)
 */
const generateAccessToken = (admin) => {
  return jwt.sign(
    { id: admin.id, email: admin.email, nom: admin.nom },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

/**
 * Génère un refresh token opaque (longue durée : 7 jours)
 * Stocké en base pour permettre la révocation
 */
const generateRefreshToken = async (adminId) => {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: { token, adminId, expiresAt },
  });

  return token;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc  Connexion administrateur — renvoie access + refresh token
 * @route POST /api/admin/login
 * @access Public
 */
const login = async (req, res) => {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res
      .status(400)
      .json({ message: "Email et mot de passe sont requis." });
  }

  try {
    const admin = await prisma.administrateur.findUnique({ where: { email } });

    if (!admin) {
      return res.status(401).json({ message: "Identifiants incorrects." });
    }

    const isMatch = await bcrypt.compare(motDePasse, admin.motDePasse);
    if (!isMatch) {
      return res.status(401).json({ message: "Identifiants incorrects." });
    }

    const accessToken = generateAccessToken(admin);
    const refreshToken = await generateRefreshToken(admin.id);

    res.status(200).json({
      message: "Connexion réussie.",
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // seconds
      admin: { id: admin.id, nom: admin.nom, email: admin.email },
    });
  } catch (error) {
    console.error("Erreur login:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Renouveler l'access token via le refresh token
 * @route POST /api/admin/refresh
 * @access Public (mais nécessite un refresh token valide)
 */
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Refresh token manquant." });
  }

  try {
    // Find refresh token in DB
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { admin: true },
    });

    // Token not found
    if (!stored) {
      return res
        .status(401)
        .json({ message: "Refresh token invalide." });
    }

    // Token revoked
    if (stored.revokedAt !== null) {
      return res
        .status(401)
        .json({ message: "Refresh token révoqué. Veuillez vous reconnecter." });
    }

    // Token expired
    if (new Date() > new Date(stored.expiresAt)) {
      // Delete expired token
      await prisma.refreshToken.delete({ where: { token } });
      return res
        .status(401)
        .json({ message: "Refresh token expiré. Veuillez vous reconnecter." });
    }

    // ✅ Token valide — générer un nouvel access token + rotation du refresh token
    const newAccessToken = generateAccessToken(stored.admin);

    // Rotation: revoke old refresh token and create a new one
    await prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
    const newRefreshToken = await generateRefreshToken(stored.admin.id);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    });
  } catch (error) {
    console.error("Erreur refreshToken:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Déconnexion — révoque le refresh token
 * @route POST /api/admin/logout
 * @access Private
 */
const logout = async (req, res) => {
  const { refreshToken: token } = req.body;

  try {
    if (token) {
      // Revoke refresh token in DB
      await prisma.refreshToken.updateMany({
        where: { token, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.status(200).json({ message: "Déconnexion réussie." });
  } catch (error) {
    console.error("Erreur logout:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Déconnexion de toutes les sessions (révoquer tous les refresh tokens)
 * @route POST /api/admin/logout-all
 * @access Private
 */
const logoutAll = async (req, res) => {
  try {
    const count = await prisma.refreshToken.updateMany({
      where: { adminId: req.admin.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.status(200).json({
      message: `Toutes les sessions déconnectées (${count.count} session(s) révoquée(s)).`,
    });
  } catch (error) {
    console.error("Erreur logoutAll:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Créer un compte administrateur (setup initial)
 * @route POST /api/admin/register
 * @access Public (à sécuriser en production)
 */
const register = async (req, res) => {
  const { nom, email, motDePasse } = req.body;

  if (!nom || !email || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  try {
    const existingAdmin = await prisma.administrateur.findUnique({
      where: { email },
    });
    if (existingAdmin) {
      return res.status(409).json({ message: "Cet email est déjà utilisé." });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 12);

    const admin = await prisma.administrateur.create({
      data: { nom, email, motDePasse: hashedPassword },
    });

    res.status(201).json({
      message: "Administrateur créé avec succès.",
      admin: { id: admin.id, nom: admin.nom, email: admin.email },
    });
  } catch (error) {
    console.error("Erreur register:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Obtenir le profil de l'admin connecté
 * @route GET /api/admin/profil
 * @access Private
 */
const getProfil = async (req, res) => {
  try {
    const admin = await prisma.administrateur.findUnique({
      where: { id: req.admin.id },
      select: { id: true, nom: true, email: true, createdAt: true },
    });

    if (!admin) {
      return res.status(404).json({ message: "Administrateur introuvable." });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error("Erreur getProfil:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Modifier le profil de l'admin connecté (nom, email, mot de passe optionnel)
 * @route PUT /api/auth/profil
 * @access Private
 */
const updateProfil = async (req, res) => {
  const { nom, email, motDePasse } = req.body;

  try {
    const existing = await prisma.administrateur.findUnique({ where: { email } });
    if (existing && existing.id !== req.admin.id) {
      return res.status(409).json({ message: "Cet email est déjà utilisé." });
    }

    const data = { nom, email };
    if (motDePasse) data.motDePasse = await bcrypt.hash(motDePasse, 12);

    const admin = await prisma.administrateur.update({
      where: { id: req.admin.id },
      data,
      select: { id: true, nom: true, email: true },
    });

    res.status(200).json(admin);
  } catch (error) {
    console.error("Erreur updateProfil:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * @desc  Change admin password — revokes all sessions after change
 * @route PATCH /api/auth/profil/password
 * @access Private
 */
const updatePassword = async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  try {
    const admin = await prisma.administrateur.findUnique({ where: { id: req.admin.id } });
    if (!admin) return res.status(404).json({ message: "Administrateur introuvable." });

    const isMatch = await bcrypt.compare(ancienMotDePasse, admin.motDePasse);
    if (!isMatch) return res.status(401).json({ message: "Ancien mot de passe incorrect." });

    const hashed = await bcrypt.hash(nouveauMotDePasse, 12);
    await prisma.administrateur.update({ where: { id: admin.id }, data: { motDePasse: hashed } });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { adminId: admin.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.status(200).json({ message: "Mot de passe mis à jour. Veuillez vous reconnecter." });
  } catch (error) {
    console.error("Erreur updatePassword:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { login, refreshToken, logout, logoutAll, register, getProfil, updateProfil, updatePassword };
