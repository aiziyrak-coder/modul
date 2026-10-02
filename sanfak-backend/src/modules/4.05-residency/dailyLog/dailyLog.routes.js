const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./dailyLog.controller");
const V = require("./dailyLog.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.RESIDENT_DAILY_LOG, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.RESIDENT_DAILY_LOG, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.RESIDENT_DAILY_LOG, [ACTIONS.UPDATE]);
const permitApprove = permit(MODULES.RESIDENT_DAILY_LOG, [ACTIONS.APPROVE]);

router
  .route("/")
  .post(permitAdd, guardFileUrl(), validator.body(V.createDailyLogSchema), Controller.addLog);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(V.listQuery), Controller.paginateLogs);

router
  .route("/stats")
  .get(permitReadAll, validator.query(V.listQuery), Controller.statsLogs);

router
  .route("/resident/:residentId")
  .get(
    permitReadAll,
    validator.params(V.residentIdParam),
    validator.query(V.byResidentQuery),
    Controller.findLogsByResident,
  );

router
  .route("/:id/approve")
  .put(
    permitApprove,
    validator.params(V.idSchema),
    validator.body(V.approveSchema),
    Controller.approveLog,
  );

router
  .route("/:id/return")
  .put(
    permitApprove,
    validator.params(V.idSchema),
    validator.body(V.returnSchema),
    Controller.returnLog,
  );

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.params(V.idSchema),
    guardFileUrl(),
    validator.body(V.updateDailyLogSchema),
    Controller.updateLog,
  );

module.exports = router;
