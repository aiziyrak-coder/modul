const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scope = require("./scientificWork.scope");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scientificWork.controller");
const {
  findAllWorksQuery,
  paginateWorksQuery,
  createWorkSchema,
  updateWorkSchema,
  changeStatusSchema,
  updateSeminarResultSchema,
  updateSeminarDateSchema,
  updateDefenseDateSchema,
  updateDefenseResultSchema,
  updateMembersSchema,
  updateDocAssignmentsSchema,
  generateProtocolSchema,
  makeDecisionSchema,
  memberDecisionSchema,
  acceptApplicationSchema,
  uploadDocumentSchema,
} = require("./scientificWork.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  requireReadAccess,
  requireWriteAccess,
} = require("./scientificWork.access");

router.use(authenticate);

const permitAdd = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.APPROVE]);
const permitSign = permit(MODULES.SCIENTIFIC_WORK, [ACTIONS.SIGN]);

const permitManageMembers = permit(MODULES.SCIENCE_COUNCIL, [
  ACTIONS.MANAGE_MEMBERS,
]);

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createWorkSchema),
    Controller.addWork,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(findAllWorksQuery),
    Controller.findAllWorks,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(paginateWorksQuery),
    Controller.paginateWorks,
  );

router
  .route("/my")
  .get(
    permitFindOne,
    validator.query(findAllWorksQuery),
    Controller.findMyWorks,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    validator.params(readSchema),
    requireReadAccess,
    Controller.findOneWork,
  )
  .put(
    permitUpdate,
    requireWriteAccess,
    uploadImages,
    resizeImages,
    validator.body(updateWorkSchema),
    Controller.updateWork,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteWork,
  );

router
  .route("/:id/status")
  .put(
    permitApprove,
    validator.body(changeStatusSchema),
    Controller.changeStatus,
  )
  .patch(
    permitApprove,
    validator.body(changeStatusSchema),
    Controller.changeStatus,
  );

router
  .route("/:id/accept")
  .patch(
    permitApprove,
    validator.body(acceptApplicationSchema),
    Controller.acceptApplication,
  );

router
  .route("/:id/seminar-date")
  .patch(
    permitApprove,
    validator.body(updateSeminarDateSchema),
    Controller.updateSeminarDate,
  );

router
  .route("/:id/seminar-result")
  .patch(
    permitApprove,
    validator.body(updateSeminarResultSchema),
    Controller.updateSeminarResult,
  );

router
  .route("/:id/defense-date")
  .patch(
    permitApprove,
    validator.body(updateDefenseDateSchema),
    Controller.updateDefenseDate,
  );

router
  .route("/:id/defense-result")
  .patch(
    permitApprove,
    validator.body(updateDefenseResultSchema),
    Controller.updateDefenseResult,
  );

router
  .route("/:id/members")
  .patch(
    permitManageMembers,
    validator.body(updateMembersSchema),
    requireWriteAccess,
    Controller.updateMembers,
  );

router
  .route("/:id/assignments")
  .put(
    permitManageMembers,
    validator.body(updateDocAssignmentsSchema),
    requireWriteAccess,
    Controller.updateDocAssignments,
  )
  .patch(
    permitManageMembers,
    validator.body(updateDocAssignmentsSchema),
    requireWriteAccess,
    Controller.updateDocAssignments,
  );

router
  .route("/:id/doc-assignments")
  .patch(
    permitManageMembers,
    validator.body(updateDocAssignmentsSchema),
    requireWriteAccess,
    Controller.updateDocAssignments,
  );

router
  .route("/:id/documents")
  .post(
    permitUpdate,
    requireWriteAccess,
    uploadImages,
    resizeImages,
    validator.body(uploadDocumentSchema),
    Controller.uploadDocumentByBody,
  );

router
  .route("/:id/documents/:docKey/upload")
  .post(
    permitUpdate,
    requireWriteAccess,
    uploadImages,
    resizeImages,
    Controller.uploadDocument,
  );

router
  .route("/:id/work-file")
  .post(
    permitUpdate,
    requireWriteAccess,
    uploadImages,
    resizeImages,
    Controller.uploadWorkFile,
  );

router
  .route("/:id/protocol")
  .post(
    permitApprove,
    validator.body(generateProtocolSchema),
    Controller.generateProtocol,
  );

router
  .route("/:id/protocol/sign")
  .post(permitSign, Controller.signProtocol);

router
  .route("/:id/decision")
  .post(
    permitApprove,
    validator.body(makeDecisionSchema),
    Controller.makeDecision,
  );

router
  .route("/:id/member-decision")
  .post(
    permitApprove,
    validator.body(memberDecisionSchema),
    Controller.memberDecision,
  );

module.exports = router;
