const { ErrorHandler } = require("#shared/error");
const service = require("./progress.service");

const wrap = (fn, msg) => async (req, res, next) => {
  try {
    return res.status(200).json(await fn(req));
  } catch (err) {
    return next(err.statusCode ? err : new ErrorHandler(400, msg, err.message));
  }
};

module.exports = {
  myProgress: wrap(
    (req) => service.myProgress(req.user.id, req.query.course),
    "Progressni olishda xatolik",
  ),
  startTopic: wrap(
    (req) => service.startTopic(req.user.id, req.body || {}),
    "Mavzuni boshlashda xatolik",
  ),
  advanceTopic: wrap(
    (req) => service.advanceTopic(req.user.id, req.body || {}),
    "Mavzuni ilgarilatishda xatolik",
  ),
};
