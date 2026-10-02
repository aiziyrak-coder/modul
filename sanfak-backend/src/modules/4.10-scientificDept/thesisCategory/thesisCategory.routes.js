const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./thesisCategory.controller");
const {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
  categoryPaginateSchema,
} = require("./thesisCategory.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.THESIS_CATEGORY, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.THESIS_CATEGORY, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.THESIS_CATEGORY, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.THESIS_CATEGORY, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.THESIS_CATEGORY, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createCategorySchema), Controller.addCategory)
  .get(
    permitReadAll,
    validator.query(categoryQuerySchema),
    Controller.findAllCategories,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(categoryPaginateSchema),
    Controller.paginateCategories,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneCategory)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateCategorySchema),
    Controller.updateCategory,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteCategory,
  );

module.exports = router;
