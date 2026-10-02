const router = require("express").Router();

router.use(require("./lib/signFileUrls"));

router.use(
  "/international-admission",
  require("./internationalAdmission/internationalAdmission.routes"),
);

router.use("/admission-directions", require("./admissionDirection/admissionDirection.routes"));
router.use(
  "/admission-education-forms",
  require("./admissionEducationForm/admissionEducationForm.routes"),
);
router.use(
  "/admission-education-languages",
  require("./admissionEducationLanguage/admissionEducationLanguage.routes"),
);
router.use("/admission-countries", require("./admissionCountry/admissionCountry.routes"));
router.use("/admission-offer", require("./admissionOffer/admissionOffer.routes"));

router.use("/admission-seasons", require("./admissionSeason/admissionSeason.routes"));
router.use("/admission-messages", require("./admissionMessage/admissionMessage.routes"));

module.exports = router;
