const router = require("express").Router();
const authenticate = require("#shared/authenticate");

router.use("/auth", require("#modules/auth/auth.routes"));

router.use(authenticate);

router.use(require("#modules/catalog/catalog.routes"));
router.use(require("#modules/enrollment/enrollment.routes"));
router.use(require("#modules/finance/finance.routes"));
router.use(require("#modules/learning/learning.routes"));
router.use(require("#modules/testing/testing.routes"));
router.use(require("#modules/chat/chat.routes"));

module.exports = router;
