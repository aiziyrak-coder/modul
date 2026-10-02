const router = require("express").Router();

router.use("/reports", require("./reports/report.routes"));

module.exports = router;
