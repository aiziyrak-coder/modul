const router = require("express").Router();

router.use("/hemis", require("./hemis.routes"));

module.exports = router;
