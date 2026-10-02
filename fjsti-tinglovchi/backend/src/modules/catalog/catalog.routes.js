const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");

router.get("/qualification-courses/paginate", proxyToMain);
router.get("/qualification-courses/:id", proxyToMain);
router.get("/qualification-courses", proxyToMain);

router.get("/qualification-course-types", proxyToMain);

router.get("/qualification-sources/by-course-name", proxyToMain);

router.get("/qualification-calendar-plans", proxyToMain);
router.get("/qualification-notifications", proxyToMain);

router.get("/provinces", proxyToMain);
router.get("/regions", proxyToMain);

module.exports = router;
