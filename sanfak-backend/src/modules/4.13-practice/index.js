const router = require("express").Router();

router.use("/practices", require("./practice/practice.routes"));
router.use("/practice-statistics", require("./practiceStatistics/practiceStatistics.routes"));
router.use("/medical-organizations", require("./medicalOrganization/medicalOrganization.routes"));

router.use("/org-types", require("./orgType/orgType.routes"));

router.use("/practice-students", require("./student/student.routes"));

router.use("/contract-templates", require("./contractTemplate/contractTemplate.routes"));

module.exports = router;
