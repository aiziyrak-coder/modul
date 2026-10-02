const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./report.controller");

router.use(authenticate);

router.get("/workloads",      permit(MODULES.REPORT, [ACTIONS.READ]), C.workloadReport);

router.get("/distributions",  permit(MODULES.REPORT, [ACTIONS.READ]), C.distributionReport);

router.get("/teachers",       permit(MODULES.REPORT, [ACTIONS.READ]), C.teachersReport);

router.get("/work-plans",     permit(MODULES.REPORT, [ACTIONS.READ]), C.workPlanReport);

router.get("/summary",        permit(MODULES.REPORT, [ACTIONS.READ]), C.summaryReport);

router.route("/saved")
  .get(permit(MODULES.REPORT, [ACTIONS.READ_ALL]), C.listReports)
  .post(permit(MODULES.REPORT, [ACTIONS.CREATE]), C.createReport);

router.route("/saved/:id")
  .get(permit(MODULES.REPORT, [ACTIONS.READ]), C.getReport)
  .delete(permit(MODULES.REPORT, [ACTIONS.DELETE]), C.deleteReport);

router.post("/saved/:id/submit",  permit(MODULES.REPORT, [ACTIONS.UPDATE]), C.submitReport);
router.patch("/saved/:id/reopen", permit(MODULES.REPORT, [ACTIONS.UPDATE]), C.reopenReport);

router.patch("/saved/:id/approve", permit(MODULES.REPORT, [ACTIONS.UPDATE]), C.approveReport);
router.patch("/saved/:id/reject",  permit(MODULES.REPORT, [ACTIONS.UPDATE]), C.rejectReport);

router.get("/saved/:id/download", permit(MODULES.REPORT, [ACTIONS.READ]), C.downloadReport);

module.exports = router;
