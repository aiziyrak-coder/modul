const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./referenceLookup.controller");

router.use(authenticate);

router
  .route("/faculties")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ]), Controller.faculties);
router
  .route("/departments")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ]), Controller.departments);
router
  .route("/teachers")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ]), Controller.teachers);
router
  .route("/signers")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ]), Controller.signers);

module.exports = router;
