const { ErrorHandler } = require("#shared/error");
const { translaterLanguage } = require("#shared/translate");
const { PAGINATION } = require("#config/constants");
const {
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const GroupModel = require("./group.model");

const FILTER_FIELDS = ["active", "direction", "course", "lang", "academicYear"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  {
    path: "direction",
    select: "title",
    strictPopulate: false,
  },
  {
    path: "course",
    select: "title",
    strictPopulate: false,
  },
  {
    path: "lang",
    select: "title active",
    strictPopulate: false,
  },
  {
    path: "academicYear",
    select: "title",
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
      const doc = await new GroupModel(req.body).save();
      if (!doc) return next(new ErrorHandler(400, "Failed to save group"));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add group", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      let q = GroupModel.find(filter, EXCLUDE);
      q = applyPopulate(q);
      let docs = await q.exec();

      docs = maybeTranslate(docs, req.query.language);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find group", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      const result = await GroupModel.paginate(filter, {
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
        new ErrorHandler(400, "Failed to paginate group", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      let q = GroupModel.findById(req.params.id, EXCLUDE);
      q = applyPopulate(q);
      let doc = await q.exec();
      if (!doc) return next(new ErrorHandler(404, "group not found"));

      doc = maybeTranslate(doc, req.query.language);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find group", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await GroupModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return next(new ErrorHandler(404, "group not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update group", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await GroupModel.findByIdAndDelete(req.params.id).exec();
      if (!doc) return next(new ErrorHandler(404, "group not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete group", err.message));
    }
  },
};
