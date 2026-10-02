const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./schedule.controller");
const {
  createScheduleSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  checkConflictSchema,
} = require("./schedule.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.SCHEDULE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCHEDULE, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCHEDULE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SCHEDULE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SCHEDULE, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createScheduleSchema), Controller.addSchedule)
  .get(permitReadAll, validator.query(findAll), Controller.findAllSchedules);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(paginate), Controller.paginateSchedules);

router
  .route("/check-conflict")
  .post(
    permitAdd,
    validator.body(checkConflictSchema),
    Controller.checkConflict,
  );

router.route("/group/:group").get(permitFindOne, Controller.getScheduleByGroup);

router
  .route("/4.03-teacher/:teacher")
  .get(permitFindOne, Controller.getScheduleByTeacher);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneSchedule)
  .put(permitUpdate, Controller.updateSchedule)
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteSchedule,
  );

module.exports = router;
