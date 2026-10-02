const router = require("express").Router();

router.use("/study-plans", require("./studyPlan/studyPlan.routes"));
router.use("/learning-process", require("./learningProcess/learningProcess.routes"));
router.use("/working-schedules", require("./workingSchedule/workingSchedule.routes"));
router.use("/working-plans", require("./workingPlan/workingPlan.routes"));
router.use("/workloads", require("./workload/workload.routes"));
router.use("/study-load-statistics", require("./studyLoadStatistics/studyLoadStatistics.routes"));
router.use("/distributions", require("./workloadDistribution/workloadDistribution.routes"));
router.use("/science-programs", require("./scienceProgram/scienceProgram.routes"));
router.use("/syllabi", require("./syllabus/syllabus.routes"));
router.use("/teacher-leaves", require("./teacherLeave/teacherLeave.routes"));
router.use("/approval-inbox", require("./approvalInbox/approvalInbox.routes"));

router.use("/workload-summaries", require("./workloadSummary/workloadSummary.routes"));
router.use("/contingent-reports", require("./contingentReport/contingentReport.routes"));
router.use("/department-contingents", require("./departmentContingent/departmentContingent.routes"));

module.exports = router;
