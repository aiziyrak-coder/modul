const { ErrorHandler } = require("#shared/error");
const service = require("./listenerAuth.service");

module.exports = {
  resolve: async (req, res, next) => {
    try {
      const { pin, userId } = req.body || {};
      if (!pin && !userId) {
        return next(new ErrorHandler(400, "pin yoki userId kerak"));
      }
      const data = pin
        ? await service.resolveByPin(String(pin))
        : await service.resolveByUserId(String(userId));
      return res.status(200).json(data);
    } catch (err) {
      return next(
        err.statusCode
          ? err
          : new ErrorHandler(400, "Tinglovchi identifikatsiyasida xato", err.message),
      );
    }
  },
};
