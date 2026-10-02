const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./studentAchievement.controller");
const {
  achievementSchema,
  updateSchema,
  myUpdateSchema,
  reviewSchema,
  findAll,
  readSchema,
  deleteSchema,
} = require("./studentAchievement.validation");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const { guardUploadContent } = require("../_services/uploadContentGuard");

router.use(authenticate);

const permitAdd = permit(MODULES.STUDENT_ACHIEVEMENT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.STUDENT_ACHIEVEMENT, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.STUDENT_ACHIEVEMENT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STUDENT_ACHIEVEMENT, [ACTIONS.DELETE]);
const permitReview = permit(MODULES.STUDENT_ACHIEVEMENT, [ACTIONS.APPROVE]);

const mapUploadedFile = (req, _res, next) => {
  if (req.body.file) {
    req.body.fileUrl = req.body.file;
    req.body.fileName = req.fileDetails?.name || req.body.fileName || "";
    delete req.body.file;
  }
  next();
};

router
  .route("/achievements")
  .post(
    permitAdd,
    uploadImages,
    guardUploadContent(),
    resizeImages,
    mapUploadedFile,
    validator.body(achievementSchema),
    Controller.addAchievement,
  )
  .get(permitReadAll, validator.query(findAll), Controller.findAllAchievements);

router
  .route("/achievements/my")
  .get(permitReadAll, Controller.findMyAchievements)
  .post(
    permitAdd,
    uploadImages,
    guardUploadContent(),
    resizeImages,
    mapUploadedFile,
    validator.body(achievementSchema),
    Controller.addMyAchievement,
  );

router.put(
  "/achievements/my/:id",
  permitAdd,
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapUploadedFile,
  validator.params(readSchema),
  validator.body(myUpdateSchema),
  Controller.updateMyAchievement,
);

router
  .route("/achievements/_shared/student/:studentId")
  .get(permitReadAll, Controller.findAchievementsByStudent);

router
  .route("/achievements/:id/review")
  .put(
    permitReview,
    validator.params(readSchema),
    validator.body(reviewSchema),
    Controller.reviewAchievement,
  );

router
  .route("/achievements/:id")
  .put(
    permitUpdate,
    uploadImages,
    guardUploadContent(),
    resizeImages,
    mapUploadedFile,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateAchievement,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteAchievement);

module.exports = router;
