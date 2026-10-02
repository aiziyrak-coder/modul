const { ErrorHandler } = require("#shared/error");
const service = require("./auth.service");

module.exports = {
  login: async (req, res, next) => {
    try {
      const { oneIdPin } = req.body || {};
      if (!oneIdPin || !/^\d{14}$/.test(String(oneIdPin))) {
        return next(new ErrorHandler(400, "PIN 14 ta raqamdan iborat bo'lishi kerak"));
      }
      const data = await service.login(String(oneIdPin));
      return res.status(200).json(data);
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "Kirishda xatolik", err.message));
    }
  },

  refresh: async (req, res, next) => {
    try {
      const token = req.body?.refreshToken || req.cookies?.refreshToken;
      const data = await service.refresh(token);
      return res.status(200).json(data);
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(401, "Refresh xatosi", err.message));
    }
  },

  profile: async (req, res, next) => {
    try {
      const data = await service.profile(req.user.id);
      return res.status(200).json(data);
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "Profil xatosi", err.message));
    }
  },
};
