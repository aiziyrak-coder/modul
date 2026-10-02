const router = require("express").Router();
const validator = require("#shared/validator");
const { uploadLimiter, publicReadLimiter } = require("#shared/rateLimiter");
const {
  uploadApplicantDocs,
  requireAllDocs,
  persistApplicantDocs,
} = require("./publicExam.upload");
const Controller = require("./publicExam.controller");
const { submitSchema } = require("./publicExam.validation");

router.get("/specialties", publicReadLimiter, Controller.getSpecialties);
router.get("/courses", publicReadLimiter, Controller.getCourses);

router.post(
  "/applications",
  uploadLimiter,
  uploadApplicantDocs,
  validator.body(submitSchema),
  requireAllDocs,
  Controller.ensureSpecialtyOpen,
  persistApplicantDocs,
  Controller.submitApplication,
);

module.exports = router;
