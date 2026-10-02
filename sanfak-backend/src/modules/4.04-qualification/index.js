const router = require("express").Router();

router.use(require("./_shared/signFileUrls"));

require("#system/_shared/socketHandler").registerListenerLastSeenSink(
  (listenerId, at) =>
    require("./_shared/qualListener.model").findByIdAndUpdate(listenerId, {
      lastSeen: at,
    }),
);

router.use("/qualification-chat", require("./qualChat/qualChat.routes"));
router.use("/qualification-surveys", require("./qualSurvey/qualSurvey.routes"));
router.use("/qualification-certificates", require("./qualCertificate/qualCertificate.routes"));
router.use("/qualification-calendar-plans", require("./qualCalendarPlan/qualCalendarPlan.routes"));
router.use("/qualification-contracts", require("./qualContract/qualContract.routes"));
router.use("/qualification-payments", require("./qualPayment/qualPayment.routes"));
router.use("/qualification-courses", require("./qualCourse/qualCourse.routes"));
router.use("/qualification-statistics", require("./qualStatistics/qualStatistics.routes"));
router.use("/qualification-course-subscriptions", require("./qualCourseSubscription/qualCourseSubscription.routes"));
router.use("/qualification-course-types", require("./qualCourseType/qualCourseType.routes"));
router.use("/qualification-notifications", require("./qualNotification/qualNotification.routes"));
router.use("/qualification-petitions", require("./qualPetition/qualPetition.routes"));
router.use("/qualification-sources", require("./qualSource/qualSource.routes"));
router.use("/qualification-teachers", require("./qualTeacher/qualTeacher.routes"));
router.use("/qualification-topics", require("./qualTopic/qualTopic.routes"));
router.use("/qualification-access-tests", require("./qualAccessTest/qualAccessTest.routes"));
router.use("/qualification-test-configs", require("./qualTestConfig/qualTestConfig.routes"));
router.use("/qualification-exit-tests", require("./qualExitTest/qualExitTest.routes"));
router.use("/qualification-topic-lectures", require("./qualTopicLecture/qualTopicLecture.routes"));
router.use("/qualification-topic-practicals", require("./qualTopicPractical/qualTopicPractical.routes"));
router.use("/qualification-topic-videos", require("./qualTopicVideo/qualTopicVideo.routes"));
router.use("/qualification-topic-scenarios", require("./qualTopicScenario/qualTopicScenario.routes"));
router.use("/qualification-topic-final-tests", require("./qualTopicFinalTest/qualTopicFinalTest.routes"));
router.use("/qualification-access-test-results", require("./qualAccessTestResult/qualAccessTestResult.routes"));
router.use("/qualification-final-test-results", require("./qualFinalTestResult/qualFinalTestResult.routes"));
router.use("/qualification-exit-test-results", require("./qualExitTestResult/qualExitTestResult.routes"));
router.use("/qualification-topic-completions", require("./qualTopicCompletion/qualTopicCompletion.routes"));

module.exports = router;
