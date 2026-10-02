const { ErrorHandler } = require("#shared/error");
const QualCourseType = require("./qualCourseType.model");

module.exports = {
  addQualCourseType: async (req, res, next) => {
    try {
      const doc = await QualCourseType.create({
        ...req.body,
        fileDetails: req.fileDetails,
      });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualCourseType", err.message),
      );
    }
  },

  findAllQualCourseTypes: async (req, res, next) => {
    try {
      const { kind } = req.query;
      const query = {};

      if (kind) query.kind = kind;

      let docs = await QualCourseType.find(query).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCourseTypes", err.message),
      );
    }
  },

  paginateQualCourseTypes: async (req, res, next) => {
    try {
      const { kind, page, limit } = req.query;
      const query = {};

      if (kind) query.kind = kind;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
      };
      let doc = await QualCourseType.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualCourseTypes",
          err.message,
        ),
      );
    }
  },

  findOneQualCourseType: async (req, res, next) => {
    try {
      let doc = await QualCourseType.findById(req.params.id).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCourseType", err.message),
      );
    }
  },

  updateQualCourseType: async (req, res, next) => {
    try {
      const body = { ...req.body };

      if (req?.files?.file) body.fileDetails = req.fileDetails;
      const doc = await QualCourseType.findByIdAndUpdate(req.params.id, body, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualCourseType", err.message),
      );
    }
  },

  deleteQualCourseType: async (req, res, next) => {
    try {
      const doc = await QualCourseType.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualCourseType", err.message),
      );
    }
  },
};
