const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./votingSession.controller");
const {
  votingSessionSchema,
  updateSessionSchema,
  findSessionsSchema,
  paginateSessionsSchema,
  paginateReportSchema,
  reportPdfSchema,
  diplomaSchema,
} = require("./votingSession.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.VOTING_SESSION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.VOTING_SESSION, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.VOTING_SESSION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.VOTING_SESSION, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.VOTING_SESSION, [ACTIONS.DELETE]);
const permitChangeStatus = permit(MODULES.VOTING_SESSION, [ACTIONS.CHANGE_STATUS]);
const permitExport = permit(MODULES.VOTING_SESSION, [ACTIONS.EXPORT]);

router
  .route("/")
  .post(permitAdd, validator.body(votingSessionSchema), Controller.addSession)
  .get(permitReadAll, validator.query(findSessionsSchema), Controller.findAllSessions);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(paginateSessionsSchema), Controller.paginateSessions);

router.route("/tabs-count").get(permitReadAll, Controller.tabsCount);

router.route("/report").get(permitExport, Controller.reportList);

router
  .route("/report/paginate")
  .get(permitExport, validator.query(paginateReportSchema), Controller.paginateReport);

router
  .route("/report/pdf")
  .get(permitExport, validator.query(reportPdfSchema), Controller.reportPdf);

router
  .route("/:id/candidates/:userId/diploma")
  .patch(
    permitUpdate,
    uploadImages,
    resizeImages,
    validator.body(diplomaSchema),
    Controller.setDiploma,
  );

router.route("/:id/finalize").put(permitChangeStatus, Controller.finalize);
router.route("/:id/report").get(permitExport, Controller.getReport);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneSession)
  .put(permitUpdate, validator.body(updateSessionSchema), Controller.updateSession)
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteSession);

module.exports = router;
