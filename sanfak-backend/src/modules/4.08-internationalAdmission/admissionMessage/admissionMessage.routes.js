const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./admissionMessage.controller");
const {
  sendSchema,
  findAll,
  paginate,
  previewQuery,
  readSchema,
} = require("./admissionMessage.validation");

router.use(authenticate);

const M = MODULES.ADMISSION_MESSAGE;

router.post("/", permit(M, [ACTIONS.CREATE]), validator.body(sendSchema), Controller.sendMessage);

router.get("/", permit(M, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAllMessages);

router.get(
  "/paginate",
  permit(M, [ACTIONS.READ_ALL]),
  validator.query(paginate),
  Controller.paginateMessages,
);
router.get(
  "/recipients-count",
  permit(M, [ACTIONS.READ_ALL]),
  validator.query(previewQuery),
  Controller.previewRecipients,
);

router.get("/:id", permit(M, [ACTIONS.READ]), validator.params(readSchema), Controller.findOneMessage);

module.exports = router;
