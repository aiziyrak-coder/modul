const router = require("express").Router();
const { ErrorHandler } = require("#shared/error");
const Controller = require("./listenerSync.controller");

function keyGate(req, _res, next) {
  const key = req.headers["x-service-key"];
  if (!process.env.SERVICE_KEY || key !== process.env.SERVICE_KEY) {
    return next(new ErrorHandler(401, "Service kaliti yaroqsiz"));
  }
  return next();
}

function actAsGate(req, _res, next) {
  const actAs = req.headers["x-act-as"];
  const actAsListener = req.headers["x-act-as-listener"];
  if (!actAs && !actAsListener) {
    return next(new ErrorHandler(401, "X-Act-As yoki X-Act-As-Listener yuborilmadi"));
  }
  req.actAs = actAs ? String(actAs) : null;
  req.actAsListener = actAsListener ? String(actAsListener) : null;
  return next();
}

router.use(keyGate);

router.get("/listeners", Controller.listeners);

router.get("/users", Controller.users);

router.post("/notify", Controller.notify);

router.get("/progress-context", actAsGate, Controller.progressContext);
router.post("/topic-completion", actAsGate, Controller.upsertTopicCompletion);

module.exports = router;
