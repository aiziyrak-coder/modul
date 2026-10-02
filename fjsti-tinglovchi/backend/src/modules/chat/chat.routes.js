const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");
const C = require("./chat.controller");

router.get("/qualification-chat/contacts", proxyToMain);

router.get("/chat/conversations", C.conversations);
router.get("/qualification-chat/conversations", C.conversations);

router.get("/chat/unread-count", C.unreadCount);

router.post("/chat/send", C.send);
router.delete("/chat/:id", C.remove);

router.get("/chat/:userId", C.thread);

module.exports = router;
