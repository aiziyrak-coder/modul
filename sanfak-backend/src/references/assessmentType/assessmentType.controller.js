const { ErrorHandler } = require("#shared/error");
const { PAGINATION } = require("#config/constants");
const { buildPlainSearch, applyFilters } = require("#shared/searchFilter");
const AssessmentTypeModel = require("./assessmentType.model");

const FILTER_FIELDS = ["active"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const buildFilter = (query) => ({
  ...buildPlainSearch("title", query.search),
  ...applyFilters(query, FILTER_FIELDS),
});

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new AssessmentTypeModel(req.body).save();
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.code === 11000) {
        return next(new ErrorHandler(409, "Bunday yozuv allaqachon mavjud"));
      }
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turini qo'shishda xatolik",
          err.message,
        ),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const docs = await AssessmentTypeModel.find(buildFilter(req.query), EXCLUDE)
        .sort({ title: 1 })
        .lean()
        .exec();
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turlarini olishda xatolik",
          err.message,
        ),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const result = await AssessmentTypeModel.paginate(
        buildFilter(req.query),
        {
          page: Math.max(parseInt(page) || PAGINATION.DEFAULT_PAGE, 1),
          limit: Math.min(
            parseInt(limit) || PAGINATION.DEFAULT_LIMIT,
            PAGINATION.MAX_LIMIT,
          ),
          sort: { title: 1 },
          select: EXCLUDE,
          lean: true,
        },
      );
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turlarini sahifalashda xatolik",
          err.message,
        ),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await AssessmentTypeModel.findById(req.params.id, EXCLUDE)
        .lean()
        .exec();
      if (!doc) {
        return next(new ErrorHandler(404, "Yakuniy baholash turi topilmadi"));
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turini olishda xatolik",
          err.message,
        ),
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await AssessmentTypeModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true },
      ).exec();
      if (!doc) {
        return next(new ErrorHandler(404, "Yakuniy baholash turi topilmadi"));
      }
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turini yangilashda xatolik",
          err.message,
        ),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await AssessmentTypeModel.findByIdAndDelete(
        req.params.id,
      ).exec();
      if (!doc) {
        return next(new ErrorHandler(404, "Yakuniy baholash turi topilmadi"));
      }
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Yakuniy baholash turini o'chirishda xatolik",
          err.message,
        ),
      );
    }
  },
};
