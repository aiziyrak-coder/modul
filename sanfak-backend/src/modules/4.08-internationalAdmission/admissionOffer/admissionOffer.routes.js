const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./admissionOffer.controller");
const { saveSchema } = require("./admissionOffer.validation");

router.use(authenticate);

const M = MODULES.ADMISSION_OFFER;

router.get("/", permit(M, [ACTIONS.READ_ALL]), Controller.getOffer);
router.put("/", permit(M, [ACTIONS.UPDATE]), validator.body(saveSchema), Controller.saveOffer);

module.exports = router;
