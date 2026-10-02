const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const { taskFileGuard } = require("#modules/4.07-task/_services/taskFileGuard");
const Controller = require("./task.controller");
const V = require("./task.validation");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.TASK, [ACTIONS.CREATE]),
    uploadImages,
    taskFileGuard,
    resizeImages,
    validator.body(V.createSchema),
    Controller.addTask,
  )
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.findAll),
    Controller.findAllTasks,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.paginate),
    Controller.paginateTasks,
  );

router
  .route("/my")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.findAll),
    Controller.getMyTasks,
  );

router
  .route("/my/paginate")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.paginate),
    Controller.paginateMyTasks,
  );

router
  .route("/stats")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.statsQuery),
    Controller.taskStats,
  );

router
  .route("/assignable-users")
  .get(
    permit(MODULES.TASK, [ACTIONS.CREATE]),
    validator.query(V.assignableQuery),
    Controller.getAssignableUsers,
  );

router
  .route("/monitoring")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.monitoringQuery),
    Controller.monitoring,
  );

router
  .route("/monitoring/export")
  .get(
    permit(MODULES.TASK, [ACTIONS.EXPORT]),
    validator.query(V.monitoringQuery),
    Controller.monitoringExport,
  );

router
  .route("/monitoring/monthly")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ_ALL]),
    validator.query(V.monthlyQuery),
    Controller.monitoringMonthly,
  );

router
  .route("/:id/responses")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ]),
    validator.params(V.idSchema),
    validator.query(V.responsesQuery),
    Controller.listResponses,
  )
  .post(
    permit(MODULES.TASK, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    uploadImages,
    taskFileGuard,
    resizeImages,
    validator.body(V.responseSchema),
    Controller.addResponse,
  );

router
  .route("/:id/complete")
  .patch(
    permit(MODULES.TASK, [ACTIONS.CHANGE_STATUS]),
    validator.params(V.idSchema),
    validator.body(V.finalizeSchema),
    Controller.finalizeTask,
  );

router
  .route("/:id/reopen")
  .patch(
    permit(MODULES.TASK, [ACTIONS.CHANGE_STATUS]),
    validator.params(V.idSchema),
    Controller.reopenTask,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.TASK, [ACTIONS.READ]),
    validator.params(V.idSchema),
    Controller.findOneTask,
  )
  .put(
    permit(MODULES.TASK, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    uploadImages,
    taskFileGuard,
    resizeImages,
    validator.body(V.updateSchema),
    Controller.updateTask,
  )
  .delete(
    permit(MODULES.TASK, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    Controller.deleteTask,
  );

module.exports = router;
