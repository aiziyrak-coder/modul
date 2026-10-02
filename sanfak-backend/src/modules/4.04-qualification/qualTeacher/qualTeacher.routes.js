const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTeacher.controller");
const Validation = require("./qualTeacher.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllTeachers,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateTeachers,
  );

router
  .route("/attached")
  .get(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualCourseTeachers,
  );

router
  .route("/attached/paginate")
  .get(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualCourseTeachers,
  );

router
  .route("/attach")
  .put(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.UPDATE]),
    validator.body(Validation.addTeachersSchema),
    Controller.addTeachersToCourse,
  );

router
  .route("/detach")
  .put(
    permit(MODULES.QUAL_TEACHER, [ACTIONS.UPDATE]),
    validator.body(Validation.removeTeachersSchema),
    Controller.removeTeachersFromCourse,
  );

module.exports = router;
