const router = require("express").Router();
const sc = require("express").Router();

sc.use("/works", require("./scientificWork/scientificWork.routes"));
sc.use("/reviews", require("./workReview/workReview.routes"));
sc.use("/decisions", require("./workDecision/workDecision.routes"));
sc.use("/members", require("./councilMember/councilMember.routes"));
sc.use("/refs", require("./references.routes"));
sc.use("/statistics", require("./scientificCouncilStatistics/scientificCouncilStatistics.routes"));

sc.use("/specialties", require("./councilSpecialty/councilSpecialty.routes"));
sc.use("/council-numbers", require("./councilNumber/councilNumber.routes"));
sc.use(
  "/application-template",
  require("./applicationTemplate/applicationTemplate.routes"),
);
sc.use(
  "/work-document-types",
  require("./workDocumentType/workDocumentType.routes"),
);

router.use("/scientific-council", sc);

module.exports = router;
