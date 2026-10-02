const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./announcement.controller");
const {
  announcementSchema,
  announcementUpdateSchema,
} = require("./announcement.validation");
const { findAll, readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.EQ_ANNOUNCEMENT, [ACTIONS.CREATE]);
const permitUpdate = permit(MODULES.EQ_ANNOUNCEMENT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.EQ_ANNOUNCEMENT, [ACTIONS.DELETE]);
const permitRead = permit(MODULES.EQ_ANNOUNCEMENT, [
  ACTIONS.READ,
  ACTIONS.READ_OWN,
  ACTIONS.READ_ALL,
]);

router
  .route("/")
  .post(permitAdd, validator.body(announcementSchema), Controller.addAnnouncement)
  .get(permitRead, validator.query(findAll), Controller.findAllAnnouncements);

router
  .route("/:id")
  .get(permitRead, validator.params(readSchema), Controller.findOneAnnouncement)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(announcementUpdateSchema),
    Controller.updateAnnouncement,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteAnnouncement,
  );

module.exports = router;
