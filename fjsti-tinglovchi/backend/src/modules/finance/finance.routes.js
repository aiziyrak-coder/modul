const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");

router.get("/qualification-contracts/my", proxyToMain);

router.get("/qualification-payments/my", proxyToMain);
router.post("/qualification-payments/bank", proxyToMain);

module.exports = router;
