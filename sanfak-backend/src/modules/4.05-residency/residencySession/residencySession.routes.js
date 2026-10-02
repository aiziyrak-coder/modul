const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencySession.controller");
const V = require("./residencySession.validation");

router.use(authenticate);

const M = MODULES.RESIDENT_ATTENDANCE;
const P_ANNOUNCE = permit(M, [ACTIONS.CREATE]);
const P_READ = permit(M, [ACTIONS.READ_ALL]);
const P_CANCEL = permit(M, [ACTIONS.UPDATE]);

router.route("/").post(P_ANNOUNCE, validator.body(V.announceSchema), C.announce);

router.route("/paginate").get(P_READ, validator.query(V.paginateQuery), C.paginate);
router
  .route("/unsupervised-residents")
  .get(P_ANNOUNCE, validator.query(V.unsupervisedQuery), C.unsupervised);
router.use(require("./residencySessionGrade.routes"));
router
  .route("/:id/cancel")
  .put(P_CANCEL, validator.params(V.idSchema), validator.body(V.cancelSchema), C.cancel);

router.route("/:id").get(P_READ, validator.params(V.idSchema), C.findOne);

module.exports = router;
