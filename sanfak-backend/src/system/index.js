const router = require("express").Router();

router.use("/approval-chains", require("./approvalChain/approvalChain.routes"));
router.use("/chat", require("./chat/chat.routes"));
router.use("/announcements", require("./announcement/announcement.routes"));
router.use("/notifications", require("./notification/notification.routes"));

module.exports = router;
