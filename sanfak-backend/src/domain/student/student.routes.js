"use strict";
const router     = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit     = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./student.controller");
const { generateStudentPdf } = require("#domain/student/student.pdf");
const {
  createStudentSchema,
  updateStudentSchema,
  changeStatusSchema,
  querySchema,
  paginateSchema,
} = require("./student.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.STUDENT, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.STUDENT, [ACTIONS.READ_ALL]);
const permitOne    = permit(MODULES.STUDENT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.STUDENT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STUDENT, [ACTIONS.DELETE]);
const scope        = scopeFilter("faculty");

router.route("/")
  .post(permitAdd,  validator.body(createStudentSchema),  Controller.addStudent)
  .get(permitRead, scope, validator.query(querySchema),    Controller.findAllStudents);

router.route("/paginate")
  .get(permitRead, scope, validator.query(paginateSchema), Controller.paginateStudents);

router.route("/group/:groupId/stats")
  .get(permitRead, Controller.groupStats);

router.route("/:id/status")
  .patch(permitUpdate, validator.body(changeStatusSchema), Controller.changeStatus);

router.route("/:id/pdf").get(permitOne, generateStudentPdf);

router.route("/:id")
  .get(permitOne,    Controller.findOneStudent)
  .put(permitUpdate, validator.body(updateStudentSchema), Controller.updateStudent)
  .delete(permitDelete, Controller.deleteStudent);

module.exports = router;
