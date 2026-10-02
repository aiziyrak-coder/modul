const { ErrorHandler } = require("#shared/error");
const PublicOfferModel = require("./publicOffer.model");

const sortSections = (sections = []) =>
  [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

module.exports = {
  create: async (req, res, next) => {
    try {
      const { sections } = req.body;

      await PublicOfferModel.updateMany(
        { active: true },
        { $set: { active: false } },
      );

      const doc = await PublicOfferModel.create({
        sections: sortSections(sections),
        active: true,
      });

      return res.status(201).json({
        message: "Yangi oferta yaratildi",
        data: doc,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Oferta yaratishda xatolik", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const doc = await PublicOfferModel.findOne({ active: true })

        .exec();
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ofertani olishda xatolik", err.message),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, active } = req.query;
      const filter = {};
      if (active !== undefined) {
        filter.active = active === "true" || active === true;
      }

      const result = await PublicOfferModel.paginate(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { createdAt: -1 },
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await PublicOfferModel.findById(req.params.id).exec();
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xatolik", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const { sections, active } = req.body;
      const $set = {};
      if (sections) $set.sections = sortSections(sections);
      if (active !== undefined) $set.active = active;

      const doc = await PublicOfferModel.findOneAndUpdate(
        { active: true },
        $set,
        { new: true, upsert: true, runValidators: true },
      );

      return res.status(200).json({
        message: "Oferta yangilandi",
        data: doc,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateById: async (req, res, next) => {
    try {
      const { sections, active } = req.body;
      const $set = {};
      if (sections) $set.sections = sortSections(sections);
      if (active !== undefined) $set.active = active;

      if (active === true) {
        await PublicOfferModel.updateMany(
          { _id: { $ne: req.params.id }, active: true },
          { $set: { active: false } },
        );
      }

      const doc = await PublicOfferModel.findByIdAndUpdate(
        req.params.id,
        $set,
        { new: true, runValidators: true },
      );
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      return res.status(200).json({
        message: "Oferta yangilandi",
        data: doc,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await PublicOfferModel.findById(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      if (doc.active) {
        return next(
          new ErrorHandler(
            400,
            "Active ofertani o'chirib bo'lmaydi. Avval boshqa versiyani active qiling",
          ),
        );
      }

      await doc.deleteOne();
      return res.status(200).json({
        message: "Oferta o'chirildi",
        _id: doc._id,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },
};
