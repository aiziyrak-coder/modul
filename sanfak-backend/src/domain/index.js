const router = require("express").Router();

router.use("/students", require("./student/student.routes"));
router.use("/student-attendance", require("./attendance/attendance.routes"));
router.use("/gradebooks", require("./gradebook/gradebook.routes"));
router.use("/exams", require("./exam/exam.routes"));
router.use("/schedule", require("./schedule/schedule.routes"));
router.use("/time-slots", require("./timeSlot/timeSlot.routes"));

module.exports = router;
