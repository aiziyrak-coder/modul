const router = require("express").Router();

router.use("/members", require("./councilMember/councilMember.routes"));
router.use("/council-tasks", require("./councilTask/councilTask.routes"));
router.use("/council-statistics", require("./councilStatistics/councilStatistics.routes"));
router.use("/rank-applications", require("./rankApplication/rankApplication.routes"));
router.use("/voting-sessions", require("./votingSession/votingSession.routes"));
router.use("/votes", require("./anonymousVote/anonymousVote.routes"));
router.use("/council-announcements", require("./announcement/announcement.routes"));
router.use("/doc-settings", require("./docSetting/docSetting.routes"));

module.exports = router;
