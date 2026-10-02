const { ErrorHandler } = require("#shared/error");
const QualNotification = require("./qualNotification.model");

module.exports = {
  addQualNotification: async (req, res, next) => {
    try {
      const doc = await QualNotification.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualNotification", err.message),
      );
    }
  },

  findAllQualNotifications: async (req, res, next) => {
    try {
      const {} = req.query;
      const query = {};

      let docs = await QualNotification.find(query)
        .sort({ createdAt: 1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualNotifications", err.message),
      );
    }
  },

  paginateQualNotifications: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const query = {};

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: 1 },
      };
      let doc = await QualNotification.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualNotifications",
          err.message,
        ),
      );
    }
  },

  findOneQualNotification: async (req, res, next) => {
    try {
      let doc = await QualNotification.findById(req.params.id).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualNotification", err.message),
      );
    }
  },

  updateQualNotification: async (req, res, next) => {
    try {
      const doc = await QualNotification.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualNotification", err.message),
      );
    }
  },

  deleteQualNotification: async (req, res, next) => {
    try {
      const doc = await QualNotification.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualNotification", err.message),
      );
    }
  },
};
