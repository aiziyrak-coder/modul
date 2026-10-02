const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  guardUploadContent,
} = require("#modules/4.05-residency/_services/uploadContentGuard");
const Controller = require("./residentApplication.controller");
const V = require("./residentApplication.validation");
const { mapApplicationFile } = require("./residentApplication.files");
const { guardFileUrl } = require("#modules/4.05-residency/_services/fileUrlGuard");

router.use(authenticate);

const withFile = [
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapApplicationFile,
  guardFileUrl(),
];

const permitAdd = permit(MODULES.RESIDENT_APPLICATION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.RESIDENT_APPLICATION, [ACTIONS.READ_ALL]);
const permitReview = permit(MODULES.RESIDENT_APPLICATION, [
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
]);

router
  .route("/")
  .post(
    permitAdd,
    ...withFile,
    validator.body(V.createApplicationSchema),
    Controller.addApplication,
  )
  .get(
    permitReadAll,
    validator.query(V.listQuery),
    Controller.findAllApplications,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(V.paginateQuery),
    Controller.paginateApplications,
  );

router.route("/stats").get(permitReadAll, Controller.statsApplications);

router
  .route("/:id/review")
  .put(
    permitReview,
    validator.params(V.idSchema),
    validator.body(V.reviewSchema),
    Controller.reviewApplication,
  );

module.exports = router;
