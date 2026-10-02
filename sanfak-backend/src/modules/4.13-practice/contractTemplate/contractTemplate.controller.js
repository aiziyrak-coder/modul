const { ErrorHandler } = require("#shared/error");
const service = require("./contractTemplate.service");

module.exports = {
  getTemplate: async (req, res, next) => {
    try {
      const doc = await service.get();
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Shablonni olishda xato", err.message));
    }
  },

  saveTemplate: async (req, res, next) => {
    try {
      const doc = await service.save(req.body.body, req.user._id);
      return res.status(200).json({ message: "Shablon saqlandi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Shablonni saqlashda xato", err.message));
    }
  },
};
