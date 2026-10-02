const { ErrorHandler } = require("#shared/error");
const { translaterLanguage } = require("#shared/translate");
const { PAGINATION } = require("#config/constants");
const {
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const EducationFormModel = require("./educationForm.model");

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
      const doc = await new EducationFormModel(req.body).save();
      if (!doc)
        return next(new ErrorHandler(400, "Failed to save educationForm"));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add educationForm", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      let q = EducationFormModel.find(filter, EXCLUDE);
      q = applyPopulate(q);
      let docs = await q.exec();

      docs = maybeTranslate(docs, req.query.language);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find educationForm", err.message),
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

      const result = await EducationFormModel.paginate(filter, {
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
        new ErrorHandler(400, "Failed to paginate educationForm", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      let q = EducationFormModel.findById(req.params.id, EXCLUDE);
      q = applyPopulate(q);
      let doc = await q.exec();
      if (!doc) return next(new ErrorHandler(404, "educationForm not found"));

      doc = maybeTranslate(doc, req.query.language);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find educationForm", err.message),
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await EducationFormModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "educationForm not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update educationForm", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await EducationFormModel.findByIdAndDelete(
        req.params.id,
      ).exec();
      if (!doc) return next(new ErrorHandler(404, "educationForm not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete educationForm", err.message),
      );
    }
  },
};
