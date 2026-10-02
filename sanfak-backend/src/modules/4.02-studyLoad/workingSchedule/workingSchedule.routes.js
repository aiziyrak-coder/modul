"use strict";
const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const workingScheduleScope = require("./workingSchedule.scope");
const learningProcessScope = require("#modules/4.02-studyLoad/learningProcess/learningProcess.scope");
const eriGuard = require("../_shared/eriGuard");
const { rejectCommentSchema } = require("../_shared/rejectBody.schema");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workingSchedule.controller");
const {
  createWorkingScheduleSchema,
  monthWeeksSchema,
} = require("./workingSchedule.validation");

const permitAdd = permit(MODULES.WORKING_SCHEDULE, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.WORKING_SCHEDULE, [ACTIONS.READ_ALL]);
const permitOne = permit(MODULES.WORKING_SCHEDULE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.WORKING_SCHEDULE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.WORKING_SCHEDULE, [ACTIONS.DELETE]);
const scope = workingScheduleScope();
const lpScope = learningProcessScope();

router
  .route("/generate-stream")
  .get(
    authenticate.stream,
    permit(MODULES.WORKING_SCHEDULE, [ACTIONS.UPDATE]),
    lpScope,
    Controller.subAddWorkingPlanStream,
  );

router.use(authenticate);

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createWorkingScheduleSchema),
    Controller.create,
  );

router.route("/").get(permitRead, scope, Controller.findAll);

router.route("/paginate").get(permitRead, scope, Controller.paginate);

router
  .route("/supersede-preview")
  .get(
    permit(MODULES.WORKING_SCHEDULE, [ACTIONS.UPDATE]),
    lpScope,
    Controller.supersedePreview,
  );

router.route("/process/:id").get(permitOne, scope, Controller.findOneProcess);

router.route("/process/:id").put(permitUpdate, scope, Controller.updateWorkingProcess);

router
  .route("/process/:id/month-weeks")
  .put(permitUpdate, scope, validator.body(monthWeeksSchema), Controller.updateMonthWeeks);

router.route("/composition/:id").get(permitOne, scope, Controller.findOneComposition);

router
  .route("/composition/:id")
  .put(permitUpdate, scope, Controller.updateComposition);

router
  .route("/composition/title/:id")
  .put(permitUpdate, scope, Controller.updateCompositionTitle);

router.route("/:id").get(permitOne, scope, Controller.findOne);

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.WORKING_SCHEDULE, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    Controller.approve,
  );
router
  .route("/reject/:id")
  .patch(
    permit(MODULES.WORKING_SCHEDULE, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.body(rejectCommentSchema),
    Controller.reject,
  );

router.route("/job/:id").get(permitOne, Controller.getJobStatus);

router.route("/:id/pdf").get(permitOne, scope, Controller.generatePdf);

router.route("/:id").delete(permitDelete, scope, Controller.delete);

module.exports = router;
