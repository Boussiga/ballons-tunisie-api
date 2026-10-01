const rateLimit = require("express-rate-limit");

/**
 * Uniform response formatter for rate limit errors
 */
const rateLimitHandler = (req, res, next, options) => {
  res.status(429).json({
    message: "Trop de requêtes. Veuillez patienter avant de réessayer.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

/**
 * Global limiter: 100 requests per 15 minutes per IP
 * Applied to all API routes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.method === "OPTIONS", // Ignore CORS pre-flight
});

/**
 * Strict auth limiter: 10 attempts per 15 minutes per IP
 * Protects against brute force on /login and /refresh
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Only count failures
});

/**
 * Upload routes limiter: 20 uploads per 15 minutes per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Dashboard/stats limiter: 60 requests per minute
 */
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter, uploadLimiter, readLimiter };
