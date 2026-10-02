const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");

router.get("/qualification-petitions/my/profile", proxyToMain);
router.get("/qualification-petitions/my", proxyToMain);
router.post("/qualification-petitions", proxyToMain);

router.get("/qualification-course-subscriptions/my", proxyToMain);

module.exports = router;
