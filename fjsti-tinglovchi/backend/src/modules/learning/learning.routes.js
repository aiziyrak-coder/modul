const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");
const C = require("./progress.controller");

const ROOT = "/qualification-topic-completions";

router.get(`${ROOT}/my`, C.myProgress);
router.post(`${ROOT}/start`, C.startTopic);
router.post(`${ROOT}/advance`, C.advanceTopic);

router.post(`${ROOT}/scenario`, proxyToMain);

router.get("/qualification-topic-lectures", proxyToMain);
router.get("/qualification-topic-practicals", proxyToMain);
router.get("/qualification-topic-videos", proxyToMain);
router.get("/qualification-topic-scenarios", proxyToMain);

module.exports = router;
