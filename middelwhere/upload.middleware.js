const multer = require("multer");
const { cloudinary, FOLDER, isConfigured } = require("../config/cloudinary");

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

// Files are kept in memory only (never written to disk) then streamed to Cloudinary.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
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

/** Step 1: parse the multipart "image" field into req.file (memory). */
const parseImage = (req, res, next) => {
  multerUpload.single("image")(req, res, (err) => {
    if (err) return next(err);
    if (req.file && !detectImageType(req.file.buffer)) {
      return res.status(400).json({ message: "Fichier invalide : ce n'est pas une image JPG, PNG ou WebP." });
    }
    next();
  });
};

/**
 * Step 2: send req.file to Cloudinary (run AFTER validation so rejected requests
 * never create orphan images). Sets req.file.url and req.file.publicId.
 */
const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();
  if (!isConfigured()) {
    return res.status(503).json({ message: "Stockage d'images non configuré (variables CLOUDINARY_*)." });
  }

  const stream = cloudinary.uploader.upload_stream(
    {
      folder: FOLDER,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
    (error, result) => {
      if (error || !result) {
        console.error("Cloudinary upload error:", error && error.message);
        return res.status(502).json({ message: "Échec de l'envoi de l'image. Réessayez." });
      }
      req.file.url = result.secure_url;
      req.file.publicId = result.public_id;
      next();
    }
  );
  stream.end(req.file.buffer);
};

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

module.exports = { parseImage, uploadToCloudinary, deleteImage, publicIdFromUrl, detectImageType };
