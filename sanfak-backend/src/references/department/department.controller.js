const { ErrorHandler } = require("#shared/error");
const { translaterLanguage } = require("#shared/translate");
const { PAGINATION } = require("#config/constants");
const {
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const DepartmentModel = require("./department.model");

const FILTER_FIELDS = ["active", "faculty"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  {
    path: "faculty",
    select: "title",
    strictPopulate: false,
  },
  {
    path: "head",
    strictPopulate: false,
  },
];

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
      const doc = await new DepartmentModel(req.body).save();
      if (!doc) return next(new ErrorHandler(400, "Failed to save department"));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add department", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      let q = DepartmentModel.find(filter, EXCLUDE);
      q = applyPopulate(q);
      let docs = await q.exec();

      docs = maybeTranslate(docs, req.query.language);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find department", err.message),
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

      const result = await DepartmentModel.paginate(filter, {
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
        new ErrorHandler(400, "Failed to paginate department", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      let q = DepartmentModel.findById(req.params.id, EXCLUDE);
      q = applyPopulate(q);
      let doc = await q.exec();
      if (!doc) return next(new ErrorHandler(404, "department not found"));

      doc = maybeTranslate(doc, req.query.language);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find department", err.message),
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await DepartmentModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "department not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update department", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await DepartmentModel.findByIdAndDelete(req.params.id).exec();
      if (!doc) return next(new ErrorHandler(404, "department not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete department", err.message),
      );
    }
  },
};
