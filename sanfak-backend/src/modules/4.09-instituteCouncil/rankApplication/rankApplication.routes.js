const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { resizeImages } = require("#shared/uploadFiles");
const {
  uploadRankDocs,
} = require("#modules/4.09-instituteCouncil/_shared/uploadRankDocs");
const Controller = require("./rankApplication.controller");
const {
  createSchema,
  updateSchema,
  acceptSchema,
  diplomaSchema,
  returnSchema,
  findSchema,
  paginateSchema,
} = require("./rankApplication.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.RANK_APPLICATION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.RANK_APPLICATION, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.RANK_APPLICATION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.RANK_APPLICATION, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.RANK_APPLICATION, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.RANK_APPLICATION, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.RANK_APPLICATION, [ACTIONS.REJECT]);

router
  .route("/")
  .post(
    permitAdd,
    uploadRankDocs,
    resizeImages,
    validator.body(createSchema),
    Controller.addApplication,
  )
  .get(
    permitReadAll,
    validator.query(findSchema),
    Controller.findAllApplications,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(paginateSchema),
    Controller.paginateApplications,
  );

router
  .route("/tabs-count")
  .get(permitReadAll, validator.query(findSchema), Controller.tabsCount);

router
  .route("/:id/accept")
  .patch(
    permitApprove,
    uploadRankDocs,
    resizeImages,
    validator.body(acceptSchema),
    Controller.acceptApplication,
  );

router
  .route("/:id/return")
  .patch(
    permitReject,
    validator.body(returnSchema),
    Controller.returnApplication,
  );

router
  .route("/:id/diploma")
  .patch(
    permitApprove,
    uploadRankDocs,
    resizeImages,
    validator.body(diplomaSchema),
    Controller.setDiploma,
  );

router
  .route("/:id/archive")
  .patch(permitApprove, validator.params(readSchema), Controller.archiveApplication);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneApplication)
  .put(
    permitUpdate,
    uploadRankDocs,
    resizeImages,
    validator.body(updateSchema),
    Controller.updateApplication,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteApplication);

module.exports = router;
