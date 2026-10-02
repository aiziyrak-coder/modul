const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./announcement.controller");
const {
  announcementSchema,
  findAnnouncementsSchema,
  paginateAnnouncementsSchema,
} = require("./announcement.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadRankDocs } = require("#modules/4.09-instituteCouncil/_shared/uploadRankDocs");
const { resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.ANNOUNCEMENT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.ANNOUNCEMENT, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.ANNOUNCEMENT, [ACTIONS.READ]);
const permitDelete = permit(MODULES.ANNOUNCEMENT, [ACTIONS.DELETE]);

router
  .route("/")
  .post(
    permitAdd,
    uploadRankDocs,
    resizeImages,
    validator.body(announcementSchema),
    Controller.addAnnouncement,
  )
  .get(
    permitReadAll,
    validator.query(findAnnouncementsSchema),
    Controller.findAllAnnouncements,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(paginateAnnouncementsSchema),
    Controller.paginateAnnouncements,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneAnnouncement)
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteAnnouncement);

module.exports = router;
