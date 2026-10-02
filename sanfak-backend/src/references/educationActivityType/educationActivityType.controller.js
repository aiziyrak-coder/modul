const { ErrorHandler } = require("#shared/error");
const { PAGINATION } = require("#config/constants");
const {
  buildPlainSearch,
  applyFilters,
} = require("#shared/searchFilter");
const EducationActivityTypeModel = require("./educationActivityType.model");

const FILTER_FIELDS = ["active", "flow"];
const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const buildSearch = (query) => {
  if (!query.search) return {};
  return buildPlainSearch("title", query.search);
};

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new EducationActivityTypeModel(req.body).save();
      if (!doc)
        return next(new ErrorHandler(400, "Failed to save educationActivityType"));
      return res.status(201).json({
        message: "successfully created",
        _id: doc._id,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add educationActivityType", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = {
        ...buildSearch(req.query),
        ...applyFilters(req.query, FILTER_FIELDS),
      };

      const docs = await EducationActivityTypeModel.find(filter, EXCLUDE)
        .sort({ title: 1 })
        .lean();

      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find educationActivityType", err.message),
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

      const result = await EducationActivityTypeModel.paginate(filter, {
        page: Math.max(parseInt(page) || PAGINATION.DEFAULT_PAGE, 1),
        limit: Math.min(
          parseInt(limit) || PAGINATION.DEFAULT_LIMIT,
          PAGINATION.MAX_LIMIT,
        ),
        select: EXCLUDE,
        sort: { title: 1 },
        lean: true,
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate educationActivityType",
          err.message,
        ),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await EducationActivityTypeModel.findById(
        req.params.id,
        EXCLUDE,
      ).lean();
      if (!doc)
        return next(new ErrorHandler(404, "educationActivityType not found"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find educationActivityType", err.message),
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await EducationActivityTypeModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc)
        return next(new ErrorHandler(404, "educationActivityType not found"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to update educationActivityType",
          err.message,
        ),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await EducationActivityTypeModel.findByIdAndDelete(
        req.params.id,
      );
      if (!doc)
        return next(new ErrorHandler(404, "educationActivityType not found"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to delete educationActivityType",
          err.message,
        ),
      );
    }
  },
};
