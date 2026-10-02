const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./announcement.controller");
const {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} = require("./announcement.validation");

router.use(authenticate);

const pAdmin = permit(MODULES.ANNOUNCEMENT, [
  ACTIONS.CREATE,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
]);
const pRead = permit(MODULES.ANNOUNCEMENT, [ACTIONS.READ, ACTIONS.READ_ALL]);

router.post(
  "/",
  pAdmin,
  validator.body(createAnnouncementSchema),
  Controller.addAnnouncement,
);
router.get("/", pRead, Controller.findAll);
router.get("/paginate", pAdmin, Controller.paginate);

router.get("/unread-count", pRead, Controller.getUnreadCount);
router.post("/send-to-group", pAdmin, Controller.sendToGroup);
router.get("/module/:module", pRead, Controller.getModuleAnnouncements);

router.get("/:id", pRead, Controller.findOne);
router.put(
  "/:id",
  pAdmin,
  validator.body(updateAnnouncementSchema),
  Controller.update,
);
router.delete("/:id", pAdmin, Controller.delete);

router.get("/:id/read-stats", pAdmin, Controller.getReadStats);

router.get("/my/list", pRead, Controller.getMyAnnouncements);
router.put("/:id/mark-read", pRead, Controller.markAsRead);

module.exports = router;
