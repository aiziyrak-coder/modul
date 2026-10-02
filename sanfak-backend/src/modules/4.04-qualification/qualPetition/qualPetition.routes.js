const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualPetition.controller");
const Validation = require("./qualPetition.validation");
const ValidationCommon = require("#validators/common");
const Upload = require("./qualPetition.upload");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_PETITION, [ACTIONS.CREATE]),
    Upload.uploadPetitionDocs,
    Upload.savePetitionDocs,
    validator.body(Validation.createSchema),
    Controller.addQualPetition,
  )
  .get(
    permit(MODULES.QUAL_PETITION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualPetitions,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_PETITION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualPetitions,
  );

router
  .route("/my")
  .get(
    permit(MODULES.QUAL_PETITION, [ACTIONS.READ]),
    Controller.findMyPetitions,
  );

router
  .route("/my/profile")
  .get(
    permit(MODULES.QUAL_PETITION, [ACTIONS.READ]),
    Controller.findMyOneIdProfile,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_PETITION, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualPetition,
  );

router
  .route("/accept/:id")
  .put(
    permit(MODULES.QUAL_PETITION, [ACTIONS.APPROVE]),
    Controller.acceptQualPetition,
  );

router
  .route("/reject/:id")
  .put(
    permit(MODULES.QUAL_PETITION, [ACTIONS.REJECT]),
    Controller.rejectQualPetition,
  );

module.exports = router;
