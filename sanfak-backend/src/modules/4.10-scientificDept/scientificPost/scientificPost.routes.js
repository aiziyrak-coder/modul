const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scientificPost.controller");
const {
  createPostSchema,
  postQuerySchema,
  postPaginateSchema,
} = require("./scientificPost.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.SCIENTIFIC_POST, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCIENTIFIC_POST, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCIENTIFIC_POST, [ACTIONS.READ]);
const permitDelete = permit(MODULES.SCIENTIFIC_POST, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createPostSchema), Controller.addPost)
  .get(permitReadAll, validator.query(postQuerySchema), Controller.findAllPosts);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(postPaginateSchema), Controller.paginatePosts);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOnePost)
  .delete(permitDelete, validator.params(deleteSchema), Controller.deletePost);

module.exports = router;
