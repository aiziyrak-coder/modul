const { ErrorHandler } = require("#shared/error");
const service = require("./listenerSync.service");

module.exports = {
  listeners: async (_req, res, next) => {
    try {
      return res.status(200).json(await service.listListeners());
    } catch (err) {
      return next(
        err.statusCode ? err : new ErrorHandler(400, "Tinglovchilar ro'yxatida xato", err.message),
      );
    }
  },

  users: async (req, res, next) => {
    try {
      return res.status(200).json(await service.listUsersForDisplay(req.query.ids));
    } catch (err) {
      return next(
        err.statusCode ? err : new ErrorHandler(400, "Foydalanuvchilarda xato", err.message),
      );
    }
  },

  notify: async (req, res, next) => {
    try {
      return res.status(200).json(await service.notifyUser(req.body || {}));
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "Yetkazishda xato", err.message));
    }
  },

  progressContext: async (req, res, next) => {
    try {
      const data = await service.progressContext({ listenerId: req.actAsListener, userId: req.actAs }, req.query.course);
      return res.status(200).json(data);
    } catch (err) {
      return next(
        err.statusCode ? err : new ErrorHandler(400, "Progress kontekstida xato", err.message),
      );
    }
  },

  upsertTopicCompletion: async (req, res, next) => {
    try {
      const data = await service.upsertTopicCompletion({ listenerId: req.actAsListener, userId: req.actAs }, req.body);
      return res.status(200).json(data);
    } catch (err) {
      return next(
        err.statusCode ? err : new ErrorHandler(400, "Sinxronizatsiyada xato", err.message),
      );
    }
  },
};
