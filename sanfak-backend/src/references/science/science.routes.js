const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./science.controller");
const {
  createScienceSchema,
  updateScienceSchema,
  findAllSciencesQuery,
  paginateSciencesQuery,
} = require("./science.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.SCIENCE, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createScienceSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.SCIENCE, [ACTIONS.READ_ALL]),
  validator.query(findAllSciencesQuery),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.SCIENCE, [ACTIONS.READ_ALL]),
  validator.query(paginateSciencesQuery),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.SCIENCE, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.SCIENCE, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateScienceSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.SCIENCE, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
