const { ErrorHandler } = require("#shared/error");
const { translaterLanguage } = require("#shared/translate");
const { PAGINATION } = require("#config/constants");
const {
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const ScienceModel = require("./science.model");

const FILTER_FIELDS = ["active", "department"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  {
    path: "department",
    select: "title",
    strictPopulate: false,
  },
];

const buildSearch = (query) => {
  if (!query.search) return {};
  const byTitle = buildMultiLangSearch(
    "title",
    query.language || "uz",
    query.search,
  );
  const byCode = buildPlainSearch("scienceCode", query.search);
  const parts = [byTitle, byCode].filter((p) => Object.keys(p).length > 0);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $or: parts };
};

const buildElectiveFilter = (query) => {
  const v = query.isElective;
  if (v === true || v === "true") return { isElective: true };
  if (v === false || v === "false") return { isElective: { $ne: true } };
  return {};
};

const SORT = { scienceCode: 1, _id: 1 };

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
      const doc = await new ScienceModel(req.body).save();
      if (!doc) return next(new ErrorHandler(400, "Failed to save science"));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add science", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
        ...buildElectiveFilter(req.query),
      };

      let q = ScienceModel.find(filter, EXCLUDE).sort(SORT);
      q = applyPopulate(q);
      let docs = await q.exec();

      docs = maybeTranslate(docs, req.query.language);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find science", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
        ...buildElectiveFilter(req.query),
      };

      const result = await ScienceModel.paginate(filter, {
        page: Math.max(parseInt(page) || PAGINATION.DEFAULT_PAGE, 1),
        limit: Math.min(
          parseInt(limit) || PAGINATION.DEFAULT_LIMIT,
          PAGINATION.MAX_LIMIT,
        ),
        sort: SORT,
        select: EXCLUDE,
        lean: true,
        populate: POPULATE,
      });

      if (result?.docs) result.docs = maybeTranslate(result.docs, req.query.language);
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate science", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      let q = ScienceModel.findById(req.params.id, EXCLUDE);
      q = applyPopulate(q);
      let doc = await q.exec();
      if (!doc) return next(new ErrorHandler(404, "science not found"));

      doc = maybeTranslate(doc, req.query.language);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find science", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await ScienceModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "science not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update science", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await ScienceModel.findByIdAndDelete(req.params.id).exec();
      if (!doc) return next(new ErrorHandler(404, "science not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete science", err.message),
      );
    }
  },
};
