"use strict";
const router     = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit     = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./attendance.controller");
const {
  createAttendanceSchema,
  updateAttendanceSchema,
  querySchema,
} = require("./attendance.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.STUDENT_ATTENDANCE, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.STUDENT_ATTENDANCE, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.STUDENT_ATTENDANCE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STUDENT_ATTENDANCE, [ACTIONS.DELETE]);

router.route("/_shared/student/:studentId/stats")
  .get(permitRead, Controller.studentStats);

router.route("/")
  .post(permitAdd,  validator.body(createAttendanceSchema), Controller.createAttendance)
  .get(permitRead,  validator.query(querySchema),            Controller.findByGroup);

router.route("/:id")
  .get(permitRead,    Controller.findOne)
  .put(permitUpdate,  validator.body(updateAttendanceSchema), Controller.updateAttendance)
  .delete(permitDelete, Controller.deleteAttendance);

module.exports = router;
