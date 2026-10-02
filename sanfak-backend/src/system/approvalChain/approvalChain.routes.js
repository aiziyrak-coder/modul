const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./approvalChain.controller");
const { createSchema, signSchema, rejectSchema } = require("./approvalChain.validation");

router.use(authenticate);

router.route("/").post(
  permit(MODULES.APPROVAL_CHAIN, [ACTIONS.CREATE]),
  validator.body(createSchema),
  Controller.create,
);
router
  .route("/document/:documentId")
  .get(permit(MODULES.APPROVAL_CHAIN, [ACTIONS.READ]), Controller.findByDocument);
router
  .route("/:id")
  .get(permit(MODULES.APPROVAL_CHAIN, [ACTIONS.READ]), Controller.findById);
router.route("/:id/sign").put(
  permit(MODULES.APPROVAL_CHAIN, [ACTIONS.SIGN]),
  validator.body(signSchema),
  Controller.sign,
);
router.route("/:id/reject").put(
  permit(MODULES.APPROVAL_CHAIN, [ACTIONS.REJECT]),
  validator.body(rejectSchema),
  Controller.reject,
);

module.exports = router;
