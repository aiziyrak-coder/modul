const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  guardUploadContent,
} = require("#modules/4.05-residency/_services/uploadContentGuard");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyCurriculum.controller");
const V = require("./residencyCurriculum.validation");
const { mapCurriculumFiles } = require("./residencyCurriculum.files");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");

router.use(authenticate);

const M = MODULES.RESIDENCY_CURRICULUM;

const withFiles = [
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapCurriculumFiles,
  guardFileUrl("processFile.url"),
  guardFileUrl("planFile.url"),
];

router
  .route("/")
  .post(
    permit(M, [ACTIONS.CREATE]),
    ...withFiles,
    validator.body(V.createSchema),
    C.addCurriculum,
  )
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.listQuery),
    C.findAllCurriculums,
  );

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateCurriculums,
  );

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findCurriculum)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    ...withFiles,
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateCurriculum,
  )
  .delete(
    permit(M, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    C.deleteCurriculum,
  );

module.exports = router;
