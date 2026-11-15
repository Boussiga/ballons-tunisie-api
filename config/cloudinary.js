const { v2: cloudinary } = require("cloudinary");

// Credentials come ONLY from environment variables (never hardcode them).
// Dashboard -> Settings -> API Keys: https://console.cloudinary.com/settings/api-keys
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDER = process.env.CLOUDINARY_FOLDER || "ballons-tunisie/produits";

const isConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

module.exports = { cloudinary, FOLDER, isConfigured };
