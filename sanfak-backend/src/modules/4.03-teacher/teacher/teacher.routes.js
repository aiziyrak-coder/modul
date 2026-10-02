const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const Controller = require("./teacher.controller");
const { generateTeacherPdf } = require("#modules/4.03-teacher/_pdf/teacher.pdf");
const {
  createProfileSchema,
  updateProfileSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  uploadMyDegreesSchema,
  deleteMyDegreeSchema,
} = require("./teacher.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.TEACHER, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.TEACHER, [ACTIONS.READ_ALL]);
const permitOne    = permit(MODULES.TEACHER, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.TEACHER, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.TEACHER, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.TEACHER, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.TEACHER, [ACTIONS.REJECT]);
const scope        = scopeFilter("department", { bypassRoles: [ROLES.KADRLAR] });

router
  .route("/")
  .post(permitAdd, validator.body(createProfileSchema), Controller.addProfile)
  .get(permitRead, scope, validator.query(findAll), Controller.findAllProfiles);

router
  .route("/paginate")
  .get(permitRead, scope, validator.query(paginate), Controller.paginateProfiles);

router
  .route("/me/degrees")
  .post(
    permitUpdate,
    uploadImages,
    resizeImages,
    validator.body(uploadMyDegreesSchema),
    Controller.uploadMyDegrees,
  );

router
  .route("/me/degrees/:type/:fileId")
  .delete(
    permitUpdate,
    validator.params(deleteMyDegreeSchema),
    Controller.removeMyDegree,
  );

router
  .route("/:id")
  .get(permitOne, scope, validator.params(readSchema), Controller.findOneProfile)
  .put(permitUpdate, scope, validator.body(updateProfileSchema), Controller.updateProfile)
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteProfile,
  );

router.route("/:id/approve").patch(permitApprove, scope, Controller.approveProfile);
router.route("/:id/reject").patch(permitReject, scope, Controller.rejectProfile);

router
  .route("/:id/pdf")
  .get(permitOne, scope, validator.params(readSchema), generateTeacherPdf);

module.exports = router;
