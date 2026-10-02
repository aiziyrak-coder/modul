const { ErrorHandler } = require("#shared/error");
const QualCalendarPlan = require("./qualCalendarPlan.model");

module.exports = {
  addQualCalendarPlan: async (req, res, next) => {
    try {
      const doc = await QualCalendarPlan.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualCalendarPlan", err.message),
      );
    }
  },

  findAllQualCalendarPlans: async (req, res, next) => {
    try {
      const {} = req.query;
      const query = {};

      let docs = await QualCalendarPlan.find(query)
        .sort({ createdAt: 1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCalendarPlans", err.message),
      );
    }
  },

  paginateQualCalendarPlans: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const query = {};

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: 1 },
      };
      let doc = await QualCalendarPlan.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualCalendarPlans",
          err.message,
        ),
      );
    }
  },

  findOneQualCalendarPlan: async (req, res, next) => {
    try {
      let doc = await QualCalendarPlan.findById(req.params.id).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCalendarPlan", err.message),
      );
    }
  },

  updateQualCalendarPlan: async (req, res, next) => {
    try {
      const doc = await QualCalendarPlan.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualCalendarPlan", err.message),
      );
    }
  },

  deleteQualCalendarPlan: async (req, res, next) => {
    try {
      const doc = await QualCalendarPlan.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualCalendarPlan", err.message),
      );
    }
  },
};
