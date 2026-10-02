const { ErrorHandler } = require("#shared/error");
const service = require("./docSetting.service");

module.exports = {
  getSettings: async (req, res, next) => {
    try {
      const doc = await service.getOrCreate();
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get doc settings", err.message),
      );
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const doc = await service.update(req.body, req.user._id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update doc settings", err.message),
      );
    }
  },
};
