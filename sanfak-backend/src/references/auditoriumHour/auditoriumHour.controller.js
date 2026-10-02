const { ErrorHandler } = require("#shared/error");
const { translaterLanguage } = require("#shared/translate");
const { PAGINATION } = require("#config/constants");
const {
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const AuditoriumHourModel = require("./auditoriumHour.model");

const FILTER_FIELDS = ["active"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [];

const buildSearch = (query) => {
  if (!query.search) return {};
  return buildMultiLangSearch("title", query.language || "uz", query.search);
};

const applyPopulate = (q) => {
  if (!POPULATE || POPULATE.length === 0) return q;
  for (const p of POPULATE) q = q.populate(p);
  return q;
};

const maybeTranslate = (data, language) => {
  if (!language || !data) return data;
  return translaterLanguage(data, language);
};

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new AuditoriumHourModel(req.body).save();
      if (!doc)
        return next(new ErrorHandler(400, "Failed to save auditoriumHour"));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add auditoriumHour", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      let q = AuditoriumHourModel.find(filter, EXCLUDE);
      q = applyPopulate(q);
      let docs = await q.exec();

      docs = maybeTranslate(docs, req.query.language);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find auditoriumHour", err.message),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      const result = await AuditoriumHourModel.paginate(filter, {
        page: Math.max(parseInt(page) || PAGINATION.DEFAULT_PAGE, 1),
        limit: Math.min(
          parseInt(limit) || PAGINATION.DEFAULT_LIMIT,
          PAGINATION.MAX_LIMIT,
        ),
        select: EXCLUDE,
        lean: true,
        populate: POPULATE,
      });

      if (result?.docs) result.docs = maybeTranslate(result.docs, req.query.language);
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate auditoriumHour", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      let q = AuditoriumHourModel.findById(req.params.id, EXCLUDE);
      q = applyPopulate(q);
      let doc = await q.exec();
      if (!doc) return next(new ErrorHandler(404, "auditoriumHour not found"));

      doc = maybeTranslate(doc, req.query.language);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find auditoriumHour", err.message),
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await AuditoriumHourModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "auditoriumHour not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update auditoriumHour", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await AuditoriumHourModel.findByIdAndDelete(
        req.params.id,
      ).exec();
      if (!doc) return next(new ErrorHandler(404, "auditoriumHour not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete auditoriumHour", err.message),
      );
    }
  },
};
