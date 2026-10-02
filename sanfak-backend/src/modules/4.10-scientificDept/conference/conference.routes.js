const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./conference.controller");
const {
  createConferenceSchema,
  updateConferenceSchema,
  acceptConferenceSchema,
  conferenceQuerySchema,
  conferencePaginateSchema,
} = require("./conference.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.CONFERENCE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.CONFERENCE, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.CONFERENCE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.CONFERENCE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.CONFERENCE, [ACTIONS.DELETE]);
const scope = scopeFilter("department", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(permitAdd, validator.body(createConferenceSchema), Controller.addConference)
  .get(
    permitReadAll,
    scope,
    validator.query(conferenceQuerySchema),
    Controller.findAllConferences,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(conferencePaginateSchema),
    Controller.paginateConferences,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneConference,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateConferenceSchema),
    Controller.updateConference,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteConference);

router
  .route("/:id/accept")
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(acceptConferenceSchema),
    Controller.acceptConference,
  );

module.exports = router;
