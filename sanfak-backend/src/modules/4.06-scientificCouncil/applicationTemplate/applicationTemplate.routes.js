const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const Controller = require("./applicationTemplate.controller");

router.use(authenticate);

const permitRead = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.READ]);
const permitWrite = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.MANAGE_MEMBERS]);

router
  .route("/")
  .get(permitRead, Controller.getTemplate)
  .post(permitWrite, uploadImages, resizeImages, Controller.uploadTemplate)
  .delete(permitWrite, Controller.deleteTemplate);

module.exports = router;
