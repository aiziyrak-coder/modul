const { ErrorHandler } = require("#shared/error");
const SlaConfig = require("./slaConfig.model");

module.exports = {
  add: async (req, res, next) => {
    try {
      const doc = await new SlaConfig(req.body).save();
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "SLA config qo'shishda xato", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const { role, documentType, active } = req.query;
      const filter = {};
      if (role) filter.role = role;
      if (documentType) filter.documentType = documentType;
      if (active !== undefined) filter.active = active === "true";

      const docs = await SlaConfig.find(filter).sort({ role: 1 }).lean();
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xato", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await SlaConfig.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xato", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await SlaConfig.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xato", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await SlaConfig.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "O'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },
};
