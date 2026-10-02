const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./qualifyingApplicant.controller");
const {
  createApplicantSchema,
  updateApplicantSchema,
  rejectSchema,
  examDateSchema,
  resultSchema,
  applicantQuerySchema,
  applicantPaginateSchema,
} = require("./qualifyingApplicant.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.REJECT]);
const permitChangeStatus = permit(MODULES.QUALIFYING_APPLICANT, [ACTIONS.CHANGE_STATUS]);

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createApplicantSchema),
    Controller.addApplicant,
  )
  .get(permitReadAll, validator.query(applicantQuerySchema), Controller.findAllApplicants);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(applicantPaginateSchema), Controller.paginateApplicants);

router
  .route("/exam-date")
  .put(permitChangeStatus, validator.body(examDateSchema), Controller.setExamDate);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneApplicant)
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateApplicantSchema),
    Controller.updateApplicant,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteApplicant);

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveApplicant);
router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectSchema),
    Controller.rejectApplicant,
  );

router
  .route("/:id/result")
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(resultSchema),
    Controller.setResult,
  );

router
  .route("/:id/resubmit")
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateApplicantSchema),
    Controller.resubmitApplicant,
  );

module.exports = router;
