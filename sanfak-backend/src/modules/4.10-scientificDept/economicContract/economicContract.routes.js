const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./economicContract.controller");
const {
  createContractSchema,
  updateContractSchema,
  rejectContractSchema,
  contractQuerySchema,
  contractPaginateSchema,
} = require("./economicContract.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.ECONOMIC_CONTRACT, [ACTIONS.REJECT]);

const scope = scopeFilter("department", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createContractSchema),
    Controller.addEconomicContract,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(contractQuerySchema),
    Controller.findAllEconomicContracts,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(contractPaginateSchema),
    Controller.paginateEconomicContracts,
  );

router
  .route("/:id/archive")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.downloadContractArchive,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneEconomicContract,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateContractSchema),
    Controller.updateEconomicContract,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteEconomicContract,
  );

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveEconomicContract);

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectContractSchema),
    Controller.rejectEconomicContract,
  );

module.exports = router;
