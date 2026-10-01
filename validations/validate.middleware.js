/**
 * Generic Zod validation middleware.
 * Validates req.body, req.params and req.query according to provided schemas.
 *
 * @param {{ body?, params?, query? }} schemas - Zod objects
 */
const validate = (schemas) => (req, res, next) => {
  const errors = [];

  if (schemas.body) {
    const result = schemas.body.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      issues.forEach((e) =>
        errors.push({ champ: e.path.join(".") || "body", message: e.message })
      );
    } else {
      req.body = result.data;
    }
  }

  if (schemas.params) {
    const result = schemas.params.safeParse(req.params);
    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      issues.forEach((e) =>
        errors.push({ champ: `params.${e.path.join(".")}`, message: e.message })
      );
    } else {
      req.params = result.data;
    }
  }

  if (schemas.query) {
    const result = schemas.query.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      issues.forEach((e) =>
        errors.push({ champ: `query.${e.path.join(".")}`, message: e.message })
      );
    } else {
      req.query = result.data;
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({ message: "Données invalides.", erreurs: errors });
  }

  next();
};

// ─── ID param schema ────────────────────────────────────────────────────────
const { z } = require("zod");

const idParam = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "L'identifiant doit être un nombre entier positif.")
    .transform(Number),
});

// ─── Reusable pagination ──────────────────────────────────────────────────────
// Uses coerce to convert query strings to Number directly
const paginationQuery = z.object({
  page: z.coerce
    .number({ invalid_type_error: "page doit être un nombre." })
    .int("page doit être un entier.")
    .min(1, "page doit être >= 1.")
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: "limit doit être un nombre." })
    .int("limit doit être un entier.")
    .min(1, "limit doit être >= 1.")
    .max(100, "limit ne peut pas dépasser 100.")
    .default(10),
});

module.exports = { validate, idParam, paginationQuery };
