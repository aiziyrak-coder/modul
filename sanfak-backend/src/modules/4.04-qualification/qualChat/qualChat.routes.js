const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./qualChat.controller");

router.use(authenticate);

router.get("/contacts", permit(MODULES.CHAT, [ACTIONS.READ_ALL]), Controller.contacts);

router.get("/conversations", permit(MODULES.CHAT, [ACTIONS.READ_ALL]), Controller.conversations);

router.get("/profile", permit(MODULES.CHAT, [ACTIONS.READ_ALL]), Controller.getProfile);
router.put("/profile", permit(MODULES.CHAT, [ACTIONS.READ_ALL]), Controller.updateProfile);

router.get(
  "/messages/unread-count",
  permit(MODULES.CHAT, [ACTIONS.READ_ALL]),
  Controller.chatUnread,
);
router.post("/messages", permit(MODULES.CHAT, [ACTIONS.CREATE]), Controller.chatSend);
router.delete("/messages/:id", permit(MODULES.CHAT, [ACTIONS.DELETE]), Controller.chatDelete);
router.get("/messages/:userId", permit(MODULES.CHAT, [ACTIONS.READ]), Controller.chatThread);

module.exports = router;
