const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyNotice.controller");
const V = require("./residencyNotice.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_NOTICE;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addNotice)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllNotices);

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateNotices,
  );

router
  .route("/absence-streak")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.streakQuery),
    C.absenceStreak,
  );

router
  .route("/:id/view")
  .put(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.viewNotice);

router
  .route("/:id/review")
  .put(
    permit(M, [ACTIONS.APPROVE]),
    validator.params(V.idSchema),
    validator.body(V.reviewSchema),
    C.reviewNotice,
  );

router
  .route("/:id/pdf")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.downloadPdf);

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findNotice)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateNotice,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteNotice);

module.exports = router;
