const router = require("express").Router();
const { ErrorHandler } = require("#shared/error");
const Controller = require("./listenerAuth.controller");

function serviceKey(req, _res, next) {
  const key = req.headers["x-service-key"];
  if (!process.env.SERVICE_KEY || key !== process.env.SERVICE_KEY) {
    return next(new ErrorHandler(401, "Service kaliti yaroqsiz"));
  }
  return next();
}

router.post("/resolve", serviceKey, Controller.resolve);

module.exports = router;
