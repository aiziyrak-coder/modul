const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyAnnouncement.controller");
const V = require("./residencyAnnouncement.validation");
const { receiveFiles, inspectFiles } = require("./residencyAnnouncement.upload");

router.use(authenticate);

const M = MODULES.RESIDENCY_ANNOUNCEMENT;

router
  .route("/")
  .post(
    permit(M, [ACTIONS.CREATE]),
    validator.body(V.createSchema),
    C.addAnnouncement,
  )
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.listQuery),
    C.findAllAnnouncements,
  );

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateAnnouncements,
  );

router
  .route("/:id/read")
  .put(permit(M, [ACTIONS.READ_ALL]), validator.params(V.idSchema), C.markRead);

router
  .route("/:id/read-stats")
  .get(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    C.requireVisibleAnnouncement,
    C.readStats,
  );

router
  .route("/:id/attachments")
  .post(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    C.requireVisibleAnnouncement,
    receiveFiles,
    inspectFiles,
    C.addAttachments,
  );

router
  .route("/:id/attachments/:attachmentId/download")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.params(V.attachmentParams),
    C.downloadAttachment,
  );

router
  .route("/:id/attachments/:attachmentId")
  .delete(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.attachmentParams),
    C.requireVisibleAnnouncement,
    C.deleteAttachment,
  );

router
  .route("/:id")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.requireVisibleAnnouncement,
    C.updateAnnouncement,
  )
  .delete(
    permit(M, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    C.requireVisibleAnnouncement,
    C.deleteAnnouncement,
  );

module.exports = router;
