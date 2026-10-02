const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  guardUploadContent,
} = require("#modules/4.05-residency/_services/uploadContentGuard");
const C = require("./resource.controller");
const V = require("./resource.validation");
const { mapResourceFile } = require("./resource.files");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");

router.use(authenticate);

const M = MODULES.RESIDENT_RESOURCE;

const withFile = [
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapResourceFile,
  guardFileUrl(),
];

router
  .route("/")
  .post(
    permit(M, [ACTIONS.CREATE]),
    ...withFile,
    validator.body(V.createSchema),
    C.addResource,
  )
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllResources);

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateResources,
  );

router
  .route("/stats")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.paginateQuery), C.statsResources);

router
  .route("/:id/download")
  .put(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.downloadResource);

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findOneResource)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    ...withFile,
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateResource,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteResource);

module.exports = router;
