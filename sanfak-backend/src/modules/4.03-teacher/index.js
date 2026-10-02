const router = require("express").Router();

router.use("/teachers", require("./teacher/teacher.routes"));
router.use("/teacher-statistics", require("./teacherStatistics/teacherStatistics.routes"));
router.use("/personal-work-plans", require("./personalWorkPlan/personalWorkPlan.routes"));
router.use("/personal-reports", require("./personalReport/personalReport.routes"));
router.use("/staff", require("./staff/staff.routes"));

module.exports = router;
