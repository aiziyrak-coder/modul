const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./article.controller");
const {
  createArticleSchema,
  updateArticleSchema,
  rejectArticleSchema,
  articleQuerySchema,
  articlePaginateSchema,
} = require("./article.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.ARTICLE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.ARTICLE, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.ARTICLE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.ARTICLE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.ARTICLE, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.ARTICLE, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.ARTICLE, [ACTIONS.REJECT]);
const { articleScope: scope } = require("./article.scope");

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createArticleSchema),
    Controller.addArticle,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(articleQuerySchema),
    Controller.findAllArticles,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(articlePaginateSchema),
    Controller.paginateArticles,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneArticle,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateArticleSchema),
    Controller.updateArticle,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteArticle,
  );

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveArticle);

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectArticleSchema),
    Controller.rejectArticle,
  );

module.exports = router;
