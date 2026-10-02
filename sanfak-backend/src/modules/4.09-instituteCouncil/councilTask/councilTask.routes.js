const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const Controller = require("./councilTask.controller");
const {
  taskSchema,
  updateTaskSchema,
  submitResultSchema,
  rejectSchema,
  findTasksSchema,
  paginateTasksSchema,
} = require("./councilTask.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.COUNCIL_TASK, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.COUNCIL_TASK, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.COUNCIL_TASK, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.COUNCIL_TASK, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.COUNCIL_TASK, [ACTIONS.DELETE]);
const permitChangeStatus = permit(MODULES.COUNCIL_TASK, [ACTIONS.CHANGE_STATUS]);
const permitApprove = permit(MODULES.COUNCIL_TASK, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.COUNCIL_TASK, [ACTIONS.REJECT]);

router
  .route("/")
  .post(permitAdd, validator.body(taskSchema), Controller.addTask)
  .get(permitReadAll, validator.query(findTasksSchema), Controller.findAllTasks);

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(paginateTasksSchema),
    Controller.paginateTasks,
  );

router.route("/tabs-count").get(permitReadAll, Controller.tabsCount);

router
  .route("/:id/submit-result")
  .patch(
    permitChangeStatus,
    uploadImages,
    resizeImages,
    validator.body(submitResultSchema),
    Controller.submitResult,
  );

router
  .route("/:id/delete-result")
  .patch(permitChangeStatus, Controller.deleteResult);

router
  .route("/:id/approve")
  .patch(permitApprove, Controller.approveTask);

router
  .route("/:id/reject")
  .patch(permitReject, validator.body(rejectSchema), Controller.rejectTask);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneTask)
  .put(permitUpdate, validator.body(updateTaskSchema), Controller.updateTask)
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteTask);

module.exports = router;
