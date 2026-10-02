const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const Controller = require("./notification.controller");

router.use(authenticate);

router.get("/", Controller.myFeed);
router.get("/unread-count", Controller.unreadCount);
router.put("/read-all", Controller.markAllRead);
router.put("/:id/read", Controller.markRead);
router.delete("/:id", Controller.delete);

router.get("/preferences/me", Controller.getPreferences);
router.put("/preferences/me", Controller.updatePreferences);

module.exports = router;
