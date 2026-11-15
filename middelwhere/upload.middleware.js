const multer = require("multer");
const { cloudinary, FOLDER, isConfigured } = require("../config/cloudinary");
const { MAX_IMAGES } = require("../utils/produitImages");

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per image
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

// Files are kept in memory only (never written to disk) then streamed to Cloudinary.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: MAX_IMAGES },
  fileFilter: (req, file, cb) =>
    ALLOWED_MIME.includes(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error("Format non supporté. Utilisez JPG, PNG ou WebP."), { status: 400 })),
});

// The client-sent MIME type can be forged: check the real file signature (magic bytes).
const detectImageType = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
};

/**
 * Step 1: parse the multipart images into req.files (memory), at most MAX_IMAGES.
 * - "images": new images, added to the product gallery
 * - "image":  one image replacing the main image (field used before the gallery existed)
 * req.imagePrincipale is set when the "image" field was sent.
 */
const parseImages = (req, res, next) => {
  multerUpload.fields([
    { name: "images", maxCount: MAX_IMAGES },
    { name: "image", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return next(err);
    const champs = req.files || {};
    req.imagePrincipale = Boolean(champs.image && champs.image.length);
    req.files = [...(champs.image || []), ...(champs.images || [])]; // replacing image first
    if (req.files.length > MAX_IMAGES) {
      return res.status(400).json({ message: `Maximum ${MAX_IMAGES} images par produit.` });
    }
    if (req.files.some((f) => !detectImageType(f.buffer))) {
      return res.status(400).json({ message: "Fichier invalide : ce n'est pas une image JPG, PNG ou WebP." });
    }
    next();
  });
};

const envoyerFichier = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "image", allowed_formats: ["jpg", "jpeg", "png", "webp"] },
      (error, result) => (error || !result ? reject(error || new Error("empty result")) : resolve(result))
    );
    stream.end(file.buffer);
  });

/**
 * Step 2: send req.files to Cloudinary (run AFTER validation so rejected requests
 * never create orphan images). Sets url and publicId on each file.
 * All or nothing: if one upload fails, the others are removed.
 */
const uploadToCloudinary = async (req, res, next) => {
  const files = req.files || [];
  if (files.length === 0) return next();
  if (!isConfigured()) {
    return res.status(503).json({ message: "Stockage d'images non configuré (variables CLOUDINARY_*)." });
  }

  const resultats = await Promise.allSettled(files.map(envoyerFichier));
  const echec = resultats.find((r) => r.status === "rejected");
  if (echec) {
    console.error("Cloudinary upload error:", echec.reason && echec.reason.message);
    await Promise.all(
      resultats.filter((r) => r.status === "fulfilled").map((r) => deleteImage(r.value.public_id))
    );
    return res.status(502).json({ message: "Échec de l'envoi des images. Réessayez." });
  }
  resultats.forEach((r, i) => {
    files[i].url = r.value.secure_url;
    files[i].publicId = r.value.public_id;
  });
  next();
};

/** Removes from Cloudinary the files uploaded for a request that then failed. */
const supprimerEnvois = (files) => Promise.all((files || []).map((f) => deleteImage(f.publicId)));

/** Derive the Cloudinary public_id from a stored URL (null if it isn't ours). */
const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com")) return null;
  const m = url.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?([^?]+?)\.[a-z0-9]+(?:\?.*)?$/i);
  return m ? m[1] : null;
};

/** Best-effort delete: never throws (a leftover image must not break a request). */
const deleteImage = async (urlOrPublicId) => {
  if (!urlOrPublicId || !isConfigured()) return;
  if (urlOrPublicId.startsWith("/")) return; // legacy local /uploads path: nothing on Cloudinary
  const publicId = urlOrPublicId.startsWith("http") ? publicIdFromUrl(urlOrPublicId) : urlOrPublicId;
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (e) {
    console.error("Cloudinary delete error:", e.message);
  }
};

module.exports = { parseImages, uploadToCloudinary, supprimerEnvois, deleteImage, publicIdFromUrl, detectImageType };
