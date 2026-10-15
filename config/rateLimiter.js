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

// Back-office routes (admin + its auth/profile calls) get their own, looser limit
const isAdminRoute = (req) => /^\/api\/(admin|auth)(\/|$)/.test(req.originalUrl);

/**
 * Global limiter: 15 requests per 40 seconds per IP
 * Applied to all public API routes (the store) — admin routes use adminLimiter
 */
const globalLimiter = rateLimit({
  windowMs: 40 * 1000, // 40 seconds
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.method === "OPTIONS" || isAdminRoute(req), // Ignore CORS pre-flight
});

/**
 * Admin limiter: 120 requests per minute per IP
 * The administrator manages everything (dashboard, catalogue, orders), so the
 * back-office needs more room than the public store
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.method === "OPTIONS",
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

module.exports = { globalLimiter, adminLimiter, authLimiter, uploadLimiter, readLimiter };
