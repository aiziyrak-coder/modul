const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./studyPeriod.controller");
const {
  createStudyPeriodSchema,
  updateStudyPeriodSchema,
} = require("./studyPeriod.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createStudyPeriodSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateStudyPeriodSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.STUDY_PERIOD, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
