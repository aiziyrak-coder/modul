const router = require("express").Router();
const validator = require("#shared/validator");
const { uploadLimiter } = require("#shared/rateLimiter");
const { uploadApplicationDocs, persistApplicationDocs } = require("./public.upload");
const Controller = require("./public.controller");
const {
  submitSchema,
  statusParams,
  statusLookupSchema,
  languageQuery,
  refQuery,
} = require("./public.validation");

const lang = validator.query(languageQuery);
const refs = validator.query(refQuery);

router.get("/directions", lang, Controller.getDirections);
router.get("/education-forms", refs, Controller.getEducationForms);
router.get("/education-languages", refs, Controller.getEducationLanguages);
router.get("/countries", lang, Controller.getCountries);
router.get("/offer", lang, Controller.getOffer);

router.get("/open-season", lang, Controller.getOpenSeason);

router.post(
  "/applications",
  uploadLimiter,
  uploadApplicationDocs,
  validator.body(submitSchema),
  persistApplicationDocs,
  Controller.submitApplication,
);

router.post(
  "/applications/status",
  validator.body(statusLookupSchema),
  Controller.lookupApplicationStatus,
);

router.get(
  "/applications/:applicationNumber",
  validator.params(statusParams),
  Controller.getApplicationStatus,
);

module.exports = router;
