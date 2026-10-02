const router = require("express").Router();
const validator = require("#shared/validator");
const { publicReadLimiter, uploadLimiter } = require("#shared/rateLimiter");
const {
  uploadApplicationFile,
  persistApplicationFile,
} = require("./public.upload");
const Controller = require("./public.controller");
const { submitSchema } = require("./public.validation");

router.get("/form-refs", publicReadLimiter, Controller.getFormRefs);

router.post(
  "/applications",
  uploadLimiter,
  uploadApplicationFile,
  validator.body(submitSchema),
  persistApplicationFile,
  Controller.submitApplication,
);

module.exports = router;
