const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./attendance.controller");
const V = require("./attendance.validation");
const { denySessionRowEdit, denySessionRowExcuse } = require("#modules/4.05-residency/_services/sessionRowGuard");

router.use(authenticate);

const permitAdd = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.UPDATE]);

const permitApproveExcuse = permit(MODULES.RESIDENT_ATTENDANCE, [
  ACTIONS.APPROVE,
]);

router.post(
  "/",
  permitAdd,
  validator.body(V.createAttendanceSchema),
  Controller.addAttendance,
);

router.get(
  "/paginate",
  permitRead,
  validator.query(V.listQuery),
  Controller.paginateAttendance,
);

router.get(
  "/stats",
  permitRead,
  validator.query(V.listQuery),
  Controller.getJournalStats,
);

router.get(
  "/stats/by-resident",
  permitRead,
  validator.query(V.listQuery),
  Controller.getJournalStatsByResident,
);

router.get(
  "/resident/:resident",
  permitRead,
  validator.params(V.residentParam),
  validator.query(V.byResidentQuery),
  Controller.findAttendanceByResident,
);

router.get(
  "/resident/:resident/stats",
  permitRead,
  validator.params(V.residentParam),
  Controller.getAttendanceStats,
);

router.put(
  "/:id",
  permitUpdate,
  validator.params(V.idSchema),
  validator.body(V.updateAttendanceSchema),
  denySessionRowEdit,
  Controller.updateAttendance,
);

router.put(
  "/:id/approve-excuse",
  permitApproveExcuse,
  validator.params(V.idSchema),
  validator.body(V.approveExcuseSchema),
  denySessionRowExcuse,
  Controller.approveExcuse,
);

module.exports = router;
