const router = require("express").Router();
const announcementFiles = require("./_services/announcementFiles");

announcementFiles.startTmpSweeper();

require("./_services/referencePrecheck").registerReferencePrecheck();

router.use("/residents", require("./resident/resident.routes"));
router.use("/residency-statistics", require("./residencyStatistics/residencyStatistics.routes"));
router.use("/specialties", require("./residencySpecialty/residencySpecialty.routes"));
router.use("/applications", require("./residentApplication/residentApplication.routes"));
router.use("/attendance", require("./attendance/attendance.routes"));
router.use("/residency-settings", require("./residencySetting/residencySetting.routes"));
router.use("/daily-logs", require("./dailyLog/dailyLog.routes"));
router.use("/activity-plans", require("./activityPlan/activityPlan.routes"));
router.use("/dissertation-plans", require("./dissertationPlan/dissertationPlan.routes"));
router.use("/theory-topics", require("./residencyTheoryTopic/residencyTheoryTopic.routes"));
router.use("/skills", require("./residencySkill/residencySkill.routes"));
router.use("/attestations", require("./residencyAttestation/residencyAttestation.routes"));
router.use("/curriculums", require("./residencyCurriculum/residencyCurriculum.routes"));
router.use("/lessons", require("./residencyLesson/residencyLesson.routes"));
router.use("/residency-sessions", require("./residencySession/residencySession.routes"));
router.use("/notices", require("./residencyNotice/residencyNotice.routes"));
router.use(
  "/expulsion-orders",
  require("./residencyExpulsionOrder/residencyExpulsionOrder.routes"),
);
router.use(
  "/residency-sams-outages",
  require("./residencySamsOutage/residencySamsOutage.routes"),
);
router.use("/residency-sams-status", require("./samsIngest/samsStatus.routes"));
router.use(
  "/problem-students",
  require("./residencyProblemStudent/residencyProblemStudent.routes"),
);
router.use(
  "/residency-announcements",
  require("./residencyAnnouncement/residencyAnnouncement.routes"),
);
router.use(
  "/residency-reports",
  require("./residencyReport/residencyReport.routes"),
);
router.use("/assessments", require("./assessment/assessment.routes"));
router.use("/residency-tests", require("./residencyTest/residencyTest.routes"));
router.use("/open-lessons", require("./openLesson/openLesson.routes"));
router.use("/resources", require("./resource/resource.routes"));

module.exports = router;
