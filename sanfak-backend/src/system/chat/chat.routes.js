const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./chat.controller");

router.use(authenticate);

router.post(
  "/send",
  permit(MODULES.CHAT, [ACTIONS.CREATE]),
  Controller.sendMessage,
);

router.get(
  "/conversations",
  permit(MODULES.CHAT, [ACTIONS.READ_ALL]),
  Controller.getMyConversations,
);

router.get(
  "/unread-count",
  permit(MODULES.CHAT, [ACTIONS.READ_ALL]),
  Controller.getUnreadCount,
);

router.get(
  "/:userId",
  permit(MODULES.CHAT, [ACTIONS.READ]),
  Controller.getConversation,
);

router.delete(
  "/:id",
  permit(MODULES.CHAT, [ACTIONS.DELETE]),
  Controller.deleteMessage,
);

module.exports = router;
