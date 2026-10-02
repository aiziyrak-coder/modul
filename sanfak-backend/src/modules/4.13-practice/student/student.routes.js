const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./student.controller");
const {
  createSchema,
  updateSchema,
  bulkCourseTransferSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./student.validation");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.CREATE]),
  validator.body(createSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.READ_ALL]),
  validator.query(findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.READ_ALL]),
  validator.query(paginate),
  Controller.paginate,
);

router.patch(
  "/bulk-course-transfer",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.UPDATE]),
  validator.body(bulkCourseTransferSchema),
  Controller.bulkCourseTransfer,
);

router.get(
  "/:id",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.READ]),
  validator.params(readSchema),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.UPDATE]),
  validator.params(readSchema),
  validator.body(updateSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.PRACTICE_STUDENT, [ACTIONS.DELETE]),
  validator.params(deleteSchema),
  Controller.delete,
);

module.exports = router;
