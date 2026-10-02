const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualContract.controller");
const Validation = require("./qualContract.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_CONTRACT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualContracts,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_CONTRACT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualContracts,
  );

router
  .route("/my")
  .get(
    permit(MODULES.QUAL_CONTRACT, [ACTIONS.READ]),
    Controller.getMyContracts,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_CONTRACT, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualContract,
  )
  .delete(
    permit(MODULES.QUAL_CONTRACT, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualContract,
  );

module.exports = router;
