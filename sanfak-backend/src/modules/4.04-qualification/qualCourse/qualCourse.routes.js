const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualCourse.controller");
const Validation = require("./qualCourse.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_COURSE, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualCourse,
  )
  .get(
    permit(MODULES.QUAL_COURSE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualCourses,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_COURSE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualCourses,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_COURSE, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualCourse,
  )
  .put(
    permit(MODULES.QUAL_COURSE, [ACTIONS.UPDATE]),
    validator.body(Validation.updateSchema),
    Controller.updateQualCourse,
  )
  .delete(
    permit(MODULES.QUAL_COURSE, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualCourse,
  );

module.exports = router;
