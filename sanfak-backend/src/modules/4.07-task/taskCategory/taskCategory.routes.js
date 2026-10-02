const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES } = require("#config/constants");
const Controller = require("./taskCategory.controller");
const {
  createSchema,
  updateSchema,
  paginate,
  findAll,
  idSchema,
} = require("./taskCategory.validation");

router.use(authenticate);

router
  .route("/")
  .post(permit(MODULES.TASK_CATEGORY), validator.body(createSchema), Controller.addCategory)
  .get(permit(MODULES.TASK_CATEGORY), validator.query(findAll), Controller.findAllCategories);

router
  .route("/paginate")
  .get(permit(MODULES.TASK_CATEGORY), validator.query(paginate), Controller.paginateCategories);

router
  .route("/:id")
  .get(permit(MODULES.TASK_CATEGORY), validator.params(idSchema), Controller.findOneCategory)
  .put(permit(MODULES.TASK_CATEGORY), validator.params(idSchema), validator.body(updateSchema), Controller.updateCategory)
  .delete(permit(MODULES.TASK_CATEGORY), validator.params(idSchema), Controller.deleteCategory);

module.exports = router;
