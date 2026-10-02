const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  guardUploadContent,
} = require("#modules/4.05-residency/_services/uploadContentGuard");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");
const C = require("./residencyTest.controller");
const V = require("./residencyTest.validation");
const { mapTestFile } = require("./residencyTest.files");

router.use(authenticate);

const M = MODULES.RESIDENT_ASSESSMENT;

const withFile = [
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapTestFile,
  guardFileUrl(),
];

router
  .route("/")
  .post(
    permit(M, [ACTIONS.CREATE]),
    C.requireTestManager,
    ...withFile,
    validator.body(V.createSchema),
    C.addTest,
  )
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllTests);

router
  .route("/preview")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.previewQuery), C.preview);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.paginateTests);

router
  .route("/:id/results")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.params(V.idSchema), C.listResults)
  .put(
    permit(M, [ACTIONS.SCORE]),
    validator.params(V.idSchema),
    validator.body(V.resultsSchema),
    C.upsertResults,
  );

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findOneTest)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    C.requireTestManager,
    ...withFile,
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateTest,
  )
  .delete(
    permit(M, [ACTIONS.DELETE]),
    C.requireTestManager,
    validator.params(V.idSchema),
    C.deleteTest,
  );

module.exports = router;
