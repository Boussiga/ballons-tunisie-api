const express = require("express");
const router = express.Router();
const categorieController = require("../controller/admin.categorie.controller");
const { validate } = require("../validations/validate.middleware");
const { createCategorieSchema, updateCategorieSchema } = require("../validations/categorie.validation");
const authenticateAdmin = require("../middelwhere/auth.middleware");




router.get("/getAllCategories", authenticateAdmin, categorieController.getAllCategories);
router.get("/getCategorieById/:id", authenticateAdmin, categorieController.getCategorieById);
router.post("/createCategorie", authenticateAdmin, validate(createCategorieSchema), categorieController.createCategorie);
router.put("/updateCategorie/:id", authenticateAdmin, validate(updateCategorieSchema), categorieController.updateCategorie);
router.delete("/deleteCategorie/:id", authenticateAdmin, categorieController.deleteCategorie);

module.exports = router;
