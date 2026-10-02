"use strict";
const router     = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit     = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./exam.controller");
const {
  createExamSchema,
  updateExamSchema,
  statusSchema,
  enterResultsSchema,
  updateResultSchema,
  querySchema,
  paginateSchema,
} = require("./exam.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.EXAM, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.EXAM, [ACTIONS.READ_ALL]);
const permitOne    = permit(MODULES.EXAM, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.EXAM, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.EXAM, [ACTIONS.DELETE]);
const scope = scopeFilter("department");

router.route("/")
  .post(permitAdd,  validator.body(createExamSchema),  Controller.createExam)
  .get(permitRead,  scope, validator.query(querySchema),       Controller.findAll);

router.route("/paginate")
  .get(permitRead,  scope, validator.query(paginateSchema),    Controller.paginateExams);

router.route("/:id")
  .get(permitOne,    Controller.findOne)
  .put(permitUpdate, validator.body(updateExamSchema),  Controller.updateExam)
  .delete(permitDelete, Controller.deleteExam);

router.route("/:id/status")
  .patch(permitUpdate, validator.body(statusSchema), Controller.updateStatus);

router.route("/:id/results")
  .post(permitUpdate, validator.body(enterResultsSchema), Controller.enterResults);

router.route("/:id/results/:resultId")
  .patch(permitUpdate, validator.body(updateResultSchema), Controller.updateResult);

router.route("/:id/stats")
  .get(permitOne, Controller.examStats);

module.exports = router;
