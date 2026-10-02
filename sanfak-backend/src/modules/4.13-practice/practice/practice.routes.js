const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const requireEri = require("#shared/requireEri");
const { isDevEnv } = require("#shared/env");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./practice.controller");
const {
  contractSchema,
  updateSchema,
  signSchema,
  rejectSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./practice.validation");

router.use(authenticate);

const permitCreate = permit(MODULES.PRACTICE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.PRACTICE, [ACTIONS.READ_ALL]);
const permitRead = permit(MODULES.PRACTICE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.PRACTICE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.PRACTICE, [ACTIONS.DELETE]);
const permitSign = permit(MODULES.PRACTICE, [ACTIONS.SIGN]);
const permitReject = permit(MODULES.PRACTICE, [ACTIONS.REJECT]);
const permitChangeStatus = permit(MODULES.PRACTICE, [ACTIONS.CHANGE_STATUS]);
const permitExport = permit(MODULES.PRACTICE, [ACTIONS.EXPORT]);

router.get("/report", permitReadAll, Controller.getPracticeReport);

router.post(
  "/contracts",
  permitCreate,
  validator.body(contractSchema),
  Controller.addContract,
);

router.get(
  "/contracts",
  permitReadAll,
  validator.query(findAll),
  Controller.findAllContracts,
);

router.get(
  "/contracts/paginate",
  permitReadAll,
  validator.query(paginate),
  Controller.paginateContracts,
);

router.get("/contracts/tabs-count", permitReadAll, Controller.tabsCount);

router.get(
  "/contracts/:id",
  permitRead,
  validator.params(readSchema),
  Controller.findOneContract,
);

router.get(
  "/contracts/:id/preview",
  permitRead,
  validator.params(readSchema),
  Controller.previewContract,
);

router.get(
  "/contracts/:id/document.doc",
  permitExport,
  validator.params(readSchema),
  Controller.downloadDoc,
);

router.put(
  "/contracts/:id",
  permitUpdate,
  validator.params(readSchema),
  validator.body(updateSchema),
  Controller.updateContract,
);

router.delete(
  "/contracts/:id",
  permitDelete,
  validator.params(deleteSchema),
  Controller.deleteContract,
);

router.patch(
  "/contracts/:id/send-to-rector",
  permitChangeStatus,
  validator.params(readSchema),
  Controller.sendToRector,
);

router.put(
  "/contracts/:id/rector-sign",
  permitSign,
  validator.params(readSchema),
  validator.body(signSchema),
  requireEri({ optional: isDevEnv() }),
  Controller.rectorSign,
);

router.put(
  "/contracts/:id/org-sign",
  permitSign,
  validator.params(readSchema),
  validator.body(signSchema),
  requireEri({ optional: isDevEnv() }),
  Controller.orgSign,
);

router.patch(
  "/contracts/:id/reject",
  permitReject,
  validator.params(readSchema),
  validator.body(rejectSchema),
  Controller.rejectContract,
);

module.exports = router;
