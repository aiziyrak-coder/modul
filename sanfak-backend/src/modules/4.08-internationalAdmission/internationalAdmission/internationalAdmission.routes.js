const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./internationalAdmission.controller");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  createSchema,
  updateSchema,
  rejectSchema,
  statsSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./internationalAdmission.validation");

router.use(authenticate);

const M = MODULES.INTERNATIONAL_ADMISSION;

router.post(
  "/",
  permit(M, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createSchema),
  Controller.addApplicant,
);
router.get("/", permit(M, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAllApplicants);

router.get(
  "/paginate",
  permit(M, [ACTIONS.READ_ALL]),
  validator.query(paginate),
  Controller.paginateApplicants,
);

router.get(
  "/stats",
  permit(M, [ACTIONS.READ_ALL]),
  validator.query(statsSchema),
  Controller.applicantStats,
);
router.get("/countries", permit(M, [ACTIONS.READ_ALL]), Controller.applicantCountries);

router.get("/:id", permit(M, [ACTIONS.READ]), validator.params(readSchema), Controller.findOneApplicant);
router.put(
  "/:id",
  permit(M, [ACTIONS.UPDATE]),
  uploadImages,
  resizeImages,
  validator.body(updateSchema),
  Controller.updateApplicant,
);
router.delete(
  "/:id",
  permit(M, [ACTIONS.DELETE]),
  validator.params(deleteSchema),
  Controller.deleteApplicant,
);

router.put("/:id/approve", permit(M, [ACTIONS.APPROVE]), Controller.approveApplicant);
router.put(
  "/:id/reject",
  permit(M, [ACTIONS.REJECT]),
  validator.body(rejectSchema),
  Controller.rejectApplicant,
);

module.exports = router;
