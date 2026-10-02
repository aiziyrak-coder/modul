"use strict";
const router     = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit     = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./gradebook.controller");
const {
  createGradebookSchema,
  addLessonSchema,
  updateLessonSchema,
  updateSummarySchema,
  querySchema,
  paginateSchema,
} = require("./gradebook.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.GRADEBOOK, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.GRADEBOOK, [ACTIONS.READ_ALL]);
const permitOne    = permit(MODULES.GRADEBOOK, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.GRADEBOOK, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.GRADEBOOK, [ACTIONS.DELETE]);
const scope = scopeFilter("department");

router.route("/")
  .post(permitAdd,  validator.body(createGradebookSchema),  Controller.createGradebook)
  .get(permitRead,  scope, validator.query(querySchema),            Controller.findAll);

router.route("/paginate")
  .get(permitRead,  scope, validator.query(paginateSchema),         Controller.paginate);

router.route("/_shared/student/:studentId/stats")
  .get(permitRead, Controller.studentStats);

router.route("/4.03-teacher/:teacherId/stats")
  .get(permitRead, Controller.teacherStats);

router.route("/:id")
  .get(permitOne,    Controller.findOne)
  .delete(permitDelete, Controller.deleteGradebook);

router.route("/:id/close")
  .patch(permitUpdate, Controller.closeGradebook);

router.route("/:id/summary")
  .put(permitUpdate, validator.body(updateSummarySchema), Controller.updateSummary);

router.route("/:id/lessons")
  .post(permitUpdate, validator.body(addLessonSchema), Controller.addLesson);

router.route("/:id/lessons/:lessonId")
  .put(permitUpdate, validator.body(updateLessonSchema), Controller.updateLesson)
  .delete(permitUpdate, Controller.deleteLesson);

module.exports = router;
