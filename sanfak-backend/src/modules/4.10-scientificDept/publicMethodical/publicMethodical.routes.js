const router = require("express").Router();
const validator = require("#shared/validator");
const { uploadLimiter, publicReadLimiter } = require("#shared/rateLimiter");
const Controller = require("./publicMethodical.controller");
const { submitSchema } = require("./publicMethodical.validation");
const {
  uploadMethodicalDocs,
  requireAllDocs,
  persistMethodicalDocs,
} = require("./publicMethodical.upload");

router.get("/specialties", publicReadLimiter, Controller.getSpecialties);
router.get("/academic-years", publicReadLimiter, Controller.getAcademicYears);
router.get("/templates", publicReadLimiter, Controller.getTemplates);

router.post(
  "/submissions",
  uploadLimiter,
  uploadMethodicalDocs,
  validator.body(submitSchema),
  requireAllDocs,
  Controller.ensureRefsValid,
  persistMethodicalDocs,
  Controller.submit,
);

module.exports = router;
