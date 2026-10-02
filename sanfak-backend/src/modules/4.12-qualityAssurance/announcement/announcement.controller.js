const { ErrorHandler } = require("#shared/error");
const service = require("./announcement.service");

module.exports = {
  findAllAnnouncements: async (req, res, next) => {
    try {
      return res.status(200).json(await service.list(req.query.search));
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonlarni olishda xato", err.message));
    }
  },

  findOneAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "E'lon topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonni olishda xato", err.message));
    }
  },

  addAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.create(req.body, req.user._id);
      return res.status(201).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "E'lon yaratishda xato", err.message));
    }
  },

  updateAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "E'lon topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonni yangilashda xato", err.message));
    }
  },

  deleteAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "E'lon topilmadi" });
      return res.status(200).json({ message: "E'lon o'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonni o'chirishda xato", err.message));
    }
  },
};
